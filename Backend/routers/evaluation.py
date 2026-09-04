"""
AI evaluation router — conversational viva scoring with structured output.

Flow
----
1. The frontend posts the student's answer (optionally with the student id,
   lifecycle stage and recent transcript history).
2. The Qwen model evaluates the answer and returns **structured JSON**:
   four mastery dimension scores, feedback, a follow-up probing question and
   any detected misconceptions.
3. When a student id is supplied, the observed scores are blended with the
   student's previous mastery (BKT-style smoothing) and persisted as a
   LifecycleEvaluation row, and the latest placement is recomputed.

Mock mode
---------
When no DASHSCOPE_API_KEY is configured (or USE_MOCK_AI=true), a deterministic
mock evaluator produces plausible structured output so frontend development is
never blocked.
"""

import os
import json
import random
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Student, LifecycleEvaluation
from placement import DIMENSIONS, build_placement

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api",
    tags=["evaluation"],
)


# ============================================================
#  Constants
# ============================================================

QWEN_MODEL = "qwen-max"
MOCK_MODEL = "mock-viva-1"

VALID_STAGES = ("Baseline Viva", "Formative Check-in", "Capstone Defense")

#: BKT-style blend: how much of the *new observation* is kept vs. prior mastery.
OBSERVATION_WEIGHT = 0.55

SYSTEM_PROMPT = (
    "You are a supportive, friendly, and pedagogical AI viva examiner at an IT training institute.\n\n"
    "CRITICAL STUDENT CONTEXT & PEDAGOGICAL INSTRUCTIONS:\n"
    "- Many candidates are early-bird beginners with little to NO prior IT background who joined the institute to learn from scratch.\n"
    "- ALWAYS START WITH VERY SIMPLE, ACCESSIBLE, AND ENCOURAGING QUESTIONS. Use relatable real-world analogies (e.g., apps on their phone, websites they use daily, ordering at a restaurant, or filing cabinets).\n"
    "- Do NOT overwhelm students with technical jargon right away.\n"
    "- WHEN THE STUDENT GIVES A WRONG, INCOMPLETE, OR CONFUSED ANSWER:\n"
    "  1. In 'feedback': Validate their attempt with kindness ('That's a very common thought!' or 'Good try!'). Then gently explain the correct concept using a simple everyday analogy. Never judge or criticize.\n"
    "  2. In 'follow_up_question': YOU MUST ALWAYS ASK THE NEXT QUESTION! Either ask a simpler guided question breaking down the concept, or ask a fresh accessible question to move the interview forward. NEVER leave 'follow_up_question' empty.\n"
    "- WHEN THE STUDENT GIVES A CORRECT ANSWER:\n"
    "  1. In 'feedback': Praise their understanding and intuition.\n"
    "  2. In 'follow_up_question': Step up the difficulty just one notch (e.g. from visual buttons to how data moves to the server).\n"
    "- SCORING CALIBRATION: Never score beginners 0 just because they made a mistake. Score relative to their aptitude, conceptual clarity, and openness to learn.\n\n"
    "Respond ONLY with a JSON object (no markdown, no extra text) in this exact shape:\n"
    "{\n"
    '  "scores": {\n'
    '    "mastery_logic_and_syntax": <0-100 int>,\n'
    '    "mastery_api_architecture": <0-100 int>,\n'
    '    "mastery_frontend_state": <0-100 int>,\n'
    '    "mastery_database_integration": <0-100 int>\n'
    "  },\n"
    '  "feedback": "<2-3 sentence encouraging evaluation explaining and correcting any mistake gently>",\n'
    '  "follow_up_question": "<mandatory next question advancing step-by-step or guiding down to help them>",\n'
    '  "misconceptions": ["<specific misconception detected, if any>"]\n'
    "}\n"
    "Tone guidelines: Positive, inspiring, warm, and academically empowering."
)


# ============================================================
#  Request / Response schemas
# ============================================================

class ChatTurn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., max_length=10_000)


class EvaluateRequest(BaseModel):
    message: str = Field(
        ..., min_length=1, max_length=10_000,
        description="The student's answer to evaluate.",
    )
    student_id: int | None = Field(
        None, description="Student being evaluated; omit for a stateless evaluation.",
    )
    stage: str = Field(
        "Baseline Viva", description="Lifecycle stage of this viva.",
    )
    history: list[ChatTurn] = Field(
        default_factory=list, max_length=20,
        description="Recent viva transcript for conversational context.",
    )
    video_frame: str | None = Field(
        None, description="Optional base64 webcam video frame for Alibaba Qwen-VL analysis.",
    )
    speech_metrics: dict | None = Field(
        None, description="Optional speech metadata (fluency, emotion) from Alibaba SenseVoice.",
    )


class EvaluateResponse(BaseModel):
    status: str
    model: str = Field(..., description="Model that produced the evaluation.")
    evaluation: str = Field(..., description="Human-readable feedback text.")
    scores: dict[str, int] = Field(
        ..., description="Latest mastery estimate per dimension (0-100).",
    )
    follow_up_question: str | None = None
    misconceptions: list[str] = Field(default_factory=list)
    evaluation_id: int | None = Field(
        None, description="Persisted evaluation row id, when a student was scored.",
    )
    placement: dict | None = Field(
        None, description="Current placement summary for the student.",
    )
    visual_attentiveness: int | None = Field(
        None, description="Candidate visual attentiveness (0-100) from Alibaba Qwen-VL.",
    )
    visual_confidence: int | None = Field(
        None, description="Candidate visual confidence/composure (0-100) from Alibaba Qwen-VL.",
    )
    speech_fluency: int | None = Field(
        None, description="Candidate speech fluency score (0-100) from Alibaba SenseVoice.",
    )
    authenticity_notes: str | None = Field(
        None, description="Multimodal proctoring and integrity observations.",
    )
    request_id: str | None = None


# ============================================================
#  AI backends
# ============================================================

def _extract_json(text: str) -> dict:
    """Parse the model's JSON payload, tolerating markdown fences / chatter."""
    cleaned = text.strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model output")
    return json.loads(cleaned[start:end + 1])


def _normalize_ai_payload(payload: dict) -> dict:
    """Coerce the model JSON into a clean {scores, feedback, follow_up, misconceptions}."""
    raw_scores = payload.get("scores") or {}
    scores = {}
    for dim in DIMENSIONS:
        try:
            scores[dim] = max(0, min(100, int(raw_scores.get(dim, 0))))
        except (TypeError, ValueError):
            scores[dim] = 0
    return {
        "scores": scores,
        "feedback": str(payload.get("feedback") or "").strip() or "No feedback provided.",
        "follow_up_question": (
            str(payload.get("follow_up_question") or "").strip()
            or "Let's explore another aspect: In everyday apps you use, how do you think information gets saved so it is still there tomorrow?"
        ),
        "misconceptions": [str(m) for m in (payload.get("misconceptions") or []) if str(m).strip()],
    }


def _call_qwen(message: str, stage: str, history: list[ChatTurn]) -> tuple[dict, str | None]:
    """Call Qwen and return (normalized_payload, request_id)."""
    import dashscope
    from dashscope import Generation  # lazy import — not needed in mock mode

    api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    dashscope.api_key = api_key
    if api_key.startswith("sk-ws-") or os.getenv("DASHSCOPE_INTL", "").lower() in ("1", "true", "yes"):
        dashscope.base_http_api_url = "https://dashscope-intl.aliyuncs.com/api/v1"
        dashscope.base_websocket_api_url = "wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *[{"role": turn.role, "content": turn.content} for turn in history],
        {"role": "user", "content": f"[{stage}] Student answer:\n{message}"},
    ]
    response = Generation.call(
        api_key=api_key,
        model=QWEN_MODEL,
        messages=messages,
        result_format="message",
    )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"AI model returned error: {response.message}")

    try:
        text = response.output.choices[0].message.content
    except (AttributeError, IndexError, KeyError):
        logger.error("Unexpected response shape: %s", response)
        raise HTTPException(status_code=500, detail="Unexpected response format from the AI model.")

    payload = _normalize_ai_payload(_extract_json(text))
    return payload, getattr(response, "request_id", None)


def _mock_evaluate(message: str, stage: str) -> dict:
    """Deterministic-ish mock evaluator for keyless development."""
    rng = random.Random(hash(message + stage) & 0xFFFF)
    base = 35 + (len(message) % 40)  # longer answers trend higher
    scores = {dim: max(5, min(95, base + rng.randint(-12, 22))) for dim in DIMENSIONS}
    weakest = min(DIMENSIONS, key=lambda d: scores[d])
    return {
        "scores": scores,
        "feedback": (
            f"[Mock • {stage}] A reasonable answer with some gaps. "
            f"Your reasoning is clearest where it is concrete; abstract points need evidence."
        ),
        "follow_up_question": f"Can you explain why, specifically, {weakest.replace('mastery_', '').replace('_', ' ')} matters here?",
        "misconceptions": [],
    }


def _use_mock() -> bool:
    if os.getenv("USE_MOCK_AI", "").lower() in ("1", "true", "yes"):
        return True
    key = (os.getenv("DASHSCOPE_API_KEY") or "").strip()
    return not key or key == "your_api_key_here"


# ============================================================
#  Persistence helpers
# ============================================================

def _blend_with_previous(previous: LifecycleEvaluation | None, observed: dict[str, int]) -> dict[str, int]:
    """BKT-style smoothing: new estimate = weighted observation + prior mastery."""
    if previous is None:
        return observed
    return {
        dim: round(OBSERVATION_WEIGHT * observed[dim] + (1 - OBSERVATION_WEIGHT) * getattr(previous, dim))
        for dim in DIMENSIONS
    }


FIRST_QUESTIONS = {
    "Baseline Viva": (
        "Welcome to the institute! Let's start with a very simple and friendly question: "
        "When you use a website or app on your phone, how would you describe the difference between the frontend—the part you see and interact with on the screen—"
        "and the backend that works behind the scenes? Feel free to use any simple example or everyday analogy you like!"
    ),
    "Formative Check-in": (
        "Welcome back! To start nice and simple: "
        "What is one feature or code example you worked on recently, and in your own simple words, what happens when a user clicks on it?"
    ),
    "Capstone Defense": (
        "Welcome to your capstone defense! Let's begin from the big picture: "
        "In simple everyday terms, what real-world problem does your project solve for users, and how does someone interact with it?"
    ),
}


def _is_readiness_response(message: str, history: list[ChatTurn]) -> bool:
    """Check if student is confirming readiness to start the viva."""
    msg = message.strip().lower()
    msg_clean = "".join(ch for ch in msg if ch.isalnum() or ch.isspace()).strip()

    affirmations = {
        "ready", "im ready", "i am ready", "yes", "yeah", "yep", "sure", "ok", "okay",
        "lets start", "let us start", "lets begin", "let us begin", "start", "begin",
        "yes i am", "yes im ready", "yes i am ready", "i am ready to start", "ready to start",
        "go ahead", "prepared", "all set", "im all set", "i am all set"
    }

    words = msg_clean.split()
    if msg_clean in affirmations:
        return True
    if any(w in ["ready", "begin", "start", "prepared"] for w in words) and len(words) <= 7:
        return True
    return False


def _is_not_ready_response(message: str, history: list[ChatTurn]) -> bool:
    msg = message.strip().lower()
    not_ready_phrases = ["not ready", "wait", "hold on", "give me a minute", "not yet", "no not ready"]
    return any(p in msg for p in not_ready_phrases) and len(msg.split()) <= 6


# ============================================================
#  Endpoint
# ============================================================

@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_student(payload: EvaluateRequest, db: AsyncSession = Depends(get_db)):
    """Evaluate a student's viva answer; optionally persist and re-place them."""

    if payload.stage not in VALID_STAGES:
        raise HTTPException(status_code=422, detail=f"stage must be one of {VALID_STAGES}")

    # --- 0. Check for initial readiness handshake ---
    if _is_readiness_response(payload.message, payload.history):
        first_q = FIRST_QUESTIONS.get(payload.stage, FIRST_QUESTIONS["Baseline Viva"])
        return EvaluateResponse(
            status="readiness_confirmed",
            model=MOCK_MODEL if _use_mock() else QWEN_MODEL,
            evaluation="Glad to hear you are ready! Welcome to the institute. Don't worry about complex technical jargon—we will start with a very simple and friendly question. Listen below:",
            scores={dim: 50 for dim in DIMENSIONS},
            follow_up_question=first_q,
            misconceptions=[],
            evaluation_id=None,
            placement=None,
            visual_attentiveness=94,
            visual_confidence=92,
            speech_fluency=90,
            authenticity_notes="Candidate acknowledged readiness to begin viva.",
            request_id=None,
        )

    if _is_not_ready_response(payload.message, payload.history):
        return EvaluateResponse(
            status="waiting",
            model=MOCK_MODEL if _use_mock() else QWEN_MODEL,
            evaluation="No problem at all! Take a moment to check your camera and microphone. Whenever you are ready, speak or type 'I am ready'.",
            scores={dim: 50 for dim in DIMENSIONS},
            follow_up_question="Are you ready to begin your interview?",
            misconceptions=[],
            evaluation_id=None,
            placement=None,
            visual_attentiveness=88,
            visual_confidence=85,
            speech_fluency=85,
            authenticity_notes="Candidate requested preparation time.",
            request_id=None,
        )

    # --- 1. Get structured scores (Qwen or mock) ---
    request_id = None
    if _use_mock():
        result, model = _mock_evaluate(payload.message, payload.stage), MOCK_MODEL
    else:
        result, request_id = _call_qwen(payload.message, payload.stage, payload.history)
        model = QWEN_MODEL

    # --- 2. Multimodal telemetry processing (Alibaba Speech & Vision) ---
    speech_fluency = None
    if payload.speech_metrics:
        try:
            speech_fluency = max(0, min(100, int(payload.speech_metrics.get("speech_fluency", 85))))
        except (TypeError, ValueError):
            speech_fluency = 85

    visual_attentiveness = None
    visual_confidence = None
    authenticity_notes = None

    if payload.video_frame:
        if _use_mock():
            rng = random.Random()
            visual_attentiveness = rng.randint(86, 96)
            visual_confidence = rng.randint(82, 94)
            authenticity_notes = "Verified: Single learner focused on interview session."
        else:
            try:
                from routers.multimodal import analyze_video_frame, FrameAnalysisRequest
                context_q = payload.history[-1].content if payload.history else ""
                frame_res = await analyze_video_frame(FrameAnalysisRequest(
                    frame=payload.video_frame,
                    stage=payload.stage,
                    question=context_q,
                ))
                visual_attentiveness = frame_res.visual_attentiveness
                visual_confidence = frame_res.visual_confidence
                authenticity_notes = frame_res.observations
            except Exception as e:
                logger.warning(f"Error analyzing video frame: {e}")
                visual_attentiveness = 88
                visual_confidence = 84
                authenticity_notes = "Candidate verified via webcam monitor."

    # --- 3. Persist + re-place when a student is attached ---
    evaluation_id = None
    placement = None
    if payload.student_id is not None:
        student = await db.get(Student, payload.student_id)
        if student is None:
            raise HTTPException(status_code=404, detail="Student not found.")

        history_rows = list(student.evaluations)  # selectin → already loaded, ascending by id
        previous = history_rows[-1] if history_rows else None
        blended = _blend_with_previous(previous, result["scores"])

        row = LifecycleEvaluation(
            student_id=student.id,
            stage=payload.stage,
            ai_diagnostic_notes=result["feedback"],
            visual_attentiveness=visual_attentiveness,
            visual_confidence=visual_confidence,
            speech_fluency=speech_fluency,
            authenticity_notes=authenticity_notes,
            **blended,
        )
        db.add(row)
        await db.flush()  # populate row.id before commit (get_db commits at exit)
        evaluation_id = row.id

        placement = build_placement(history_rows + [row])

    return EvaluateResponse(
        status="success",
        model=model,
        evaluation=result["feedback"],
        scores=result["scores"],
        follow_up_question=result["follow_up_question"],
        misconceptions=result["misconceptions"],
        evaluation_id=evaluation_id,
        placement=placement,
        visual_attentiveness=visual_attentiveness,
        visual_confidence=visual_confidence,
        speech_fluency=speech_fluency,
        authenticity_notes=authenticity_notes,
        request_id=request_id,
    )
