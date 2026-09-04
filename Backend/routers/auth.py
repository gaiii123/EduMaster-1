"""
Authentication router — unified login for students and admins.

Endpoints
---------
POST /api/auth/login  → user logs in with email + password, receives JWT with role
GET  /api/auth/me     → get current user profile (requires JWT)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth import (
    create_access_token,
    get_current_student,
    get_current_admin,
    verify_password,
)
from database import get_db
from models import (
    Student,
    Admin,
    StudentLogin,
    StudentRead,
    AdminRead,
    TokenResponse,
)
from placement import build_placement

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)


@router.post("/login", response_model=TokenResponse)
async def login(payload: StudentLogin, db: AsyncSession = Depends(get_db)):
    """
    Unified login for students and admins.
    Checks both tables and returns JWT with role.
    """
    from sqlalchemy import select
    
    # Try student first
    result = await db.execute(select(Student).where(Student.email == payload.email))
    student = result.scalar_one_or_none()
    
    if student and verify_password(payload.password, student.password_hash):
        access_token = create_access_token(student.id, "student")
        return TokenResponse(
            access_token=access_token,
            user=StudentRead.model_validate(student).model_dump(),
            role="student",
        )
    
    # Try admin
    result = await db.execute(select(Admin).where(Admin.email == payload.email))
    admin = result.scalar_one_or_none()
    
    if admin and verify_password(payload.password, admin.password_hash):
        access_token = create_access_token(admin.id, "admin")
        return TokenResponse(
            access_token=access_token,
            user=AdminRead.model_validate(admin).model_dump(),
            role="admin",
        )
    
    raise HTTPException(status_code=401, detail="Invalid email or password.")


@router.get("/me", response_model=dict)
async def get_me(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(lambda request: request.headers.get("Authorization", "").replace("Bearer ", "")),
):
    """
    Get the current user's profile (student or admin).
    Requires a valid JWT token.
    """
    from jose import jwt, JWTError
    from auth import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        role = payload.get("role")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    
    if role == "student":
        from sqlalchemy import select
        result = await db.execute(select(Student).where(Student.id == user_id))
        student = result.scalar_one()
        placement = build_placement(student.evaluations)
        return {
            "user": StudentRead.model_validate(student).model_dump(),
            "role": "student",
            "placement": placement,
        }
    elif role == "admin":
        from sqlalchemy import select
        result = await db.execute(select(Admin).where(Admin.id == user_id))
        admin = result.scalar_one()
        return {
            "user": AdminRead.model_validate(admin).model_dump(),
            "role": "admin",
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid role.")
