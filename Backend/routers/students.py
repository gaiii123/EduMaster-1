"""
Students router — enrolment CRUD and per-student placement drill-down.

Endpoints
---------
GET    /api/students            → all students with their latest placement snapshot
POST   /api/students            → enrol a new student (intake)
GET    /api/students/{id}       → full detail: profile + placement + evaluation history
GET    /api/students/{id}/evaluations → raw evaluation history (ascending)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import (
    Student,
    StudentCreate,
    StudentRead,
    LifecycleEvaluationRead,
)
from placement import build_placement
from auth import hash_password

router = APIRouter(
    prefix="/api/students",
    tags=["students"],
)


def _snapshot(student: Student) -> dict:
    """Compact per-student card data: identity + latest placement essentials."""
    placement = build_placement(student.evaluations)
    return {
        "id": student.id,
        "name": student.name,
        "email": student.email,
        "student_code": student.student_code,
        "track": placement["track"] if placement else None,
        "level": placement["level"] if placement else None,
        "composite_score": placement["composite_score"] if placement else None,
        "evaluations_count": placement["evaluations_count"] if placement else 0,
    }


# ============================================================
#  Endpoints
# ============================================================

@router.get("", response_model=list[dict])
async def list_students(db: AsyncSession = Depends(get_db)):
    """All students with a placement snapshot for the admin roster view."""
    result = await db.execute(select(Student).order_by(Student.name))
    return [_snapshot(s) for s in result.scalars().all()]


@router.post("", response_model=StudentRead, status_code=201)
async def create_student(payload: StudentCreate, db: AsyncSession = Depends(get_db)):
    """Enrol a new student. Their journey starts with the Baseline Viva."""
    # Hash the password before storing
    student_data = payload.model_dump(exclude={"password"})
    student = Student(
        **student_data,
        password_hash=hash_password(payload.password),
    )
    db.add(student)
    await db.flush()
    await db.refresh(student)
    return student


@router.get("/{student_id}")
async def get_student(student_id: int, db: AsyncSession = Depends(get_db)):
    """Full drill-down: student profile, placement summary and evaluation history."""
    student = await db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")

    evaluations = sorted(student.evaluations, key=lambda e: e.id)
    placement = build_placement(evaluations)

    return {
        "student": StudentRead.model_validate(student),
        "placement": placement,
        "evaluations": [
            LifecycleEvaluationRead.model_validate(e) for e in evaluations
        ],
    }


@router.get("/{student_id}/evaluations", response_model=list[LifecycleEvaluationRead])
async def list_evaluations(student_id: int, db: AsyncSession = Depends(get_db)):
    """Raw evaluation history for a student (ascending)."""
    student = await db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    return sorted(student.evaluations, key=lambda e: e.id)
