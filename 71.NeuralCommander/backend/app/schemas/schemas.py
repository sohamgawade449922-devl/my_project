"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.models import NotificationCategory, TaskPriority


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    course_name: Optional[str] = None
    deadline: Optional[datetime] = None
    difficulty_score: float = 1.0
    classroom_assignment_id: Optional[str] = None


class TaskRead(BaseModel):
    id: int
    title: str
    description: Optional[str]
    course_name: Optional[str]
    deadline: Optional[datetime]
    difficulty_score: float
    priority_score: float
    priority: TaskPriority
    is_completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------
class NotificationIngest(BaseModel):
    package_name: str
    title: Optional[str] = None
    body: Optional[str] = None


class NotificationRead(BaseModel):
    id: int
    package_name: str
    title: Optional[str]
    body: Optional[str]
    category: NotificationCategory
    ai_reply: Optional[str]
    was_suppressed: bool
    received_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Focus Session
# ---------------------------------------------------------------------------
class FocusSessionCreate(BaseModel):
    start_time: datetime


class FocusSessionRead(BaseModel):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    bypass_count: int
    lock_difficulty: int
    completed: bool

    model_config = {"from_attributes": True}
