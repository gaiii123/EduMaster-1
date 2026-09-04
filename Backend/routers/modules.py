"""
Course/Module management router — supports:
- Admin creating/editing/deleting modules
- Admin adding sections & items (notes, lecture slides, assignments, quizzes, announcements, files)
- Student browsing and self-enrolling into modules
- Students reading notes, viewing slides, taking quizzes, and submitting assignments
- Admin grading assignments and viewing module gradebook
"""

import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_admin, get_current_student, get_current_user_any
from database import get_db
from models import (
    Admin,
    CourseModule,
    CourseModuleCreate,
    CourseModuleDetailRead,
    CourseModuleRead,
    CourseModuleUpdate,
    ModuleAssignmentGradeCreate,
    ModuleAssignmentSubmission,
    ModuleAssignmentSubmissionCreate,
    ModuleAssignmentSubmissionRead,
    ModuleEnrollment,
    ModuleExamGrade,
    ModuleExamGradeRead,
    ModuleExamGradeUpdate,
    ModuleFinalGradebookRead,
    ModuleGradeItemRead,
    ModuleItem,
    ModuleItemCreate,
    ModuleItemQuizQuestionCreate,
    ModuleItemQuizQuestionRead,
    ModuleItemRead,
    ModuleItemUpdate,
    ModuleParticipantRead,
    ModuleQuizAttempt,
    ModuleQuizAttemptRead,
    ModuleQuizQuestion,
    ModuleQuizResultQuestion,
    ModuleQuizResultRead,
    ModuleQuizSubmission,
    ModuleSection,
    ModuleSectionCreate,
    ModuleSectionRead,
    ModuleSectionUpdate,
    ModuleWeeklyVivaEvaluation,
    Student,
    StudentFinalGradeRow,
    StudentPillarGradeBreakdown,
)

router = APIRouter(prefix="/api/modules", tags=["modules"])

# Directory for file uploads
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "modules"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _format_file_size(size_in_bytes: int) -> str:
    """Format bytes into readable string (e.g. 2.4 MB)."""
    if size_in_bytes < 1024:
        return f"{size_in_bytes} B"
    elif size_in_bytes < 1024 * 1024:
        return f"{size_in_bytes / 1024:.1f} KB"
    else:
        return f"{size_in_bytes / (1024 * 1024):.1f} MB"


# ============================================================
#  File Upload Endpoint
# ============================================================

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    auth_data: dict = Depends(get_current_user_any),
):
    """Upload a file (lecture slides, PDF question papers, assignment submissions)."""
    ext = Path(file.filename or "file").suffix
    unique_filename = f"{uuid.uuid4().hex[:12]}_{Path(file.filename or 'doc').stem}{ext}"
    destination = UPLOAD_DIR / unique_filename

    contents = await file.read()
    file_size_bytes = len(contents)

    with open(destination, "wb") as f:
        f.write(contents)

    file_url = f"/uploads/modules/{unique_filename}"
    return {
        "file_url": file_url,
        "file_name": file.filename or unique_filename,
        "file_size": _format_file_size(file_size_bytes),
    }


# ============================================================
#  Course Modules CRUD
# ============================================================

@router.get("", response_model=list[CourseModuleRead])
async def list_modules(
    search: str | None = None,
    level: str | None = None,
    filter_type: str | None = None,  # "all", "enrolled", "available"
    auth_data: dict = Depends(get_current_user_any),
    db: AsyncSession = Depends(get_db),
):
    """
    List course modules with enrollment status, counts, and search/filter.
    """
    current_user_id = auth_data["id"]
    is_student = auth_data["role"] == "student"

    query = select(CourseModule).order_by(CourseModule.created_at.desc())

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                CourseModule.title.ilike(s),
                CourseModule.code.ilike(s),
                CourseModule.description.ilike(s),
            )
        )

    if level and level.lower() != "all":
        query = query.where(CourseModule.level == level)

    modules = (await db.execute(query)).scalars().all()

    # Get student enrollments if student
    enrolled_module_ids = set()
    if is_student:
        enrolled_res = await db.execute(
            select(ModuleEnrollment.module_id).where(
                ModuleEnrollment.student_id == current_user_id,
                ModuleEnrollment.status == "active",
            )
        )
        enrolled_module_ids = set(enrolled_res.scalars().all())

    # Get enrolled counts per module
    counts_res = await db.execute(
        select(ModuleEnrollment.module_id, func.count(ModuleEnrollment.id))
        .where(ModuleEnrollment.status == "active")
        .group_by(ModuleEnrollment.module_id)
    )
    counts_map = dict(counts_res.all())

    results: list[CourseModuleRead] = []
    for mod in modules:
        is_enrolled = mod.id in enrolled_module_ids

        # Apply filter_type
        if filter_type == "enrolled" and not is_enrolled:
            continue
        if filter_type == "available" and is_enrolled:
            continue

        item_count = sum(len(sec.items) for sec in mod.sections)

        results.append(
            CourseModuleRead(
                id=mod.id,
                code=mod.code,
                title=mod.title,
                description=mod.description,
                level=mod.level,
                academic_year=mod.academic_year,
                banner_pattern=mod.banner_pattern,
                banner_image_url=mod.banner_image_url,
                is_published=mod.is_published,
                created_at=mod.created_at,
                updated_at=mod.updated_at,
                enrolled_count=counts_map.get(mod.id, 0),
                is_enrolled=is_enrolled,
                section_count=len(mod.sections),
                item_count=item_count,
            )
        )

    return results


@router.post("", response_model=CourseModuleRead, status_code=status.HTTP_201_CREATED)
async def create_module(
    payload: CourseModuleCreate,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin creates a new course module with a default 'General' section."""
    mod = CourseModule(
        code=payload.code.strip().upper(),
        title=payload.title.strip(),
        description=payload.description.strip(),
        level=payload.level.strip(),
        academic_year=payload.academic_year.strip(),
        banner_pattern=payload.banner_pattern.strip(),
        banner_image_url=payload.banner_image_url,
        is_published=payload.is_published,
        created_by_admin_id=admin.id,
    )
    db.add(mod)
    await db.flush()

    # Automatically create a "General" section
    general_section = ModuleSection(
        module_id=mod.id,
        title="General",
        description="General course information, announcements, and syllabus.",
        order_index=0,
    )
    db.add(general_section)
    await db.commit()
    await db.refresh(mod)

    return CourseModuleRead(
        id=mod.id,
        code=mod.code,
        title=mod.title,
        description=mod.description,
        level=mod.level,
        academic_year=mod.academic_year,
        banner_pattern=mod.banner_pattern,
        banner_image_url=mod.banner_image_url,
        is_published=mod.is_published,
        created_at=mod.created_at,
        updated_at=mod.updated_at,
        enrolled_count=0,
        is_enrolled=False,
        section_count=1,
        item_count=0,
    )


@router.get("/{module_id}", response_model=CourseModuleDetailRead)
async def get_module(
    module_id: int,
    auth_data: dict = Depends(get_current_user_any),
    db: AsyncSession = Depends(get_db),
):
    """Get full module details, sections, and items."""
    mod = await db.get(CourseModule, module_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found.")

    current_user_id = auth_data["id"]
    is_student = auth_data["role"] == "student"

    # Check enrollment
    is_enrolled = False
    if is_student:
        enr = (
            await db.execute(
                select(ModuleEnrollment).where(
                    ModuleEnrollment.module_id == module_id,
                    ModuleEnrollment.student_id == current_user_id,
                    ModuleEnrollment.status == "active",
                )
            )
        ).scalar_one_or_none()
        is_enrolled = enr is not None

    # Count enrolled
    count_res = await db.execute(
        select(func.count(ModuleEnrollment.id)).where(
            ModuleEnrollment.module_id == module_id,
            ModuleEnrollment.status == "active",
        )
    )
    enrolled_count = count_res.scalar() or 0

    # Build sections & items
    sections_read: list[ModuleSectionRead] = []
    total_items = 0

    for sec in mod.sections:
        items_read: list[ModuleItemRead] = []
        for item in sec.items:
            total_items += 1

            # Check student submission / quiz attempt
            my_sub = None
            my_quiz_attempt = None

            if is_student:
                if item.item_type == "assignment":
                    sub_row = (
                        await db.execute(
                            select(ModuleAssignmentSubmission).where(
                                ModuleAssignmentSubmission.item_id == item.id,
                                ModuleAssignmentSubmission.student_id == current_user_id,
                            )
                        )
                    ).scalar_one_or_none()
                    if sub_row:
                        my_sub = ModuleAssignmentSubmissionRead(
                            id=sub_row.id,
                            item_id=sub_row.item_id,
                            student_id=sub_row.student_id,
                            submission_text=sub_row.submission_text,
                            file_url=sub_row.file_url,
                            file_name=sub_row.file_name,
                            status=sub_row.status,
                            grade=sub_row.grade,
                            feedback=sub_row.feedback,
                            submitted_at=sub_row.submitted_at,
                            graded_at=sub_row.graded_at,
                        )

                elif item.item_type == "quiz":
                    att_row = (
                        await db.execute(
                            select(ModuleQuizAttempt).where(
                                ModuleQuizAttempt.item_id == item.id,
                                ModuleQuizAttempt.student_id == current_user_id,
                            )
                        )
                    ).scalar_one_or_none()
                    if att_row:
                        my_quiz_attempt = ModuleQuizAttemptRead(
                            id=att_row.id,
                            item_id=att_row.item_id,
                            student_id=att_row.student_id,
                            score=att_row.score,
                            total_questions=att_row.total_questions,
                            percentage=att_row.percentage,
                            completed_at=att_row.completed_at,
                        )

            # Submissions count for admin
            subs_count = 0
            if not is_student and item.item_type == "assignment":
                subs_count = (
                    await db.execute(
                        select(func.count(ModuleAssignmentSubmission.id)).where(
                            ModuleAssignmentSubmission.item_id == item.id
                        )
                    )
                ).scalar() or 0

            # Quiz questions
            quiz_q_read = [
                ModuleItemQuizQuestionRead(
                    id=q.id,
                    question=q.question,
                    option_a=q.option_a,
                    option_b=q.option_b,
                    option_c=q.option_c,
                    option_d=q.option_d,
                    correct_option=q.correct_option if (not is_student or my_quiz_attempt) else None,
                    explanation=q.explanation if (not is_student or my_quiz_attempt) else "",
                    order_index=q.order_index,
                )
                for q in item.quiz_questions
            ]

            items_read.append(
                ModuleItemRead(
                    id=item.id,
                    section_id=item.section_id,
                    item_type=item.item_type,
                    title=item.title,
                    description=item.description,
                    content=item.content,
                    file_url=item.file_url,
                    file_name=item.file_name,
                    file_size=item.file_size,
                    due_date=item.due_date,
                    max_points=item.max_points,
                    time_limit_minutes=item.time_limit_minutes,
                    order_index=item.order_index,
                    created_at=item.created_at,
                    quiz_questions=quiz_q_read,
                    my_submission=my_sub,
                    my_quiz_attempt=my_quiz_attempt,
                    submissions_count=subs_count,
                )
            )

        sections_read.append(
            ModuleSectionRead(
                id=sec.id,
                module_id=sec.module_id,
                title=sec.title,
                description=sec.description,
                order_index=sec.order_index,
                created_at=sec.created_at,
                items=items_read,
            )
        )

    return CourseModuleDetailRead(
        id=mod.id,
        code=mod.code,
        title=mod.title,
        description=mod.description,
        level=mod.level,
        academic_year=mod.academic_year,
        banner_pattern=mod.banner_pattern,
        banner_image_url=mod.banner_image_url,
        is_published=mod.is_published,
        created_at=mod.created_at,
        updated_at=mod.updated_at,
        enrolled_count=enrolled_count,
        is_enrolled=is_enrolled,
        section_count=len(mod.sections),
        item_count=total_items,
        sections=sections_read,
    )


@router.put("/{module_id}", response_model=CourseModuleRead)
async def update_module(
    module_id: int,
    payload: CourseModuleUpdate,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin updates course module information."""
    mod = await db.get(CourseModule, module_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found.")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(mod, field, val)

    await db.commit()
    await db.refresh(mod)

    return CourseModuleRead(
        id=mod.id,
        code=mod.code,
        title=mod.title,
        description=mod.description,
        level=mod.level,
        academic_year=mod.academic_year,
        banner_pattern=mod.banner_pattern,
        banner_image_url=mod.banner_image_url,
        is_published=mod.is_published,
        created_at=mod.created_at,
        updated_at=mod.updated_at,
        enrolled_count=len(mod.enrollments),
        is_enrolled=False,
        section_count=len(mod.sections),
        item_count=sum(len(s.items) for s in mod.sections),
    )


@router.delete("/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module(
    module_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin deletes a course module and its cascaded content."""
    mod = await db.get(CourseModule, module_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found.")

    await db.delete(mod)
    await db.commit()
    return None


# ============================================================
#  Enrollment Endpoints
# ============================================================

@router.post("/{module_id}/enroll")
async def enroll_module(
    module_id: int,
    student_id: int | None = Query(None, description="Admin enrolling specific student"),
    auth_data: dict = Depends(get_current_user_any),
    db: AsyncSession = Depends(get_db),
):
    """Student self-enrolls or admin enrolls student."""
    mod = await db.get(CourseModule, module_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found.")

    target_student_id = student_id if (auth_data["role"] == "admin" and student_id) else auth_data["id"]

    student = await db.get(Student, target_student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    existing = (
        await db.execute(
            select(ModuleEnrollment).where(
                ModuleEnrollment.module_id == module_id,
                ModuleEnrollment.student_id == target_student_id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        if existing.status != "active":
            existing.status = "active"
            await db.commit()
        return {"status": "enrolled", "message": "Enrollment active."}

    enrollment = ModuleEnrollment(
        student_id=target_student_id,
        module_id=module_id,
        status="active",
    )
    db.add(enrollment)
    await db.commit()
    return {"status": "enrolled", "message": f"Successfully enrolled in {mod.code} - {mod.title}."}


@router.post("/{module_id}/unenroll")
async def unenroll_module(
    module_id: int,
    student_id: int | None = Query(None, description="Admin unenrolling specific student"),
    auth_data: dict = Depends(get_current_user_any),
    db: AsyncSession = Depends(get_db),
):
    """Student unenrolls or admin removes student from module."""
    target_student_id = student_id if (auth_data["role"] == "admin" and student_id) else auth_data["id"]

    existing = (
        await db.execute(
            select(ModuleEnrollment).where(
                ModuleEnrollment.module_id == module_id,
                ModuleEnrollment.student_id == target_student_id,
            )
        )
    ).scalar_one_or_none()

    if not existing:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    await db.delete(existing)
    await db.commit()
    return {"status": "unenrolled", "message": "Successfully unenrolled."}


@router.get("/{module_id}/participants", response_model=list[ModuleParticipantRead])
async def list_participants(
    module_id: int,
    auth_data: dict = Depends(get_current_user_any),
    db: AsyncSession = Depends(get_db),
):
    """List enrolled students in this module."""
    enrollments = (
        await db.execute(
            select(ModuleEnrollment)
            .options(selectinload(ModuleEnrollment.student))
            .where(
                ModuleEnrollment.module_id == module_id,
                ModuleEnrollment.status == "active",
            )
            .order_by(ModuleEnrollment.enrolled_at.desc())
        )
    ).scalars().all()

    return [
        ModuleParticipantRead(
            student_id=enr.student.id,
            name=enr.student.name,
            email=enr.student.email,
            student_code=enr.student.student_code,
            enrolled_at=enr.enrolled_at,
            status=enr.status,
        )
        for enr in enrollments
        if enr.student
    ]


# ============================================================
#  Section Management (Admin)
# ============================================================

@router.post("/{module_id}/sections", response_model=ModuleSectionRead, status_code=status.HTTP_201_CREATED)
async def create_section(
    module_id: int,
    payload: ModuleSectionCreate,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin adds a new section to a module."""
    mod = await db.get(CourseModule, module_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found.")

    sec = ModuleSection(
        module_id=module_id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        order_index=payload.order_index or len(mod.sections),
    )
    db.add(sec)
    await db.commit()
    await db.refresh(sec)

    return ModuleSectionRead(
        id=sec.id,
        module_id=sec.module_id,
        title=sec.title,
        description=sec.description,
        order_index=sec.order_index,
        created_at=sec.created_at,
        items=[],
    )


@router.put("/sections/{section_id}", response_model=ModuleSectionRead)
async def update_section(
    section_id: int,
    payload: ModuleSectionUpdate,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin updates section title/description/order."""
    sec = await db.get(ModuleSection, section_id)
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found.")

    if payload.title is not None:
        sec.title = payload.title.strip()
    if payload.description is not None:
        sec.description = payload.description.strip()
    if payload.order_index is not None:
        sec.order_index = payload.order_index

    await db.commit()
    await db.refresh(sec)

    return ModuleSectionRead(
        id=sec.id,
        module_id=sec.module_id,
        title=sec.title,
        description=sec.description,
        order_index=sec.order_index,
        created_at=sec.created_at,
        items=[],
    )


@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin deletes a section and its items."""
    sec = await db.get(ModuleSection, section_id)
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found.")

    await db.delete(sec)
    await db.commit()
    return None


# ============================================================
#  Item Activities / Resources Management (Admin)
# ============================================================

@router.post("/sections/{section_id}/items", response_model=ModuleItemRead, status_code=status.HTTP_201_CREATED)
async def create_item(
    section_id: int,
    payload: ModuleItemCreate,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin adds an activity or resource to a section:
    - note (Markdown notes)
    - slide (Lecture slides presentation/file)
    - assignment (Assignment with due date, max points)
    - quiz (Interactive quiz with multiple-choice questions)
    - announcement / file (Announcements, PDFs, documents)
    """
    sec = await db.get(ModuleSection, section_id)
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found.")

    item = ModuleItem(
        section_id=section_id,
        item_type=payload.item_type.strip().lower(),
        title=payload.title.strip(),
        description=payload.description.strip(),
        content=payload.content.strip(),
        file_url=payload.file_url,
        file_name=payload.file_name,
        file_size=payload.file_size,
        due_date=payload.due_date,
        max_points=payload.max_points,
        time_limit_minutes=payload.time_limit_minutes,
        order_index=payload.order_index or len(sec.items),
    )
    db.add(item)
    await db.flush()

    # If quiz questions were provided, add them
    quiz_questions_read: list[ModuleItemQuizQuestionRead] = []
    if payload.item_type.lower() == "quiz" and payload.quiz_questions:
        for idx, q in enumerate(payload.quiz_questions):
            qq = ModuleQuizQuestion(
                item_id=item.id,
                question=q.question.strip(),
                option_a=q.option_a.strip(),
                option_b=q.option_b.strip(),
                option_c=q.option_c.strip(),
                option_d=q.option_d.strip(),
                correct_option=q.correct_option,
                explanation=q.explanation.strip(),
                order_index=q.order_index if q.order_index else idx,
            )
            db.add(qq)
            await db.flush()
            quiz_questions_read.append(
                ModuleItemQuizQuestionRead(
                    id=qq.id,
                    question=qq.question,
                    option_a=qq.option_a,
                    option_b=qq.option_b,
                    option_c=qq.option_c,
                    option_d=qq.option_d,
                    correct_option=qq.correct_option,
                    explanation=qq.explanation,
                    order_index=qq.order_index,
                )
            )

    await db.commit()
    await db.refresh(item)

    return ModuleItemRead(
        id=item.id,
        section_id=item.section_id,
        item_type=item.item_type,
        title=item.title,
        description=item.description,
        content=item.content,
        file_url=item.file_url,
        file_name=item.file_name,
        file_size=item.file_size,
        due_date=item.due_date,
        max_points=item.max_points,
        time_limit_minutes=item.time_limit_minutes,
        order_index=item.order_index,
        created_at=item.created_at,
        quiz_questions=quiz_questions_read,
    )


@router.put("/items/{item_id}", response_model=ModuleItemRead)
async def update_item(
    item_id: int,
    payload: ModuleItemUpdate,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin updates an item activity/resource."""
    item = await db.get(ModuleItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, val)

    await db.commit()
    await db.refresh(item)

    return ModuleItemRead(
        id=item.id,
        section_id=item.section_id,
        item_type=item.item_type,
        title=item.title,
        description=item.description,
        content=item.content,
        file_url=item.file_url,
        file_name=item.file_name,
        file_size=item.file_size,
        due_date=item.due_date,
        max_points=item.max_points,
        time_limit_minutes=item.time_limit_minutes,
        order_index=item.order_index,
        created_at=item.created_at,
    )


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin deletes an activity or resource."""
    item = await db.get(ModuleItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")

    await db.delete(item)
    await db.commit()
    return None


# ============================================================
#  Student Quiz Interaction & Submission
# ============================================================

@router.post("/items/{item_id}/quiz/submit", response_model=ModuleQuizResultRead)
async def submit_quiz(
    item_id: int,
    payload: ModuleQuizSubmission,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Student submits answers to a module quiz.
    Automatically grades answers, records attempt, and returns instant results.
    """
    item = await db.get(ModuleItem, item_id)
    if not item or item.item_type != "quiz":
        raise HTTPException(status_code=404, detail="Quiz item not found.")

    questions = (
        (await db.execute(
            select(ModuleQuizQuestion)
            .where(ModuleQuizQuestion.item_id == item_id)
            .order_by(ModuleQuizQuestion.order_index)
        )).scalars().all()
    )

    if not questions:
        raise HTTPException(status_code=400, detail="This quiz has no questions.")

    correct_count = 0
    result_questions: list[ModuleQuizResultQuestion] = []

    for q in questions:
        selected = payload.answers.get(q.id) or payload.answers.get(str(q.id))
        is_correct = selected == q.correct_option
        if is_correct:
            correct_count += 1

        result_questions.append(
            ModuleQuizResultQuestion(
                question_id=q.id,
                question=q.question,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                selected_option=selected,
                correct_option=q.correct_option,
                is_correct=is_correct,
                explanation=q.explanation,
            )
        )

    total = len(questions)
    percentage = round((correct_count / total) * 100) if total else 0

    # Save or update attempt
    existing_attempt = (
        await db.execute(
            select(ModuleQuizAttempt).where(
                ModuleQuizAttempt.item_id == item_id,
                ModuleQuizAttempt.student_id == student.id,
            )
        )
    ).scalar_one_or_none()

    if existing_attempt:
        existing_attempt.score = correct_count
        existing_attempt.total_questions = total
        existing_attempt.percentage = percentage
        existing_attempt.answers_json = json.dumps(payload.answers)
        existing_attempt.completed_at = datetime.now(timezone.utc)
    else:
        attempt = ModuleQuizAttempt(
            item_id=item_id,
            student_id=student.id,
            score=correct_count,
            total_questions=total,
            percentage=percentage,
            answers_json=json.dumps(payload.answers),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(attempt)

    await db.commit()

    return ModuleQuizResultRead(
        score=correct_count,
        total_questions=total,
        percentage=percentage,
        questions=result_questions,
    )


# ============================================================
#  Assignment Submission & Grading
# ============================================================

@router.post("/items/{item_id}/assignment/submit", response_model=ModuleAssignmentSubmissionRead)
async def submit_assignment(
    item_id: int,
    payload: ModuleAssignmentSubmissionCreate,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Student submits an assignment with text response and/or uploaded file."""
    item = await db.get(ModuleItem, item_id)
    if not item or item.item_type != "assignment":
        raise HTTPException(status_code=404, detail="Assignment item not found.")

    sub = (
        await db.execute(
            select(ModuleAssignmentSubmission).where(
                ModuleAssignmentSubmission.item_id == item_id,
                ModuleAssignmentSubmission.student_id == student.id,
            )
        )
    ).scalar_one_or_none()

    if sub:
        sub.submission_text = payload.submission_text.strip()
        if payload.file_url:
            sub.file_url = payload.file_url
            sub.file_name = payload.file_name
        sub.status = "submitted"
        sub.submitted_at = datetime.now(timezone.utc)
    else:
        sub = ModuleAssignmentSubmission(
            item_id=item_id,
            student_id=student.id,
            submission_text=payload.submission_text.strip(),
            file_url=payload.file_url,
            file_name=payload.file_name,
            status="submitted",
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(sub)

    await db.commit()
    await db.refresh(sub)

    return ModuleAssignmentSubmissionRead(
        id=sub.id,
        item_id=sub.item_id,
        student_id=sub.student_id,
        submission_text=sub.submission_text,
        file_url=sub.file_url,
        file_name=sub.file_name,
        status=sub.status,
        grade=sub.grade,
        feedback=sub.feedback,
        submitted_at=sub.submitted_at,
        graded_at=sub.graded_at,
        student_name=student.name,
        student_code=student.student_code,
    )


@router.get("/items/{item_id}/assignment/submissions", response_model=list[ModuleAssignmentSubmissionRead])
async def list_assignment_submissions(
    item_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin views all student submissions for an assignment."""
    subs = (
        (await db.execute(
            select(ModuleAssignmentSubmission)
            .options(selectinload(ModuleAssignmentSubmission.student))
            .where(ModuleAssignmentSubmission.item_id == item_id)
            .order_by(ModuleAssignmentSubmission.submitted_at.desc())
        )).scalars().all()
    )

    return [
        ModuleAssignmentSubmissionRead(
            id=s.id,
            item_id=s.item_id,
            student_id=s.student_id,
            submission_text=s.submission_text,
            file_url=s.file_url,
            file_name=s.file_name,
            status=s.status,
            grade=s.grade,
            feedback=s.feedback,
            submitted_at=s.submitted_at,
            graded_at=s.graded_at,
            student_name=s.student.name if s.student else "",
            student_code=s.student.student_code if s.student else "",
        )
        for s in subs
    ]


@router.post("/items/{item_id}/assignment/grade", response_model=ModuleAssignmentSubmissionRead)
async def grade_assignment_submission(
    item_id: int,
    payload: ModuleAssignmentGradeCreate,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin grades a student assignment submission."""
    sub = await db.get(ModuleAssignmentSubmission, payload.submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")

    sub.grade = payload.grade
    sub.feedback = payload.feedback.strip()
    sub.status = "graded"
    sub.graded_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(sub)

    student = await db.get(Student, sub.student_id)

    return ModuleAssignmentSubmissionRead(
        id=sub.id,
        item_id=sub.item_id,
        student_id=sub.student_id,
        submission_text=sub.submission_text,
        file_url=sub.file_url,
        file_name=sub.file_name,
        status=sub.status,
        grade=sub.grade,
        feedback=sub.feedback,
        submitted_at=sub.submitted_at,
        graded_at=sub.graded_at,
        student_name=student.name if student else "",
        student_code=student.student_code if student else "",
    )


# ============================================================
#  Gradebook & Progress
# ============================================================

def _calculate_student_100pt_pillars(
    student_id: int,
    student_name: str,
    student_code: str,
    email: str,
    exam_grade: ModuleExamGrade | None,
    quiz_attempts: list[ModuleQuizAttempt],
    assignment_subs: list[tuple[ModuleAssignmentSubmission, ModuleItem]],
    weekly_vivas: list[ModuleWeeklyVivaEvaluation],
) -> StudentFinalGradeRow:
    """Calculates student 100-point weighted grade breakdown across the 4 core pillars:

    1. Written Physical Exams (60% weight: Mid-term 25%, End-term 35%)
    2. Weekly Post-Lecture AI Vivas (10% weight: lecture retention checks)
    3. Uploaded Assignments + AI Viva Defense (15% weight)
    4. Presentation or Quizzes (15% weight: manual presentation mark or quiz avg)
    """
    # 1. Physical Written Exams (60 pts)
    mid_exam = float(exam_grade.mid_exam_score) if exam_grade else 0.0
    end_exam = float(exam_grade.end_exam_score) if exam_grade else 0.0
    written_exams_score = round((mid_exam * 0.25) + (end_exam * 0.35), 1)

    # 2. Weekly AI Knowledge Check Vivas (10 pts)
    if weekly_vivas:
        viva_scores = [w.score for w in weekly_vivas]
        weekly_vivas_avg = sum(viva_scores) / len(viva_scores)
        weekly_vivas_score = round((weekly_vivas_avg / 100.0) * 10.0, 1)
    else:
        weekly_vivas_avg = 0.0
        weekly_vivas_score = 0.0

    # 3. Uploaded Assignments + AI Viva Defense (15 pts)
    if assignment_subs:
        combined_asgn_list = []
        for sub, itm in assignment_subs:
            base_written = (
                (sub.grade / itm.max_points * 100.0)
                if (sub.grade is not None and itm.max_points)
                else 75.0
            )
            if sub.defense_score is not None:
                combined = (base_written * 0.6) + (sub.defense_score * 0.4)
            else:
                combined = base_written
            combined_asgn_list.append(combined)

        assignments_avg = sum(combined_asgn_list) / len(combined_asgn_list)
        assignments_score = round((assignments_avg / 100.0) * 15.0, 1)
    else:
        assignments_avg = 0.0
        assignments_score = 0.0

    # 4. Presentation or Quizzes (15 pts)
    presentation_val = float(exam_grade.presentation_score) if (exam_grade and exam_grade.presentation_score is not None) else None
    if quiz_attempts:
        quiz_avg = sum(att.percentage for att in quiz_attempts) / len(quiz_attempts)
    else:
        quiz_avg = 0.0

    if presentation_val is not None:
        pres_or_quiz_pct = presentation_val
    else:
        pres_or_quiz_pct = quiz_avg

    presentation_or_quizzes_score = round((pres_or_quiz_pct / 100.0) * 15.0, 1)

    # 5. Aggregate 100-Point Final Grade
    total_score = round(
        written_exams_score + weekly_vivas_score + assignments_score + presentation_or_quizzes_score, 1
    )

    if total_score >= 85.0:
        letter = "A+"
    elif total_score >= 80.0:
        letter = "A"
    elif total_score >= 75.0:
        letter = "A-"
    elif total_score >= 70.0:
        letter = "B+"
    elif total_score >= 65.0:
        letter = "B"
    elif total_score >= 60.0:
        letter = "B-"
    elif total_score >= 55.0:
        letter = "C+"
    elif total_score >= 50.0:
        letter = "C"
    elif total_score >= 45.0:
        letter = "C-"
    elif total_score >= 40.0:
        letter = "D"
    else:
        letter = "F"

    if total_score >= 50.0:
        status_str = "Passed"
    elif mid_exam == 0.0 and end_exam == 0.0:
        status_str = "In Progress"
    else:
        status_str = "Failed"

    pillars = StudentPillarGradeBreakdown(
        written_exams_score=written_exams_score,
        weekly_vivas_score=weekly_vivas_score,
        assignments_score=assignments_score,
        presentation_or_quizzes_score=presentation_or_quizzes_score,
        total_score=total_score,
        letter_grade=letter,
        status=status_str,
    )

    return StudentFinalGradeRow(
        student_id=student_id,
        student_name=student_name,
        student_code=student_code,
        email=email,
        mid_exam=mid_exam,
        end_exam=end_exam,
        presentation=presentation_val,
        quizzes_avg=round(quiz_avg, 1),
        weekly_vivas_avg=round(weekly_vivas_avg, 1),
        assignments_avg=round(assignments_avg, 1),
        pillars=pillars,
    )


@router.get("/{module_id}/grades")
async def get_module_grades(
    module_id: int,
    auth_data: dict = Depends(get_current_user_any),
    db: AsyncSession = Depends(get_db),
):
    """
    Get grades for this module according to the 100-Point Formula:
    - 60% Mid & End Written Physical Exams
    - 10% Weekly Post-Lecture AI Vivas (retention from lectures)
    - 15% Uploaded Assignments + AI Viva Defense
    - 15% Presentation or Quizzes
    - Total: 100 Points + Letter Grade
    """
    mod = await db.get(CourseModule, module_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found.")

    is_student = auth_data["role"] == "student"
    current_user_id = auth_data["id"]

    # Gather all module items
    gradable_items: list[ModuleItem] = []
    item_ids: list[int] = []
    for sec in mod.sections:
        for itm in sec.items:
            item_ids.append(itm.id)
            if itm.item_type in ("quiz", "assignment"):
                gradable_items.append(itm)

    formula_weights = {
        "written_exams": 60,
        "weekly_vivas": 10,
        "assignments_and_defense": 15,
        "presentation_or_quizzes": 15,
        "total": 100,
    }

    if is_student:
        # Student personal grades & breakdown
        grades: list[ModuleGradeItemRead] = []
        for itm in gradable_items:
            if itm.item_type == "quiz":
                attempt = (
                    await db.execute(
                        select(ModuleQuizAttempt).where(
                            ModuleQuizAttempt.item_id == itm.id,
                            ModuleQuizAttempt.student_id == current_user_id,
                        )
                    )
                ).scalar_one_or_none()

                if attempt:
                    grades.append(
                        ModuleGradeItemRead(
                            item_id=itm.id,
                            title=itm.title,
                            item_type="quiz",
                            max_points=attempt.total_questions,
                            score=attempt.score,
                            percentage=attempt.percentage,
                            status="attempted",
                            submitted_at=attempt.completed_at,
                            feedback=f"Scored {attempt.score} out of {attempt.total_questions}",
                        )
                    )
                else:
                    grades.append(
                        ModuleGradeItemRead(
                            item_id=itm.id,
                            title=itm.title,
                            item_type="quiz",
                            max_points=100,
                            score=None,
                            percentage=None,
                            status="not_attempted",
                        )
                    )

            elif itm.item_type == "assignment":
                sub = (
                    await db.execute(
                        select(ModuleAssignmentSubmission).where(
                            ModuleAssignmentSubmission.item_id == itm.id,
                            ModuleAssignmentSubmission.student_id == current_user_id,
                        )
                    )
                ).scalar_one_or_none()

                if sub:
                    pct = round((sub.grade / itm.max_points) * 100) if (sub.grade is not None and itm.max_points) else None
                    grades.append(
                        ModuleGradeItemRead(
                            item_id=itm.id,
                            title=itm.title,
                            item_type="assignment",
                            max_points=itm.max_points,
                            score=sub.grade,
                            percentage=pct,
                            status=sub.status,
                            submitted_at=sub.submitted_at,
                            feedback=sub.feedback or (f"AI Viva Defense Score: {sub.defense_score}%" if sub.defense_score else ""),
                        )
                    )
                else:
                    grades.append(
                        ModuleGradeItemRead(
                            item_id=itm.id,
                            title=itm.title,
                            item_type="assignment",
                            max_points=itm.max_points,
                            score=None,
                            percentage=None,
                            status="not_submitted",
                        )
                    )

        # Compute student 100pt final grade
        student = await db.get(Student, current_user_id)
        exam_q = select(ModuleExamGrade).where(
            ModuleExamGrade.module_id == module_id,
            ModuleExamGrade.student_id == current_user_id,
        )
        exam_grade = (await db.execute(exam_q)).scalar_one_or_none()

        quiz_q = select(ModuleQuizAttempt).where(
            ModuleQuizAttempt.item_id.in_(item_ids) if item_ids else False,
            ModuleQuizAttempt.student_id == current_user_id,
        )
        quizzes = (await db.execute(quiz_q)).scalars().all() if item_ids else []

        asgn_q = (
            select(ModuleAssignmentSubmission, ModuleItem)
            .join(ModuleItem, ModuleAssignmentSubmission.item_id == ModuleItem.id)
            .where(
                ModuleAssignmentSubmission.item_id.in_(item_ids) if item_ids else False,
                ModuleAssignmentSubmission.student_id == current_user_id,
            )
        )
        asgns = (await db.execute(asgn_q)).all() if item_ids else []

        viva_q = select(ModuleWeeklyVivaEvaluation).where(
            ModuleWeeklyVivaEvaluation.item_id.in_(item_ids) if item_ids else False,
            ModuleWeeklyVivaEvaluation.student_id == current_user_id,
        )
        vivas = (await db.execute(viva_q)).scalars().all() if item_ids else []

        my_grade = _calculate_student_100pt_pillars(
            student_id=student.id if student else current_user_id,
            student_name=student.name if student else "Student",
            student_code=student.student_code if student else "STU",
            email=student.email if student else "",
            exam_grade=exam_grade,
            quiz_attempts=quizzes,
            assignment_subs=asgns,
            weekly_vivas=vivas,
        )

        return {
            "role": "student",
            "grades": grades,
            "my_grade": my_grade,
            "formula_weights": formula_weights,
        }

    else:
        # Admin Gradebook: returns detailed item matrix + full 100-Point Weighted Gradebook
        enrollments = (
            await db.execute(
                select(ModuleEnrollment)
                .options(selectinload(ModuleEnrollment.student))
                .where(
                    ModuleEnrollment.module_id == module_id,
                    ModuleEnrollment.status == "active",
                )
                .order_by(ModuleEnrollment.enrolled_at.asc())
            )
        ).scalars().all()

        columns = [
            {"id": itm.id, "title": itm.title, "type": itm.item_type, "max_points": itm.max_points}
            for itm in gradable_items
        ]

        rows = []
        final_gradebook: list[StudentFinalGradeRow] = []

        for enr in enrollments:
            student = enr.student
            if not student:
                continue

            # Detailed item grades for table
            student_grades = {}
            for itm in gradable_items:
                if itm.item_type == "quiz":
                    att = (
                        await db.execute(
                            select(ModuleQuizAttempt).where(
                                ModuleQuizAttempt.item_id == itm.id,
                                ModuleQuizAttempt.student_id == student.id,
                            )
                        )
                    ).scalar_one_or_none()
                    student_grades[itm.id] = {
                        "score": att.score if att else None,
                        "percentage": att.percentage if att else None,
                        "status": "attempted" if att else "not_attempted",
                    }
                elif itm.item_type == "assignment":
                    sub = (
                        await db.execute(
                            select(ModuleAssignmentSubmission).where(
                                ModuleAssignmentSubmission.item_id == itm.id,
                                ModuleAssignmentSubmission.student_id == student.id,
                            )
                        )
                    ).scalar_one_or_none()
                    student_grades[itm.id] = {
                        "score": sub.grade if sub else None,
                        "percentage": round((sub.grade / itm.max_points) * 100) if (sub and sub.grade is not None and itm.max_points) else None,
                        "defense_score": sub.defense_score if sub else None,
                        "status": sub.status if sub else "not_submitted",
                    }

            rows.append({
                "student_id": student.id,
                "student_name": student.name,
                "student_code": student.student_code,
                "email": student.email,
                "grades": student_grades,
            })

            # Fetch exam marks, quizzes, assignments, weekly vivas for this student
            exam_q = select(ModuleExamGrade).where(
                ModuleExamGrade.module_id == module_id,
                ModuleExamGrade.student_id == student.id,
            )
            exam_grade = (await db.execute(exam_q)).scalar_one_or_none()

            quiz_q = select(ModuleQuizAttempt).where(
                ModuleQuizAttempt.item_id.in_(item_ids) if item_ids else False,
                ModuleQuizAttempt.student_id == student.id,
            )
            quizzes = (await db.execute(quiz_q)).scalars().all() if item_ids else []

            asgn_q = (
                select(ModuleAssignmentSubmission, ModuleItem)
                .join(ModuleItem, ModuleAssignmentSubmission.item_id == ModuleItem.id)
                .where(
                    ModuleAssignmentSubmission.item_id.in_(item_ids) if item_ids else False,
                    ModuleAssignmentSubmission.student_id == student.id,
                )
            )
            asgns = (await db.execute(asgn_q)).all() if item_ids else []

            viva_q = select(ModuleWeeklyVivaEvaluation).where(
                ModuleWeeklyVivaEvaluation.item_id.in_(item_ids) if item_ids else False,
                ModuleWeeklyVivaEvaluation.student_id == student.id,
            )
            vivas = (await db.execute(viva_q)).scalars().all() if item_ids else []

            student_row = _calculate_student_100pt_pillars(
                student_id=student.id,
                student_name=student.name,
                student_code=student.student_code,
                email=student.email,
                exam_grade=exam_grade,
                quiz_attempts=quizzes,
                assignment_subs=asgns,
                weekly_vivas=vivas,
            )
            final_gradebook.append(student_row)

        return {
            "role": "admin",
            "columns": columns,
            "rows": rows,
            "final_gradebook": final_gradebook,
            "formula_weights": formula_weights,
        }


@router.post("/{module_id}/grades/exams/{student_id}", response_model=ModuleExamGradeRead)
async def update_student_exam_grades(
    module_id: int,
    student_id: int,
    payload: ModuleExamGradeUpdate,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin / Lecturer records or updates physical written exam marks (Mid, End) and presentation scores for a student."""
    mod = await db.get(CourseModule, module_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found.")

    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    exam_q = select(ModuleExamGrade).where(
        ModuleExamGrade.module_id == module_id,
        ModuleExamGrade.student_id == student_id,
    )
    exam_grade = (await db.execute(exam_q)).scalar_one_or_none()

    now_utc = datetime.utcnow()
    if exam_grade:
        exam_grade.mid_exam_score = payload.mid_exam_score
        exam_grade.end_exam_score = payload.end_exam_score
        exam_grade.presentation_score = payload.presentation_score
        exam_grade.notes = payload.notes
        exam_grade.updated_at = now_utc
    else:
        exam_grade = ModuleExamGrade(
            module_id=module_id,
            student_id=student_id,
            mid_exam_score=payload.mid_exam_score,
            end_exam_score=payload.end_exam_score,
            presentation_score=payload.presentation_score,
            notes=payload.notes,
            updated_at=now_utc,
        )
        db.add(exam_grade)

    await db.commit()
    await db.refresh(exam_grade)

    return exam_grade
