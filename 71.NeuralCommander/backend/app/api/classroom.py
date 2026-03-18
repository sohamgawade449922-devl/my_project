"""Google Classroom sync router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import Task, User
from app.schemas.schemas import TaskRead
from app.services.classroom_service import fetch_classroom_tasks
from typing import List

router = APIRouter()


@router.post("/sync/{user_id}", response_model=List[TaskRead])
async def sync_classroom(user_id: int, db: AsyncSession = Depends(get_db)):
    """
    Fetch assignments from Google Classroom for the given user
    and upsert them as Task records.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.google_access_token:
        raise HTTPException(status_code=400, detail="Google account not connected")

    raw_tasks = fetch_classroom_tasks(user.google_access_token, user.google_refresh_token)

    upserted = []
    for raw in raw_tasks:
        # Check for existing assignment
        existing = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.classroom_assignment_id == raw["classroom_assignment_id"],
            )
        )
        task: Task | None = existing.scalar_one_or_none()
        if task:
            for k, v in raw.items():
                setattr(task, k, v)
        else:
            task = Task(user_id=user_id, **raw)
            db.add(task)
        upserted.append(task)

    await db.flush()
    return upserted
