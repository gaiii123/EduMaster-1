"""
SQLAlchemy ORM models and Pydantic schemas for the IT Student Evaluation system.

Tables
------
- Student              → IT students enrolled in the platform.
- Admin                → Platform administrators.
- LifecycleEvaluation  → Per-stage AI-driven evaluations for each student.

Relationship
------------
Student  1 ←→ many  LifecycleEvaluation
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# ============================================================
#  SQLAlchemy ORM Models
# ============================================================

class Student(Base):
    """An IT student enrolled in the evaluation platform."""

    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    student_code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Bcrypt-hashed password for student login.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # --- relationships ---
    evaluations: Mapped[list[LifecycleEvaluation]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    module_enrollments: Mapped[list[ModuleEnrollment]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Student id={self.id} name={self.name!r}>"


class Admin(Base):
    """A platform administrator with access to manage students and view evaluations."""

    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Bcrypt-hashed password for admin login.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Admin id={self.id} name={self.name!r}>"


class LifecycleEvaluation(Base):
    """
    A stage-based AI evaluation of a student's IT project lifecycle.

    Mastery scores are integers in the 0-100 range covering four key
    competency dimensions of an IT project.
    """

    __tablename__ = "lifecycle_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    # --- evaluation metadata ---
    stage: Mapped[str] = mapped_column(
        String(80), nullable=False, index=True,
        comment="Project lifecycle stage, e.g. 'requirements', 'development', 'testing', 'deployment'.",
    )
    evaluation_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    ai_diagnostic_notes: Mapped[str] = mapped_column(
        Text, nullable=True,
        comment="AI-generated diagnostic feedback and recommendations.",
    )

    # --- mastery scores (0-100 integers) ---
    mastery_logic_and_syntax: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Mastery score for logic and syntax (0-100).",
    )
    mastery_api_architecture: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Mastery score for API architecture (0-100).",
    )
    mastery_frontend_state: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Mastery score for frontend state management (0-100).",
    )
    mastery_database_integration: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Mastery score for database integration (0-100).",
    )

    # --- Alibaba multimodal audio/video telemetry ---
    visual_attentiveness: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None,
        comment="Visual attentiveness score (0-100) from Alibaba Qwen-VL.",
    )
    visual_confidence: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None,
        comment="Visual confidence/composure score (0-100) from Alibaba Qwen-VL.",
    )
    speech_fluency: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None,
        comment="Speech fluency score (0-100) from Alibaba SenseVoice.",
    )
    authenticity_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None,
        comment="Proctoring & authenticity observations from multimodal analysis.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # --- relationships ---
    student: Mapped[Student] = relationship(back_populates="evaluations")

    def __repr__(self) -> str:
        return (
            f"<LifecycleEvaluation id={self.id} student_id={self.student_id} "
            f"stage={self.stage!r}>"
        )


class Subject(Base):
    """A learning subject mapped to one of the four mastery dimensions."""

    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    icon: Mapped[str] = mapped_column(String(8), nullable=False, default="\U0001F4D8")
    skill_key: Mapped[str] = mapped_column(
        String(40), nullable=False, index=True,
        comment="Mastery dimension key: logic | api | frontend | database.",
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # --- relationships ---
    notes: Mapped[list[Note]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Note.order_index",
    )

    def __repr__(self) -> str:
        return f"<Subject id={self.id} title={self.title!r}>"


class Note(Base):
    """A study note (Markdown content) belonging to a subject."""

    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subject_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Markdown body of the note.",
    )
    reading_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="seed",
        comment="Origin of the note: seed | ai | photo.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # --- relationships ---
    subject: Mapped[Subject] = relationship(back_populates="notes")
    quiz_questions: Mapped[list[QuizQuestion]] = relationship(
        back_populates="note",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="QuizQuestion.order_index",
    )

    def __repr__(self) -> str:
        return f"<Note id={self.id} title={self.title!r}>"


class QuizQuestion(Base):
    """A multiple-choice question attached to a note (4 options, one correct)."""

    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    option_a: Mapped[str] = mapped_column(String(500), nullable=False)
    option_b: Mapped[str] = mapped_column(String(500), nullable=False)
    option_c: Mapped[str] = mapped_column(String(500), nullable=False)
    option_d: Mapped[str] = mapped_column(String(500), nullable=False)
    correct_option: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="1-4, matching option_a through option_d.",
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # --- relationships ---
    note: Mapped[Note] = relationship(back_populates="quiz_questions")

    def __repr__(self) -> str:
        return f"<QuizQuestion id={self.id} note_id={self.note_id}>"


class NoteProgress(Base):
    """Per-student read/bookmark state for a note."""

    __tablename__ = "note_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "note_id", name="uq_note_progress_student_note"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_bookmarked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<NoteProgress student_id={self.student_id} note_id={self.note_id} "
            f"read={self.is_read} bookmarked={self.is_bookmarked}>"
        )


class CourseModule(Base):
    """A university course module created by an admin (e.g. Networking 1, Big Data)."""

    __tablename__ = "course_modules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(40), nullable=False, index=True)  # e.g. "NET 101", "INTE 31283"
    title: Mapped[str] = mapped_column(String(200), nullable=False)  # e.g. "Networking 1"
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    level: Mapped[str] = mapped_column(String(50), nullable=False, default="Level I")  # "Level I", "Level II", "Level III", "Miscellaneous"
    academic_year: Mapped[str] = mapped_column(String(30), nullable=False, default="23/24")
    banner_pattern: Mapped[str] = mapped_column(String(50), nullable=False, default="networking")  # theme / illustration style
    banner_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by_admin_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # --- relationships ---
    sections: Mapped[list[ModuleSection]] = relationship(
        back_populates="module",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ModuleSection.order_index",
    )
    enrollments: Mapped[list[ModuleEnrollment]] = relationship(
        back_populates="module",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<CourseModule id={self.id} code={self.code!r} title={self.title!r}>"


class ModuleEnrollment(Base):
    """Enrollment record linking a student to a course module."""

    __tablename__ = "module_enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "module_id", name="uq_student_module_enrollment"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    module_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("course_modules.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    # --- relationships ---
    student: Mapped[Student] = relationship(back_populates="module_enrollments")
    module: Mapped[CourseModule] = relationship(back_populates="enrollments")

    def __repr__(self) -> str:
        return f"<ModuleEnrollment student_id={self.student_id} module_id={self.module_id}>"


class ModuleSection(Base):
    """A topic/section in a course module (e.g. General, Introduction, Topic 1)."""

    __tablename__ = "module_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    module_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("course_modules.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # --- relationships ---
    module: Mapped[CourseModule] = relationship(back_populates="sections")
    items: Mapped[list[ModuleItem]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ModuleItem.order_index",
    )

    def __repr__(self) -> str:
        return f"<ModuleSection id={self.id} title={self.title!r}>"


class ModuleItem(Base):
    """An activity or resource inside a module section (note, slide, assignment, quiz, announcement, file)."""

    __tablename__ = "module_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    section_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("module_sections.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    item_type: Mapped[str] = mapped_column(
        String(40), nullable=False,
        comment="note | slide | assignment | quiz | announcement | file",
    )
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")  # Markdown or body
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    file_size: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    max_points: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # --- relationships ---
    section: Mapped[ModuleSection] = relationship(back_populates="items")
    quiz_questions: Mapped[list[ModuleQuizQuestion]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ModuleQuizQuestion.order_index",
    )
    quiz_attempts: Mapped[list[ModuleQuizAttempt]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    assignment_submissions: Mapped[list[ModuleAssignmentSubmission]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    diagnostic_evaluations: Mapped[list["ModuleDiagnosticEvaluation"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    weekly_viva_evaluations: Mapped[list["ModuleWeeklyVivaEvaluation"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<ModuleItem id={self.id} type={self.item_type!r} title={self.title!r}>"


class ModuleQuizQuestion(Base):
    """A multiple-choice question attached to a module quiz item."""

    __tablename__ = "module_quiz_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("module_items.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    option_a: Mapped[str] = mapped_column(String(500), nullable=False)
    option_b: Mapped[str] = mapped_column(String(500), nullable=False)
    option_c: Mapped[str] = mapped_column(String(500), nullable=False)
    option_d: Mapped[str] = mapped_column(String(500), nullable=False)
    correct_option: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-4
    explanation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # --- relationships ---
    item: Mapped[ModuleItem] = relationship(back_populates="quiz_questions")

    def __repr__(self) -> str:
        return f"<ModuleQuizQuestion id={self.id} item_id={self.item_id}>"


class ModuleQuizAttempt(Base):
    """Student's attempt and score on a module quiz."""

    __tablename__ = "module_quiz_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("module_items.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    answers_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # --- relationships ---
    item: Mapped[ModuleItem] = relationship(back_populates="quiz_attempts")
    student: Mapped[Student] = relationship()

    def __repr__(self) -> str:
        return f"<ModuleQuizAttempt id={self.id} student_id={self.student_id} score={self.score}>"


class ModuleAssignmentSubmission(Base):
    """A student's submission to an assignment."""

    __tablename__ = "module_assignment_submissions"
    __table_args__ = (
        UniqueConstraint("item_id", "student_id", name="uq_student_assignment_submission"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("module_items.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    submission_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="submitted")  # "submitted" | "graded"
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    feedback: Mapped[str] = mapped_column(Text, nullable=False, default="")
    defense_score: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)  # AI Viva Defense score (0-100)
    defense_feedback: Mapped[str] = mapped_column(Text, nullable=False, default="")
    defense_transcript_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    defense_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    # --- relationships ---
    item: Mapped[ModuleItem] = relationship(back_populates="assignment_submissions")
    student: Mapped[Student] = relationship()

    def __repr__(self) -> str:
        return f"<ModuleAssignmentSubmission id={self.id} student_id={self.student_id} status={self.status}>"


class ModuleDiagnosticEvaluation(Base):
    """A formative, non-graded diagnostic AI viva evaluation conducted before starting a week/section.

    Provides actionable teaching intelligence to the lecturer on student strengths,
    knowledge gaps, and misconceptions.
    """

    __tablename__ = "module_diagnostic_evaluations"
    __table_args__ = (
        UniqueConstraint("item_id", "student_id", name="uq_student_diagnostic_eval"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("module_items.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    section_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("module_sections.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    knowledge_level: Mapped[str] = mapped_column(
        String(50), nullable=False, default="Developing"
    )  # "Proficient" | "Developing" | "Needs Guidance" | "Foundations"
    readiness_score: Mapped[int] = mapped_column(
        Integer, nullable=False, default=50
    )  # Formative readiness index (0-100)
    strong_areas: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]"
    )  # JSON list of strings
    weak_areas: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]"
    )  # JSON list of strings
    misconceptions: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]"
    )  # JSON list of strings
    diagnostic_summary: Mapped[str] = mapped_column(
        Text, nullable=False, default=""
    )  # Conceptual evaluation
    ai_recommendation: Mapped[str] = mapped_column(
        Text, nullable=False, default=""
    )  # Student study advice + lecturer lecture focus
    transcript_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]"
    )  # Full viva turns
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # --- relationships ---
    item: Mapped[ModuleItem] = relationship(back_populates="diagnostic_evaluations")
    section: Mapped[ModuleSection] = relationship()
    student: Mapped[Student] = relationship()

    def __repr__(self) -> str:
        return f"<ModuleDiagnosticEvaluation id={self.id} student_id={self.student_id} level={self.knowledge_level}>"


class ModuleWeeklyVivaEvaluation(Base):
    """A graded post-lecture AI viva evaluation testing lecture retention and mastery.

    Contributes 10% to the final module grade.
    """

    __tablename__ = "module_weekly_viva_evaluations"
    __table_args__ = (
        UniqueConstraint("item_id", "student_id", name="uq_student_weekly_viva_eval"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("module_items.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    section_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("module_sections.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=70)  # Graded score (0-100)
    knowledge_level: Mapped[str] = mapped_column(
        String(50), nullable=False, default="Proficient"
    )  # "Mastered" | "Proficient" | "Developing" | "Needs Revision"
    mastered_topics: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON list
    retained_gaps: Mapped[str] = mapped_column(Text, nullable=False, default="[]")    # JSON list
    feedback: Mapped[str] = mapped_column(Text, nullable=False, default="")
    transcript_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # --- relationships ---
    item: Mapped[ModuleItem] = relationship(back_populates="weekly_viva_evaluations")
    section: Mapped[ModuleSection] = relationship()
    student: Mapped[Student] = relationship()

    def __repr__(self) -> str:
        return f"<ModuleWeeklyVivaEvaluation id={self.id} student_id={self.student_id} score={self.score}>"


class ModuleExamGrade(Base):
    """Tracks written physical exam scores (60%) and presentation scores (15%) for a student in a module."""

    __tablename__ = "module_exam_grades"
    __table_args__ = (
        UniqueConstraint("module_id", "student_id", name="uq_module_student_exam"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    module_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("course_modules.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    mid_exam_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)    # Mid-Term Exam (0-100)
    end_exam_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)    # End-Semester Written Exam (0-100)
    presentation_score: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)  # Presentation mark (0-100, optional)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # --- relationships ---
    module: Mapped[CourseModule] = relationship()
    student: Mapped[Student] = relationship()

    def __repr__(self) -> str:
        return f"<ModuleExamGrade student_id={self.student_id} mid={self.mid_exam_score} end={self.end_exam_score}>"


# ============================================================
#  Pydantic Schemas  (request / response DTOs)
# ============================================================

# ----- Student schemas -----

class StudentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120, description="Full name of the student.")
    email: str = Field(..., max_length=255, description="Unique email address.")
    student_code: str = Field(..., max_length=60, description="Unique student identification code.")


class StudentCreate(StudentBase):
    """Schema for creating a new student (admin enrolls)."""
    password: str = Field(
        ..., min_length=6, max_length=128,
        description="Initial password the student will use to log in.",
    )


class StudentRead(StudentBase):
    """Schema returned when reading a student (no password)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class StudentLogin(BaseModel):
    """Credentials a student submits to log in."""
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    """JWT returned on successful login."""
    access_token: str
    token_type: str = "bearer"
    user: dict  # Can be StudentRead or AdminRead with role field
    role: str  # "student" or "admin"


# ----- Admin schemas -----

class AdminBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120, description="Full name of the admin.")
    email: str = Field(..., max_length=255, description="Unique email address.")


class AdminCreate(AdminBase):
    """Schema for creating a new admin."""
    password: str = Field(
        ..., min_length=6, max_length=128,
        description="Initial password the admin will use to log in.",
    )


class AdminRead(AdminBase):
    """Schema returned when reading an admin (no password)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class AdminLogin(BaseModel):
    """Credentials an admin submits to log in."""
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


# ----- Mastery-score validator mixin -----

class _MasteryScores(BaseModel):
    """Shared mastery-score fields with 0-100 integer validation."""
    mastery_logic_and_syntax: int = Field(
        ..., ge=0, le=100, description="Logic and syntax mastery (0-100).",
    )
    mastery_api_architecture: int = Field(
        ..., ge=0, le=100, description="API architecture mastery (0-100).",
    )
    mastery_frontend_state: int = Field(
        ..., ge=0, le=100, description="Frontend state management mastery (0-100).",
    )
    mastery_database_integration: int = Field(
        ..., ge=0, le=100, description="Database integration mastery (0-100).",
    )


# ----- LifecycleEvaluation schemas -----

class LifecycleEvaluationBase(_MasteryScores):
    stage: str = Field(
        ..., min_length=1, max_length=80,
        description="Project lifecycle stage (e.g. 'requirements', 'development', 'testing', 'deployment').",
    )
    evaluation_date: date = Field(..., description="Date the evaluation was performed.")
    ai_diagnostic_notes: str | None = Field(
        None, description="AI-generated diagnostic feedback.",
    )
    visual_attentiveness: int | None = Field(
        None, ge=0, le=100, description="Visual attentiveness score (0-100) from Alibaba Qwen-VL.",
    )
    visual_confidence: int | None = Field(
        None, ge=0, le=100, description="Visual confidence/composure score (0-100) from Alibaba Qwen-VL.",
    )
    speech_fluency: int | None = Field(
        None, ge=0, le=100, description="Speech fluency score (0-100) from Alibaba SenseVoice.",
    )
    authenticity_notes: str | None = Field(
        None, description="Observations on authenticity and proctoring.",
    )


class LifecycleEvaluationCreate(LifecycleEvaluationBase):
    """Schema for creating a new evaluation (student_id passed in the URL, not the body)."""


class LifecycleEvaluationRead(LifecycleEvaluationBase):
    """Schema returned when reading an evaluation."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    created_at: datetime
    updated_at: datetime


# ----- Learning schemas -----

class SubjectRead(BaseModel):
    """A subject with per-student progress counters."""
    id: int
    title: str
    description: str
    icon: str
    skill_key: str
    order_index: int
    note_count: int = 0
    read_count: int = 0


class NoteSummaryRead(BaseModel):
    """A note listed inside a subject (no full content)."""
    id: int
    subject_id: int
    title: str
    summary: str
    reading_minutes: int
    order_index: int
    source: str = "seed"
    is_read: bool = False
    is_bookmarked: bool = False


class SubjectDetailRead(BaseModel):
    """A subject with its ordered notes."""
    id: int
    title: str
    description: str
    icon: str
    skill_key: str
    notes: list[NoteSummaryRead] = []


class QuizQuestionRead(BaseModel):
    """A quiz question as presented to the student (answer withheld)."""
    id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str


class NoteRead(NoteSummaryRead):
    """Full note content plus its quiz."""
    content: str
    quiz_questions: list[QuizQuestionRead] = []


class QuizAnswerItem(BaseModel):
    """One answered question in a quiz submission."""
    question_id: int
    selected_option: int = Field(..., ge=1, le=4)


class QuizSubmission(BaseModel):
    """Payload submitted when a student finishes a note quiz."""
    answers: list[QuizAnswerItem]


class QuizQuestionResult(BaseModel):
    """Per-question grading outcome (answer revealed after submission)."""
    question_id: int
    selected_option: int
    correct_option: int
    is_correct: bool


class QuizResult(BaseModel):
    """Graded quiz outcome."""
    score: int
    total: int
    percentage: int
    results: list[QuizQuestionResult]


class SubjectProgressRead(BaseModel):
    """Completion stats for one subject."""
    subject_id: int
    title: str
    icon: str
    note_count: int
    read_count: int
    percent: int


class BookmarkRead(BaseModel):
    """A bookmarked note entry."""
    note_id: int
    title: str
    subject_id: int
    subject_title: str
    updated_at: datetime


class RecentNoteRead(BaseModel):
    """A recently touched note (drives 'Continue reading')."""
    note_id: int
    title: str
    subject_id: int
    subject_title: str
    is_read: bool
    updated_at: datetime


class MyProgressRead(BaseModel):
    """Aggregated learning progress for the current student."""
    total_notes: int
    read_count: int
    completion_percent: int
    subject_progress: list[SubjectProgressRead]
    bookmarks: list[BookmarkRead]
    recent_notes: list[RecentNoteRead]


class SearchHitRead(BaseModel):
    """A single note search result."""
    note_id: int
    subject_id: int
    title: str
    subject_title: str
    snippet: str


# ============================================================
#  Course Module & Learning Schemas
# ============================================================

class CourseModuleBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=40, description="Course/Module code (e.g. NET 101).")
    title: str = Field(..., min_length=1, max_length=200, description="Course/Module title.")
    description: str = Field("", description="Module overview / syllabus description.")
    level: str = Field("Level I", max_length=50, description="Category / level (e.g. Level I, Level II, Level III, Miscellaneous).")
    academic_year: str = Field("23/24", max_length=30, description="Academic year / term (e.g. 23/24).")
    banner_pattern: str = Field("networking", max_length=50, description="Visual theme style.")
    banner_image_url: str | None = Field(None, max_length=500, description="Optional custom image URL.")
    is_published: bool = Field(True, description="Whether the module is visible.")


class CourseModuleCreate(CourseModuleBase):
    """Payload to create a new module."""
    pass


class CourseModuleUpdate(BaseModel):
    """Payload to update an existing module."""
    code: str | None = None
    title: str | None = None
    description: str | None = None
    level: str | None = None
    academic_year: str | None = None
    banner_pattern: str | None = None
    banner_image_url: str | None = None
    is_published: bool | None = None


class ModuleItemQuizQuestionCreate(BaseModel):
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: int = Field(..., ge=1, le=4)
    explanation: str = ""
    order_index: int = 0


class ModuleItemQuizQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: int | None = None  # Revealed after submission or for admin
    explanation: str = ""
    order_index: int = 0


class ModuleAssignmentSubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    item_id: int
    student_id: int
    submission_text: str = ""
    file_url: str | None = None
    file_name: str = ""
    status: str = "submitted"
    grade: int | None = None
    feedback: str = ""
    defense_score: int | None = None
    defense_feedback: str = ""
    defense_transcript_json: str = "[]"
    defense_completed_at: datetime | None = None
    submitted_at: datetime
    graded_at: datetime | None = None
    student_name: str | None = None
    student_code: str | None = None


class ModuleQuizAttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    item_id: int
    student_id: int
    score: int
    total_questions: int
    percentage: int
    completed_at: datetime


class ModuleItemCreate(BaseModel):
    item_type: str = Field(..., description="note | slide | assignment | quiz | announcement | file")
    title: str = Field(..., min_length=1, max_length=250)
    description: str = ""
    content: str = ""
    file_url: str | None = None
    file_name: str = ""
    file_size: str = ""
    due_date: datetime | None = None
    max_points: int = 100
    time_limit_minutes: int = 15
    order_index: int = 0
    quiz_questions: list[ModuleItemQuizQuestionCreate] = []


class ModuleItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    content: str | None = None
    file_url: str | None = None
    file_name: str | None = None
    file_size: str | None = None
    due_date: datetime | None = None
    max_points: int | None = None
    time_limit_minutes: int | None = None
    order_index: int | None = None


class ModuleItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    section_id: int
    item_type: str
    title: str
    description: str = ""
    content: str = ""
    file_url: str | None = None
    file_name: str = ""
    file_size: str = ""
    due_date: datetime | None = None
    max_points: int = 100
    time_limit_minutes: int = 15
    order_index: int = 0
    created_at: datetime
    quiz_questions: list[ModuleItemQuizQuestionRead] = []
    my_submission: ModuleAssignmentSubmissionRead | None = None
    my_quiz_attempt: ModuleQuizAttemptRead | None = None
    submissions_count: int = 0


class ModuleSectionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    order_index: int = 0


class ModuleSectionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    order_index: int | None = None


class ModuleSectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    module_id: int
    title: str
    description: str = ""
    order_index: int = 0
    created_at: datetime
    items: list[ModuleItemRead] = []


class CourseModuleRead(CourseModuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    enrolled_count: int = 0
    is_enrolled: bool = False
    section_count: int = 0
    item_count: int = 0


class CourseModuleDetailRead(CourseModuleRead):
    sections: list[ModuleSectionRead] = []


class ModuleParticipantRead(BaseModel):
    student_id: int
    name: str
    email: str
    student_code: str
    enrolled_at: datetime
    status: str = "active"


class ModuleQuizSubmission(BaseModel):
    answers: dict[int, int]  # question_id -> selected_option (1-4)


class ModuleQuizResultQuestion(BaseModel):
    question_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    selected_option: int | None
    correct_option: int
    is_correct: bool
    explanation: str = ""


class ModuleQuizResultRead(BaseModel):
    score: int
    total_questions: int
    percentage: int
    questions: list[ModuleQuizResultQuestion]


class ModuleAssignmentSubmissionCreate(BaseModel):
    submission_text: str = ""
    file_url: str | None = None
    file_name: str = ""


class ModuleAssignmentGradeCreate(BaseModel):
    submission_id: int
    grade: int = Field(..., ge=0, le=100)
    feedback: str = ""


class ModuleGradeItemRead(BaseModel):
    item_id: int
    title: str
    item_type: str  # quiz or assignment
    max_points: int
    score: int | None = None
    percentage: int | None = None
    status: str  # "submitted", "graded", "attempted", "not_attempted"
    submitted_at: datetime | None = None
    feedback: str = ""


# ----- Pre-Week Diagnostic AI Viva Schemas -----

class DiagnosticVivaTurn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class DiagnosticVivaRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10_000)
    history: list[DiagnosticVivaTurn] = Field(default_factory=list)
    finish_early: bool = False


class DiagnosticEvaluationRead(BaseModel):
    id: int
    item_id: int
    section_id: int
    student_id: int
    knowledge_level: str
    readiness_score: int
    strong_areas: list[str]
    weak_areas: list[str]
    misconceptions: list[str]
    diagnostic_summary: str
    ai_recommendation: str
    transcript: list[DiagnosticVivaTurn] = Field(default_factory=list)
    completed_at: datetime

    model_config = {"from_attributes": True}


class DiagnosticVivaResponse(BaseModel):
    feedback: str
    next_question: str | None = None
    turn_count: int
    is_completed: bool = False
    evaluation: DiagnosticEvaluationRead | None = None


class StudentDiagnosticCard(BaseModel):
    student_id: int
    student_name: str
    student_code: str
    knowledge_level: str
    readiness_score: int
    strong_areas: list[str]
    weak_areas: list[str]
    misconceptions: list[str]
    diagnostic_summary: str
    ai_recommendation: str
    completed_at: datetime
    transcript: list[DiagnosticVivaTurn] = Field(default_factory=list)


class SectionLecturerInsightsRead(BaseModel):
    section_id: int
    section_title: str
    module_id: int
    module_code: str
    module_title: str
    total_enrolled: int
    total_assessed: int
    average_readiness: int
    strong_topics: list[dict]
    weak_topics: list[dict]
    common_misconceptions: list[str]
    lecture_focus_recommendations: list[str]
    students: list[StudentDiagnosticCard]
    learning_growth: dict | None = None  # Compares pre-lecture baseline vs post-lecture mastery


# ----- Post-Lecture Weekly AI Knowledge Check Viva Schemas -----

class WeeklyVivaTurn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class WeeklyVivaRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10_000)
    history: list[WeeklyVivaTurn] = Field(default_factory=list)
    finish_early: bool = False


class WeeklyVivaEvaluationRead(BaseModel):
    id: int
    item_id: int
    section_id: int
    student_id: int
    score: int  # 0-100 graded
    knowledge_level: str
    mastered_topics: list[str]
    retained_gaps: list[str]
    feedback: str
    transcript: list[WeeklyVivaTurn] = Field(default_factory=list)
    completed_at: datetime

    model_config = {"from_attributes": True}


class WeeklyVivaResponse(BaseModel):
    feedback: str
    next_question: str | None = None
    turn_count: int
    is_completed: bool = False
    evaluation: WeeklyVivaEvaluationRead | None = None


# ----- Assignment AI Viva Defense Schemas -----

class AssignmentDefenseTurn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class AssignmentDefenseRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10_000)
    history: list[AssignmentDefenseTurn] = Field(default_factory=list)
    finish_early: bool = False


class AssignmentDefenseResponse(BaseModel):
    feedback: str
    next_question: str | None = None
    turn_count: int
    is_completed: bool = False
    defense_score: int | None = None
    defense_feedback: str = ""
    transcript: list[AssignmentDefenseTurn] = Field(default_factory=list)


# ----- Final 100-Point Weighted Grading Schemas -----

class ModuleExamGradeUpdate(BaseModel):
    mid_exam_score: float = Field(..., ge=0.0, le=100.0)
    end_exam_score: float = Field(..., ge=0.0, le=100.0)
    presentation_score: float | None = Field(None, ge=0.0, le=100.0)
    notes: str = ""


class ModuleExamGradeRead(BaseModel):
    id: int
    module_id: int
    student_id: int
    mid_exam_score: float
    end_exam_score: float
    presentation_score: float | None = None
    notes: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class StudentPillarGradeBreakdown(BaseModel):
    written_exams_score: float = 0.0      # Out of 60.0 (Mid 25% + End 35%)
    weekly_vivas_score: float = 0.0       # Out of 10.0 (Average of post-lecture weekly vivas)
    assignments_score: float = 0.0        # Out of 15.0 (Assignments + AI viva defense)
    presentation_or_quizzes_score: float = 0.0  # Out of 15.0 (Presentation or quiz average)
    total_score: float = 0.0              # Out of 100.0
    letter_grade: str = "F"               # "A+", "A", "B", etc.
    status: str = "In Progress"           # "Passed" | "Conditional" | "Incomplete" | "Failed"


class StudentFinalGradeRow(BaseModel):
    student_id: int
    student_name: str
    student_code: str
    email: str
    mid_exam: float = 0.0
    end_exam: float = 0.0
    presentation: float | None = None
    quizzes_avg: float = 0.0
    weekly_vivas_avg: float = 0.0
    assignments_avg: float = 0.0
    pillars: StudentPillarGradeBreakdown


class ModuleFinalGradebookRead(BaseModel):
    module_id: int
    module_code: str
    module_title: str
    role: str  # "admin" | "student"
    formula_weights: dict = {
        "written_exams": 60,
        "weekly_vivas": 10,
        "assignments_and_defense": 15,
        "presentation_or_quizzes": 15,
        "total": 100,
    }
    rows: list[StudentFinalGradeRow] = Field(default_factory=list)
    my_grade: StudentFinalGradeRow | None = None



