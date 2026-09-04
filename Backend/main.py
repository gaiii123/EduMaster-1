from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv(override=True)

import os
import dashscope

_ds_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
dashscope.api_key = _ds_key
if _ds_key.startswith("sk-ws-") or os.getenv("DASHSCOPE_INTL", "").lower() in ("1", "true", "yes"):
    dashscope.base_http_api_url = "https://dashscope-intl.aliyuncs.com/api/v1"
    dashscope.base_websocket_api_url = "wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference"

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db
import models  # noqa: F401  – registers ORM models with Base.metadata
from routers.evaluation import router as evaluation_router
from routers.students import router as students_router
from routers.auth import router as auth_router
from routers.multimodal import router as multimodal_router
from routers.learning import router as learning_router
from routers.ai_learning import router as ai_learning_router
from routers.modules import router as modules_router
from routers.diagnostic_viva import router as diagnostic_viva_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup, dispose engine on shutdown."""
    await init_db()
    yield


app = FastAPI(
    title="EduMaster API",
    description="Backend API for the EduMaster educational platform.",
    version="0.1.0",
    lifespan=lifespan,
)

# --------------- CORS ---------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory exists
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# --------------- Routers ---------------
app.include_router(evaluation_router)
app.include_router(students_router)
app.include_router(auth_router)
app.include_router(multimodal_router)
app.include_router(learning_router)
app.include_router(ai_learning_router)
app.include_router(modules_router)
app.include_router(diagnostic_viva_router)


# --------------- Health check ---------------
@app.get("/", tags=["health"])
async def health_check():
    return {"status": "ok"}
