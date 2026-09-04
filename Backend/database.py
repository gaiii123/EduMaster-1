import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# --------------- Database URL ---------------
# Default: local SQLite file.  Set DATABASE_URL env-var for PostgreSQL, etc.
# Examples:
#   PostgreSQL → postgresql+asyncpg://user:pass@localhost/edumaster
#   SQLite     → sqlite+aiosqlite:///./edumaster.db  (default)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./edumaster.db")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# --------------- Base ---------------

class Base(DeclarativeBase):
    pass


# --------------- Dependency ---------------

async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency that yields a DB session and ensures cleanup."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create all tables and auto-migrate missing columns."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def _migrate_multimodal_cols(sync_conn):
            from sqlalchemy import text
            try:
                result = sync_conn.execute(text("PRAGMA table_info(lifecycle_evaluations)"))
                cols = {row[1] for row in result.fetchall()}
                new_cols = {
                    "visual_attentiveness": "INTEGER",
                    "visual_confidence": "INTEGER",
                    "speech_fluency": "INTEGER",
                    "authenticity_notes": "TEXT",
                }
                for col_name, col_type in new_cols.items():
                    if col_name not in cols:
                        sync_conn.execute(text(f"ALTER TABLE lifecycle_evaluations ADD COLUMN {col_name} {col_type}"))
            except Exception:
                pass

        await conn.run_sync(_migrate_multimodal_cols)

        def _migrate_note_source_col(sync_conn):
            from sqlalchemy import text
            try:
                result = sync_conn.execute(text("PRAGMA table_info(notes)"))
                cols = {row[1] for row in result.fetchall()}
                if cols and "source" not in cols:
                    sync_conn.execute(text(
                        "ALTER TABLE notes ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'seed'"
                    ))
            except Exception:
                pass

        await conn.run_sync(_migrate_note_source_col)

        def _migrate_defense_cols(sync_conn):
            from sqlalchemy import text
            try:
                result = sync_conn.execute(text("PRAGMA table_info(module_assignment_submissions)"))
                cols = {row[1] for row in result.fetchall()}
                defense_cols = {
                    "defense_score": "INTEGER",
                    "defense_feedback": "TEXT NOT NULL DEFAULT ''",
                    "defense_transcript_json": "TEXT NOT NULL DEFAULT '[]'",
                    "defense_completed_at": "DATETIME",
                }
                for col_name, col_type in defense_cols.items():
                    if cols and col_name not in cols:
                        sync_conn.execute(text(f"ALTER TABLE module_assignment_submissions ADD COLUMN {col_name} {col_type}"))
            except Exception:
                pass

        await conn.run_sync(_migrate_defense_cols)
