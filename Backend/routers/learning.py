"""
Learning library endpoints — subjects, notes, quizzes, progress and bookmarks.

All endpoints are student-scoped (JWT role "student"). Note content is
seeded demo data; admins do not manage it through the API.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_student
from database import get_db
from models import (
    BookmarkRead,
    MyProgressRead,
    Note,
    NoteProgress,
    NoteRead,
    NoteSummaryRead,
    QuizQuestion,
    QuizQuestionRead,
    QuizQuestionResult,
    QuizResult,
    QuizSubmission,
    RecentNoteRead,
    SearchHitRead,
    Student,
    Subject,
    SubjectDetailRead,
    SubjectProgressRead,
    SubjectRead,
)

router = APIRouter(prefix="/api/learning", tags=["learning"])


# ============================================================
#  Helpers
# ============================================================

async def _progress_map(db: AsyncSession, student_id: int) -> dict[int, NoteProgress]:
    """Map note_id -> NoteProgress row for the student."""
    rows = (
        await db.execute(
            select(NoteProgress).where(NoteProgress.student_id == student_id)
        )
    ).scalars().all()
    return {row.note_id: row for row in rows}


async def _get_note_or_404(db: AsyncSession, note_id: int) -> Note:
    note = await db.get(Note, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note


# ============================================================
#  Subjects
# ============================================================

@router.get("/subjects", response_model=list[SubjectRead])
async def list_subjects(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """All subjects with note counts and the student's read counts."""
    subjects = (
        (await db.execute(select(Subject).order_by(Subject.order_index))).scalars().all()
    )
    progress = await _progress_map(db, student.id)

    result: list[SubjectRead] = []
    for subject in subjects:
        note_ids = [note.id for note in subject.notes]
        read_count = sum(
            1 for nid in note_ids
            if nid in progress and progress[nid].is_read
        )
        result.append(SubjectRead(
            id=subject.id,
            title=subject.title,
            description=subject.description,
            icon=subject.icon,
            skill_key=subject.skill_key,
            order_index=subject.order_index,
            note_count=len(note_ids),
            read_count=read_count,
        ))
    return result


@router.get("/subjects/{subject_id}", response_model=SubjectDetailRead)
async def get_subject(
    subject_id: int,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """One subject with its ordered notes plus per-note flags."""
    subject = await db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found.")

    progress = await _progress_map(db, student.id)
    notes = [
        NoteSummaryRead(
            id=note.id,
            subject_id=note.subject_id,
            title=note.title,
            summary=note.summary,
            reading_minutes=note.reading_minutes,
            order_index=note.order_index,
            source=note.source,
            is_read=progress.get(note.id) is not None and progress[note.id].is_read,
            is_bookmarked=progress.get(note.id) is not None and progress[note.id].is_bookmarked,
        )
        for note in subject.notes
    ]
    return SubjectDetailRead(
        id=subject.id,
        title=subject.title,
        description=subject.description,
        icon=subject.icon,
        skill_key=subject.skill_key,
        notes=notes,
    )


# ============================================================
#  Notes
# ============================================================

@router.get("/notes/{note_id}", response_model=NoteRead)
async def get_note(
    note_id: int,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Full note content with its quiz (correct answers withheld)."""
    note = await _get_note_or_404(db, note_id)
    progress = await _progress_map(db, student.id)
    entry = progress.get(note.id)
    return NoteRead(
        id=note.id,
        subject_id=note.subject_id,
        title=note.title,
        summary=note.summary,
        reading_minutes=note.reading_minutes,
        order_index=note.order_index,
        source=note.source,
        is_read=entry is not None and entry.is_read,
        is_bookmarked=entry is not None and entry.is_bookmarked,
        content=note.content,
        quiz_questions=[
            QuizQuestionRead(
                id=q.id,
                question=q.question,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
            )
            for q in note.quiz_questions
        ],
    )


@router.post("/notes/{note_id}/read")
async def mark_note_read(
    note_id: int,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Upsert progress, marking the note as read."""
    await _get_note_or_404(db, note_id)
    entry = (
        await db.execute(
            select(NoteProgress).where(
                NoteProgress.student_id == student.id,
                NoteProgress.note_id == note_id,
            )
        )
    ).scalar_one_or_none()
    if entry is None:
        entry = NoteProgress(student_id=student.id, note_id=note_id)
        db.add(entry)
    entry.is_read = True
    await db.flush()
    return {"status": "ok", "note_id": note_id, "is_read": True}


@router.post("/notes/{note_id}/bookmark")
async def toggle_bookmark(
    note_id: int,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the bookmark flag for the note."""
    await _get_note_or_404(db, note_id)
    entry = (
        await db.execute(
            select(NoteProgress).where(
                NoteProgress.student_id == student.id,
                NoteProgress.note_id == note_id,
            )
        )
    ).scalar_one_or_none()
    if entry is None:
        entry = NoteProgress(student_id=student.id, note_id=note_id, is_bookmarked=True)
        db.add(entry)
        await db.flush()
        return {"note_id": note_id, "is_bookmarked": True}
    entry.is_bookmarked = not entry.is_bookmarked
    await db.flush()
    return {"note_id": note_id, "is_bookmarked": entry.is_bookmarked}


# ============================================================
#  Quiz
# ============================================================

@router.post("/notes/{note_id}/quiz", response_model=QuizResult)
async def submit_quiz(
    note_id: int,
    submission: QuizSubmission,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Grade the note quiz; correct options are revealed in the response."""
    note = await _get_note_or_404(db, note_id)
    questions = {q.id: q for q in note.quiz_questions}

    results: list[QuizQuestionResult] = []
    for answer in submission.answers:
        question = questions.get(answer.question_id)
        if question is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question {answer.question_id} does not belong to this note.",
            )
        results.append(QuizQuestionResult(
            question_id=question.id,
            selected_option=answer.selected_option,
            correct_option=question.correct_option,
            is_correct=answer.selected_option == question.correct_option,
        ))

    total = len(results)
    score = sum(1 for r in results if r.is_correct)
    return QuizResult(
        score=score,
        total=total,
        percentage=round(score * 100 / total) if total else 0,
        results=results,
    )


# ============================================================
#  Progress & search
# ============================================================

@router.get("/my-progress", response_model=MyProgressRead)
async def my_progress(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated learning progress: completion, bookmarks, recent notes."""
    subjects = (
        (await db.execute(select(Subject).order_by(Subject.order_index))).scalars().all()
    )
    progress = await _progress_map(db, student.id)
    all_notes = [note for subject in subjects for note in subject.notes]

    read_count = sum(
        1 for note in all_notes
        if note.id in progress and progress[note.id].is_read
    )
    subject_progress = []
    for subject in subjects:
        note_ids = [note.id for note in subject.notes]
        subject_read = sum(
            1 for nid in note_ids
            if nid in progress and progress[nid].is_read
        )
        subject_progress.append(SubjectProgressRead(
            subject_id=subject.id,
            title=subject.title,
            icon=subject.icon,
            note_count=len(note_ids),
            read_count=subject_read,
            percent=round(subject_read * 100 / len(note_ids)) if note_ids else 0,
        ))

    note_by_id = {note.id: note for note in all_notes}
    bookmarks = [
        BookmarkRead(
            note_id=entry.note_id,
            title=note_by_id[entry.note_id].title,
            subject_id=note_by_id[entry.note_id].subject_id,
            subject_title=note_by_id[entry.note_id].subject.title,
            updated_at=entry.updated_at,
        )
        for entry in sorted(
            (p for p in progress.values() if p.is_bookmarked),
            key=lambda p: p.updated_at,
            reverse=True,
        )
        if entry.note_id in note_by_id
    ]
    recent = sorted(progress.values(), key=lambda p: p.updated_at, reverse=True)[:5]
    recent_notes = [
        RecentNoteRead(
            note_id=entry.note_id,
            title=note_by_id[entry.note_id].title,
            subject_id=note_by_id[entry.note_id].subject_id,
            subject_title=note_by_id[entry.note_id].subject.title,
            is_read=entry.is_read,
            updated_at=entry.updated_at,
        )
        for entry in recent
        if entry.note_id in note_by_id
    ]

    return MyProgressRead(
        total_notes=len(all_notes),
        read_count=read_count,
        completion_percent=round(read_count * 100 / len(all_notes)) if all_notes else 0,
        subject_progress=subject_progress,
        bookmarks=bookmarks,
        recent_notes=recent_notes,
    )


@router.get("/search", response_model=list[SearchHitRead])
async def search_notes(
    q: str = Query(..., min_length=1, max_length=200),
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Case-insensitive search across note titles, summaries and content."""
    pattern = f"%{q}%"
    rows = (
        await db.execute(
            select(Note, Subject)
            .join(Subject, Note.subject_id == Subject.id)
            .where(
                or_(
                    Note.title.ilike(pattern),
                    Note.summary.ilike(pattern),
                    Note.content.ilike(pattern),
                )
            )
            .order_by(Subject.order_index, Note.order_index)
            .limit(20)
        )
    ).all()
    return [
        SearchHitRead(
            note_id=note.id,
            subject_id=subject.id,
            title=note.title,
            subject_title=subject.title,
            snippet=note.summary[:140],
        )
        for note, subject in rows
    ]
