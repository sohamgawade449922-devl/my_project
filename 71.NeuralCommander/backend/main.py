"""
NeuralCommander Backend – FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import auth, classroom, tasks, notifications, focus

app = FastAPI(
    title="NeuralCommander API",
    description="Autonomous AI-Agent ecosystem backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(classroom.router, prefix="/api/v1/classroom", tags=["classroom"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(focus.router, prefix="/api/v1/focus", tags=["focus"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "NeuralCommander API"}
