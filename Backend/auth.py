"""
Authentication utilities — password hashing and JWT token management.

Users log in with email + password. On success they receive a JWT that
identifies them and their role (student or admin) for subsequent API calls.
"""

import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Student, Admin

# ============================================================
#  Configuration
# ============================================================

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ============================================================
#  Password helpers
# ============================================================

def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain, hashed)


# ============================================================
#  JWT helpers
# ============================================================

def create_access_token(user_id: int, role: str) -> str:
    """Create a JWT access token for the given user (student or admin)."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_student(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Student:
    """
    FastAPI dependency: extract the current student from the JWT token.
    Raises 401 if the token is missing or invalid.
    Raises 403 if the user is not a student.
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if user_id is None or role is None:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        if role != "student":
            raise HTTPException(status_code=403, detail="Access denied. Student role required.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    student = await db.get(Student, int(user_id))
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    return student


async def get_current_admin(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """
    FastAPI dependency: extract the current admin from the JWT token.
    Raises 401 if the token is missing or invalid.
    Raises 403 if the user is not an admin.
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if user_id is None or role is None:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        if role != "admin":
            raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    admin = await db.get(Admin, int(user_id))
    if admin is None:
        raise HTTPException(status_code=404, detail="Admin not found.")
    return admin


async def get_current_user_any(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    FastAPI dependency: extract current user (student or admin).
    Returns dict: {"user": Student | Admin, "role": "student" | "admin", "id": int}
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if user_id is None or role is None:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    uid = int(user_id)
    if role == "admin":
        admin = await db.get(Admin, uid)
        if admin is None:
            raise HTTPException(status_code=404, detail="Admin not found.")
        return {"user": admin, "role": "admin", "id": uid}
    elif role == "student":
        student = await db.get(Student, uid)
        if student is None:
            raise HTTPException(status_code=404, detail="Student not found.")
        return {"user": student, "role": "student", "id": uid}
    else:
        raise HTTPException(status_code=403, detail="Unknown role.")

