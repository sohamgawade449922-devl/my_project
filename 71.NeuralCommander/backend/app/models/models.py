"""
SQLAlchemy ORM models for NeuralCommander.

Tables
------
users               – app users
tasks               – academic tasks / assignments
notifications       – intercepted device notifications
focus_sessions      – focus/study session records
semantic_memories   – vector embeddings of tasks/events (pgvector)
"""
from datetime import datetime
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------
import enum


class NotificationCategory(str, enum.Enum):
    URGENT = "Urgent"
    ACADEMIC = "Academic"
    IGNORE = "Ignore"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    google_access_token: Mapped[Optional[str]] = mapped_column(Text)
    google_refresh_token: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="owner")
    focus_sessions: Mapped[list["FocusSession"]] = relationship("FocusSession", back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="user")


# ---------------------------------------------------------------------------
# Task (Academic)
# ---------------------------------------------------------------------------
class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    course_name: Mapped[Optional[str]] = mapped_column(String(255))
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    difficulty_score: Mapped[float] = mapped_column(Float, default=1.0)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0)
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority), default=TaskPriority.MEDIUM
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    classroom_assignment_id: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="tasks")


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------
class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    package_name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(512))
    body: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[NotificationCategory] = mapped_column(
        Enum(NotificationCategory), default=NotificationCategory.IGNORE
    )
    ai_reply: Mapped[Optional[str]] = mapped_column(Text)
    was_suppressed: Mapped[bool] = mapped_column(Boolean, default=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="notifications")


# ---------------------------------------------------------------------------
# Focus Session
# ---------------------------------------------------------------------------
class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    bypass_count: Mapped[int] = mapped_column(Integer, default=0)
    lock_difficulty: Mapped[int] = mapped_column(Integer, default=1)  # 1–5 scale
    completed: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship("User", back_populates="focus_sessions")


# ---------------------------------------------------------------------------
# Semantic Memory (pgvector)
# ---------------------------------------------------------------------------
class SemanticMemory(Base):
    __tablename__ = "semantic_memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # 384-dim MiniLM-L6 embeddings
    embedding: Mapped[Vector] = mapped_column(Vector(384))
    source: Mapped[str] = mapped_column(String(64), default="task")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
