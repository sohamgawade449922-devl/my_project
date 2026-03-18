"""
Focus Session router
====================
Start / stop focus sessions and report bypass events.
The RL loop in the Neural Engine adjusts lock difficulty based on
the bypass_count tracked here.
"""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.notifications import _focus_active
from app.db.session import get_db
from app.models.models import FocusSession
from app.schemas.schemas import FocusSessionCreate, FocusSessionRead

router = APIRouter()

MAX_DIFFICULTY = 5


@router.post("/{user_id}/start", response_model=FocusSessionRead, status_code=201)
async def start_focus(
    user_id: int,
    payload: FocusSessionCreate,
    db: AsyncSession = Depends(get_db),
):
    _focus_active[user_id] = True
    session = FocusSession(user_id=user_id, start_time=payload.start_time)
    db.add(session)
    await db.flush()
    return session


@router.post("/{session_id}/stop", response_model=FocusSessionRead)
async def stop_focus(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FocusSession).where(FocusSession.id == session_id))
    session: FocusSession | None = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.end_time = datetime.now(timezone.utc)
    session.completed = True
    _focus_active[session.user_id] = False
    return session


@router.post("/{session_id}/bypass", response_model=FocusSessionRead)
async def report_bypass(session_id: int, db: AsyncSession = Depends(get_db)):
    """
    Called by the Android app each time the user bypasses the app lock.
    Increments bypass count and escalates lock difficulty (RL reward signal).
    """
    result = await db.execute(select(FocusSession).where(FocusSession.id == session_id))
    session: FocusSession | None = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.bypass_count += 1
    # RL: increase difficulty every 2 bypasses, capped at MAX_DIFFICULTY
    session.lock_difficulty = min(
        MAX_DIFFICULTY, 1 + session.bypass_count // 2
    )
    return session


@router.get("/{user_id}", response_model=List[FocusSessionRead])
async def list_sessions(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FocusSession)
        .where(FocusSession.user_id == user_id)
        .order_by(FocusSession.start_time.desc())
        .limit(30)
    )
    return result.scalars().all()
