"""Tasks CRUD router with priority scoring on create/update."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import Task, TaskPriority
from app.schemas.schemas import TaskCreate, TaskRead
from app.services.priority_service import assign_priority_label, compute_priority_score

router = APIRouter()


@router.post("/{user_id}", response_model=TaskRead, status_code=201)
async def create_task(
    user_id: int, payload: TaskCreate, db: AsyncSession = Depends(get_db)
):
    score = compute_priority_score(payload.deadline, payload.difficulty_score)
    label = assign_priority_label(score)
    task = Task(
        user_id=user_id,
        priority_score=score,
        priority=TaskPriority(label),
        **payload.model_dump(),
    )
    db.add(task)
    await db.flush()
    return task


@router.get("/{user_id}", response_model=List[TaskRead])
async def list_tasks(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Task)
        .where(Task.user_id == user_id, Task.is_completed == False)
        .order_by(Task.priority_score.desc())
    )
    return result.scalars().all()


@router.patch("/{task_id}/complete", response_model=TaskRead)
async def complete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task: Task | None = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_completed = True
    return task
