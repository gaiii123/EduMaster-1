"""
AI Learning router — Alibaba Cloud Qwen / Qwen-VL powered study tools.

Endpoints (all student-scoped)
------------------------------
1. POST /api/learning/ai/generate-note   — Qwen writes a full note + quiz on any topic.
2. POST /api/learning/ai/coach           — Socratic tutor chat grounded in a note.
3. POST /api/learning/ai/practice        — fresh on-demand MCQs from a note.
4. GET  /api/learning/ai/digest/{id}     — summary bullets + flashcards.
5. POST /api/learning/ai/grade-spoken    — grade a transcribed spoken answer.
6. POST /api/learning/ai/photo-note      — Qwen-VL converts a photo of handwritten notes.
   POST /api/learning/ai/photo-note/save — persist the confirmed conversion.

Dual mode
---------
Follows the multimodal router convention: when DASHSCOPE_API_KEY is missing or
USE_MOCK_AI=true (or a live call fails), deterministic mocks keep every feature
usable. Generation tasks use qwen-plus to conserve free-tier quota.
"""

import os
import re
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_student
from database import get_db
from models import Note, QuizQuestion, Student, Subject
from routers.multimodal import _init_dashscope, _use_mock

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/learning/ai", tags=["ai-learning"])

GENERATION_MODEL = "qwen-plus"
MOCK_MODEL = "mock-qwen-plus"
VISION_MODEL = "qwen-vl-max"
MAX_NOTE_CONTENT_FOR_PROMPTS = 6000


# ============================================================
#  Schemas
# ============================================================

class GenerateNoteRequest(BaseModel):
    subject_id: int
    topic: str = Field(..., min_length=2, max_length=200)


class GenerateNoteResponse(BaseModel):
    note_id: int
    title: str
    model: str


class CoachTurn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=5_000)


class CoachRequest(BaseModel):
    note_id: int
    question: str = Field(..., min_length=1, max_length=2_000)
    history: list[CoachTurn] = Field(default_factory=list, max_length=12)


class CoachResponse(BaseModel):
    answer: str
    follow_up: str | None = None
    model: str


class PracticeRequest(BaseModel):
    note_id: int
    count: int = Field(5, ge=1, le=10)


class PracticeQuestion(BaseModel):
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: int = Field(..., ge=1, le=4)


class PracticeResponse(BaseModel):
    questions: list[PracticeQuestion]
    model: str


class Flashcard(BaseModel):
    front: str
    back: str


class DigestResponse(BaseModel):
    summary_points: list[str]
    flashcards: list[Flashcard]
    model: str


class GradeSpokenRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2_000)
    answer_text: str = Field(..., min_length=1, max_length=5_000)


class GradeSpokenResponse(BaseModel):
    is_correct: bool
    verdict: str = Field(..., description="'correct' | 'partial' | 'incorrect'")
    feedback: str
    model: str


class PhotoNoteRequest(BaseModel):
    image_base64: str = Field(..., min_length=10, description="Base64 image or data URL.")
    subject_id: int


class PhotoNoteResponse(BaseModel):
    title: str
    summary: str
    content_markdown: str
    model: str


class PhotoNoteSaveRequest(BaseModel):
    subject_id: int
    title: str = Field(..., min_length=2, max_length=200)
    summary: str = Field("", max_length=1_000)
    content: str = Field(..., min_length=10)


class PhotoNoteSaveResponse(BaseModel):
    note_id: int


# ============================================================
#  Qwen helpers
# ============================================================

def _extract_json_loose(text: str):
    """Parse a JSON object OR array from model output, tolerating fences/chatter."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    for opener, closer in (("{", "}"), ("[", "]")):
        start, end = cleaned.find(opener), cleaned.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except json.JSONDecodeError:
                continue
    raise ValueError("No JSON payload found in model output")


def _call_qwen_json(system: str, user: str, history: list[CoachTurn] | None = None):
    """Synchronous Qwen call returning parsed JSON. Raises on any failure."""
    from dashscope import Generation  # lazy — not needed in mock mode

    api_key = _init_dashscope()
    messages = [{"role": "system", "content": system}]
    for turn in history or []:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": user})

    response = Generation.call(
        api_key=api_key,
        model=GENERATION_MODEL,
        messages=messages,
        result_format="message",
    )
    if getattr(response, "status_code", 0) != 200:
        raise ValueError(f"Qwen error: {getattr(response, 'message', 'unknown')}")

    text = response.output.choices[0].message.content
    if isinstance(text, list):
        text = "".join(part.get("text", "") for part in text if isinstance(part, dict))
    return _extract_json_loose(text)


def _normalize_quiz_items(raw_items, max_items: int = 5) -> list[dict]:
    """Coerce model quiz output into safe dicts with 4 options and a valid answer."""
    items: list[dict] = []
    for raw in raw_items or []:
        if not isinstance(raw, dict):
            continue
        options = [str(raw.get(k) or "").strip() for k in ("option_a", "option_b", "option_c", "option_d")]
        if not str(raw.get("question") or "").strip() or not all(options):
            continue
        try:
            correct = max(1, min(4, int(raw.get("correct_option", 1))))
        except (TypeError, ValueError):
            correct = 1
        items.append({
            "question": str(raw["question"]).strip(),
            "option_a": options[0], "option_b": options[1],
            "option_c": options[2], "option_d": options[3],
            "correct_option": correct,
        })
        if len(items) >= max_items:
            break
    return items


def _headings(markdown: str) -> list[str]:
    return [line.lstrip("# ").strip() for line in markdown.splitlines()
            if line.startswith("## ") and line.lstrip("# ").strip()]


# ============================================================
#  Mock generators (dual-mode fallback)
# ============================================================

def _mock_note_payload(topic: str, subject_title: str) -> dict:
    title = f"{topic.strip().title()} — AI Study Note"
    fence = "```"
    content = (
        f"# {topic.strip().title()}\n\n"
        f"*AI-generated note on \"{topic}\" for the {subject_title} subject.*\n\n"
        f"## Overview\n\n"
        f"{topic} is a practical concept you will meet repeatedly in real projects. "
        f"This note breaks it into the idea itself, the key mechanics, and a worked example "
        f"so you can explain it confidently in your next viva.\n\n"
        f"## Key Concepts\n\n"
        f"- **What it is** — the core definition of {topic} in one plain sentence.\n"
        f"- **Why it matters** — the problem it solves and what breaks without it.\n"
        f"- **How it works** — the mechanism step by step, from input to result.\n"
        f"- **Common pitfall** — the mistake beginners make most often with {topic}.\n\n"
        f"## Worked Example\n\n"
        f"{fence}python\n"
        f"# A minimal sketch connecting {topic} to something concrete\n"
        f"def apply_topic(situation):\n"
        f"    understanding = identify_core_idea(\"{topic}\")\n"
        f"    return explain(understanding, with_analogy=True)\n"
        f"{fence}\n\n"
        f"> **Tip:** when a viva examiner asks about {topic}, start with the *why* before "
        f"the *how* — it shows understanding rather than memorization.\n\n"
        f"## Key Takeaway\n\n"
        f"If you can define {topic}, explain why it exists, and give one real example, "
        f"you have mastered this note.\n"
    )
    quiz = [
        {
            "question": f"What is the primary purpose of {topic}?",
            "option_a": "It is purely decorative and optional",
            "option_b": "It solves a specific practical problem in real projects",
            "option_c": "It replaces all other concepts in the subject",
            "option_d": "It only matters in production, never in learning",
            "correct_option": 2,
        },
        {
            "question": f"According to the note, how should you start a viva answer about {topic}?",
            "option_a": "With the deepest technical detail you remember",
            "option_b": "By saying you memorized the definition",
            "option_c": "With why it exists, before explaining how it works",
            "option_d": "By asking the examiner to explain it first",
            "correct_option": 3,
        },
        {
            "question": "Which shows genuine mastery of this note?",
            "option_a": "Defining it, explaining its purpose, and giving a real example",
            "option_b": "Repeating the exact wording of the note",
            "option_c": "Knowing the term exists",
            "option_d": "Skipping it because it is AI-generated",
            "correct_option": 1,
        },
    ]
    return {
        "title": title,
        "summary": f"An AI-generated deep dive into {topic}: what it is, why it matters, and a worked example.",
        "reading_minutes": 5,
        "content_markdown": content,
        "quiz": quiz,
    }


def _mock_coach_payload(note: Note, question: str) -> dict:
    return {
        "answer": (
            f"Great question! Based on the \"{note.title}\" note, think of it this way: "
            f"every concept in the note exists to solve a concrete problem, and your question "
            f"touches the '{(_headings(note.content) or ['Overview'])[0]}' part. "
            f"Re-read that section and connect it to a real app you use daily — "
            f"that is the fastest route to genuine understanding."
        ),
        "follow_up": f"Can you give me one everyday example where the idea behind \"{question[:60]}\" matters?",
    }


def _mock_practice_payload(note: Note, count: int) -> list[dict]:
    sections = _headings(note.content) or ["Overview", "Key Concepts", "Key Takeaway"]
    questions = []
    for i in range(count):
        section = sections[i % len(sections)]
        questions.append({
            "question": f"Practice {i + 1}: What is the main idea covered in the \"{section}\" section of this note?",
            "option_a": "It is unrelated to the note's topic",
            "option_b": f"It develops the note's core topic around {section.lower()}",
            "option_c": "It contradicts the earlier sections",
            "option_d": "It is only an example with no concept",
            "correct_option": 2,
        })
    return questions


def _mock_digest_payload(note: Note) -> dict:
    sections = _headings(note.content)
    points = [note.summary or note.title]
    points += [f"Section \"{s}\": review the key idea and one example." for s in sections[:5]]
    flashcards = [
        {"front": f"What is the core idea of \"{note.title}\"?", "back": note.summary or note.title},
        {"front": f"Which sections does \"{note.title}\" cover?", "back": ", ".join(sections[:5]) or "Overview and key concepts"},
        {"front": "How do you prove mastery of this note?", "back": "Define it, explain why it exists, and give one real example."},
    ]
    return {"summary_points": points[:7], "flashcards": flashcards}


def _mock_grade_payload(question: str, answer_text: str) -> dict:
    words = len(answer_text.split())
    if words >= 10:
        return {
            "verdict": "correct",
            "feedback": "Well explained! Your spoken answer covers the core idea clearly. Keep that structure in your viva.",
        }
    if words >= 4:
        return {
            "verdict": "partial",
            "feedback": "You are on the right track, but the answer is thin. Add the *why* and one concrete example.",
        }
    return {
        "verdict": "incorrect",
        "feedback": "That answer is too brief to judge. Try speaking 2-3 full sentences: what it is, why it matters, and an example.",
    }


def _mock_photo_payload(subject_title: str) -> dict:
    return {
        "title": "Converted Handwritten Notes",
        "summary": f"Your handwritten notes, transcribed and cleaned up for the {subject_title} subject.",
        "content_markdown": (
            "# Converted Handwritten Notes\n\n"
            "*Transcribed from your photo by EduMaster AI (mock mode — connect a DashScope key for real OCR).*\n\n"
            "## Page 1\n\n"
            "- First transcribed point from your handwriting.\n"
            "- Second transcribed point, tidied into a complete sentence.\n"
            "- Third point with the key term highlighted.\n\n"
            "> **Tip:** re-read the conversion and edit anything the AI misread before saving.\n"
        ),
    }


# ============================================================
#  Shared DB helpers
# ============================================================

async def _get_note(db: AsyncSession, note_id: int) -> Note:
    note = await db.get(Note, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note


async def _get_subject(db: AsyncSession, subject_id: int) -> Subject:
    subject = await db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found.")
    return subject


async def _next_order_index(db: AsyncSession, subject_id: int) -> int:
    highest = (
        await db.execute(
            select(func.max(Note.order_index)).where(Note.subject_id == subject_id)
        )
    ).scalar()
    return (highest or 0) + 1


async def _persist_note(
    db: AsyncSession,
    subject: Subject,
    payload: dict,
    source: str,
    quiz_items: list[dict] | None,
) -> Note:
    """Create a Note (+ optional quiz) from a normalized payload and flush."""
    note = Note(
        subject_id=subject.id,
        title=str(payload.get("title") or "Untitled note")[:200],
        summary=str(payload.get("summary") or "")[:1000],
        content=str(payload.get("content_markdown") or payload.get("content") or ""),
        reading_minutes=max(1, min(60, int(payload.get("reading_minutes") or 5))),
        order_index=await _next_order_index(db, subject.id),
        source=source,
    )
    db.add(note)
    await db.flush()  # populate note.id for quiz FKs
    for index, item in enumerate(quiz_items or [], start=1):
        db.add(QuizQuestion(
            note_id=note.id,
            question=item["question"],
            option_a=item["option_a"],
            option_b=item["option_b"],
            option_c=item["option_c"],
            option_d=item["option_d"],
            correct_option=item["correct_option"],
            order_index=index,
        ))
    await db.flush()
    return note


# ============================================================
#  1. AI note generation
# ============================================================

@router.post("/generate-note", response_model=GenerateNoteResponse)
async def generate_note(
    payload: GenerateNoteRequest,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Qwen writes a complete study note + quiz on the requested topic."""
    subject = await _get_subject(db, payload.subject_id)

    model = GENERATION_MODEL
    try:
        if _use_mock():
            raise RuntimeError("mock mode")
        system = (
            "You are an expert IT curriculum author for EduMaster, an AI training institute.\n"
            "Write ONE high-quality study note in Markdown for beginner-to-intermediate IT students.\n"
            "Rules: simple language; 400-700 words; use ## subheadings; include at least one code block "
            "and one '> **Tip:**' callout; end with a 'Key Takeaway' section.\n"
            "Respond ONLY with a JSON object (no markdown fences) in this exact shape:\n"
            '{"title": "<short title>", "summary": "<one-sentence teaser, max 140 chars>", '
            '"reading_minutes": <int 3-12>, "content_markdown": "<full markdown, newlines as \\n>", '
            '"quiz": [{"question": "...", "option_a": "...", "option_b": "...", "option_c": "...", '
            '"option_d": "...", "correct_option": <1-4>}]} with exactly 3 quiz items.'
        )
        user = f"Subject: {subject.title}\nTopic requested by the student: {payload.topic}"
        data = _call_qwen_json(system, user)
        quiz_items = _normalize_quiz_items(data.get("quiz"), max_items=5)
        if not quiz_items:
            raise ValueError("Model returned no usable quiz questions")
        note_payload = data
    except Exception as err:
        if not _use_mock():
            logger.warning(f"AI note generation fell back to mock: {err}")
        model = MOCK_MODEL
        data = _mock_note_payload(payload.topic, subject.title)
        quiz_items = _normalize_quiz_items(data["quiz"], max_items=5)
        note_payload = data

    note = await _persist_note(db, subject, note_payload, source="ai", quiz_items=quiz_items)
    return GenerateNoteResponse(note_id=note.id, title=note.title, model=model)


# ============================================================
#  2. AI study coach
# ============================================================

@router.post("/coach", response_model=CoachResponse)
async def study_coach(
    payload: CoachRequest,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Socratic tutor chat grounded in the note content."""
    note = await _get_note(db, payload.note_id)

    model = GENERATION_MODEL
    try:
        if _use_mock():
            raise RuntimeError("mock mode")
        system = (
            "You are EduMaster's AI study coach — a friendly Socratic tutor for IT students.\n"
            "Ground every answer ONLY in the study note below. If the note does not cover the "
            "question, say so briefly and give the closest relevant explanation.\n"
            "Keep answers to 3-5 sentences with simple language and one example or analogy.\n"
            'Respond ONLY with JSON: {"answer": "...", "follow_up": "<one short question to check understanding>"}\n\n'
            f"STUDY NOTE — {note.title}:\n{note.content[:MAX_NOTE_CONTENT_FOR_PROMPTS]}"
        )
        history = payload.history[-6:]
        data = _call_qwen_json(system, payload.question, history)
        answer = str(data.get("answer") or "").strip()
        follow_up = str(data.get("follow_up") or "").strip() or None
        if not answer:
            raise ValueError("Empty coach answer")
    except Exception as err:
        if not _use_mock():
            logger.warning(f"AI coach fell back to mock: {err}")
        model = MOCK_MODEL
        data = _mock_coach_payload(note, payload.question)
        answer, follow_up = data["answer"], data["follow_up"]

    return CoachResponse(answer=answer, follow_up=follow_up, model=model)


# ============================================================
#  3. AI practice quiz
# ============================================================

@router.post("/practice", response_model=PracticeResponse)
async def practice_quiz(
    payload: PracticeRequest,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Fresh MCQs generated from the note; never repeats existing questions."""
    note = await _get_note(db, payload.note_id)

    model = GENERATION_MODEL
    try:
        if _use_mock():
            raise RuntimeError("mock mode")
        existing = "; ".join(q.question for q in note.quiz_questions) or "none"
        system = (
            "You are an IT assessment designer. Create NEW multiple-choice questions from the study note below.\n"
            f"Never reuse or rephrase these existing questions: {existing}\n"
            "Questions must test understanding, not memorization; exactly one correct option.\n"
            "Respond ONLY with a JSON array (no fences) of objects:\n"
            '[{"question": "...", "option_a": "...", "option_b": "...", "option_c": "...", '
            '"option_d": "...", "correct_option": <1-4>}]'
        )
        user = (
            f"Create {payload.count} questions from this note:\n\n"
            f"{note.content[:MAX_NOTE_CONTENT_FOR_PROMPTS]}"
        )
        data = _call_qwen_json(system, user)
        questions = _normalize_quiz_items(data if isinstance(data, list) else data.get("questions"),
                                            max_items=payload.count)
        if not questions:
            raise ValueError("Model returned no usable practice questions")
    except Exception as err:
        if not _use_mock():
            logger.warning(f"AI practice quiz fell back to mock: {err}")
        model = MOCK_MODEL
        questions = _mock_practice_payload(note, payload.count)

    return PracticeResponse(questions=[PracticeQuestion(**q) for q in questions], model=model)


# ============================================================
#  4. AI digest (summary + flashcards)
# ============================================================

@router.get("/digest/{note_id}", response_model=DigestResponse)
async def note_digest(
    note_id: int,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Quick-revision summary bullets and flashcards for a note."""
    note = await _get_note(db, note_id)

    model = GENERATION_MODEL
    try:
        if _use_mock():
            raise RuntimeError("mock mode")
        system = (
            "You are a study-skills expert. Summarize the study note below for quick revision.\n"
            "Respond ONLY with JSON: {\"summary_points\": [5-7 short bullets, no markdown], "
            "\"flashcards\": [5-8 objects {\"front\": \"<question or term>\", \"back\": \"<short answer>\"}]}"
        )
        data = _call_qwen_json(system, note.content[:MAX_NOTE_CONTENT_FOR_PROMPTS])
        points = [str(p).strip() for p in (data.get("summary_points") or []) if str(p).strip()][:7]
        cards = [
            Flashcard(front=str(c.get("front", "")).strip(), back=str(c.get("back", "")).strip())
            for c in (data.get("flashcards") or [])
            if isinstance(c, dict) and str(c.get("front", "")).strip() and str(c.get("back", "")).strip()
        ][:8]
        if not points or not cards:
            raise ValueError("Model returned an incomplete digest")
    except Exception as err:
        if not _use_mock():
            logger.warning(f"AI digest fell back to mock: {err}")
        model = MOCK_MODEL
        data = _mock_digest_payload(note)
        points = data["summary_points"]
        cards = [Flashcard(**c) for c in data["flashcards"]]

    return DigestResponse(summary_points=points, flashcards=cards, model=model)


# ============================================================
#  5. Spoken answer grading (post-ASR)
# ============================================================

@router.post("/grade-spoken", response_model=GradeSpokenResponse)
async def grade_spoken_answer(
    payload: GradeSpokenRequest,
    student: Student = Depends(get_current_student),
):
    """Grade a transcribed spoken answer with Qwen (lenient on wording, strict on concept)."""
    model = GENERATION_MODEL
    try:
        if _use_mock():
            raise RuntimeError("mock mode")
        system = (
            "You are grading a student's SPOKEN answer to a quiz question. Be lenient on wording "
            "and grammar, strict on the underlying concept.\n"
            'Respond ONLY with JSON: {"verdict": "correct" | "partial" | "incorrect", '
            '"feedback": "<1-2 sentence kind, actionable feedback>"}'
        )
        user = f"Question: {payload.question}\n\nStudent's spoken answer: {payload.answer_text}"
        data = _call_qwen_json(system, user)
        verdict = str(data.get("verdict", "incorrect")).lower().strip()
        if verdict not in ("correct", "partial", "incorrect"):
            verdict = "incorrect"
        feedback = str(data.get("feedback") or "").strip() or "Try expanding your answer with an example."
    except Exception as err:
        if not _use_mock():
            logger.warning(f"Spoken grading fell back to mock: {err}")
        model = MOCK_MODEL
        data = _mock_grade_payload(payload.question, payload.answer_text)
        verdict, feedback = data["verdict"], data["feedback"]

    return GradeSpokenResponse(
        is_correct=verdict == "correct",
        verdict=verdict,
        feedback=feedback,
        model=model,
    )


# ============================================================
#  6. Photo notes (Qwen-VL) — convert, then student confirms & saves
# ============================================================

@router.post("/photo-note", response_model=PhotoNoteResponse)
async def convert_photo_note(
    payload: PhotoNoteRequest,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Qwen-VL transcribes a photo of handwritten notes into clean Markdown."""
    subject = await _get_subject(db, payload.subject_id)

    model = VISION_MODEL
    try:
        if _use_mock():
            raise RuntimeError("mock mode")
        data = _call_qwen_vl(payload.image_base64, subject.title)
        if not str(data.get("content_markdown") or "").strip():
            raise ValueError("Vision model returned empty conversion")
    except Exception as err:
        if not _use_mock():
            logger.warning(f"Photo note conversion fell back to mock: {err}")
        model = f"{VISION_MODEL}-mock"
        data = _mock_photo_payload(subject.title)

    return PhotoNoteResponse(
        title=str(data.get("title") or "Converted Handwritten Notes")[:200],
        summary=str(data.get("summary") or "")[:1000],
        content_markdown=str(data.get("content_markdown") or ""),
        model=model,
    )


def _call_qwen_vl(image_base64: str, subject_title: str) -> dict:
    """OCR + structure handwritten notes via Qwen-VL. Raises on failure."""
    import base64
    import tempfile
    from dashscope import MultiModalConversation

    raw_b64 = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
    image_bytes = base64.b64decode(raw_b64)

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        norm_p = tmp_path.replace("\\", "/")
        if not norm_p.startswith("/"):
            norm_p = "/" + norm_p
        img_url = f"file://{norm_p}"

        prompt = (
            f"This is a photo of a student's handwritten study notes for the {subject_title} subject.\n"
            "Transcribe them faithfully and clean them into a well-structured Markdown study note: "
            "fix obvious typos, add ## subheadings, keep the student's own wording where possible.\n"
            "Respond ONLY with JSON: {\"title\": \"<short title>\", \"summary\": \"<one sentence>\", "
            "\"content_markdown\": \"<clean markdown, newlines as \\n>\"}"
        )
        api_key = _init_dashscope()
        response = MultiModalConversation.call(
            api_key=api_key,
            model=VISION_MODEL,
            messages=[{"role": "user", "content": [{"image": img_url}, {"text": prompt}]}],
            result_format="message",
        )
        if getattr(response, "status_code", 0) != 200:
            raise ValueError(f"Qwen-VL error: {getattr(response, 'message', 'unknown')}")

        text = response.output.choices[0].message.content
        if isinstance(text, list):
            text = "".join(part.get("text", "") for part in text if isinstance(part, dict))
        return _extract_json_loose(text)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@router.post("/photo-note/save", response_model=PhotoNoteSaveResponse)
async def save_photo_note(
    payload: PhotoNoteSaveRequest,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Persist the student-confirmed photo conversion as source='photo'."""
    subject = await _get_subject(db, payload.subject_id)
    note = await _persist_note(
        db,
        subject,
        {
            "title": payload.title,
            "summary": payload.summary,
            "content_markdown": payload.content,
            "reading_minutes": max(2, len(payload.content.split()) // 200),
        },
        source="photo",
        quiz_items=None,
    )
    return PhotoNoteSaveResponse(note_id=note.id)
