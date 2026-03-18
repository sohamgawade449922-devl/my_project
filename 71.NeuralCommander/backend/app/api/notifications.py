"""
Notifications router
====================
The Android app POSTs intercepted notifications here.
The backend classifies them via the Neural Engine and decides
whether to suppress them and/or send an AI auto-reply.
"""
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import Notification, NotificationCategory
from app.schemas.schemas import NotificationIngest, NotificationRead
from app.services.ai_service import classify_notification, generate_focus_reply

router = APIRouter()

# In-memory focus state per user (production: use Redis)
_focus_active: dict[int, bool] = {}


@router.post("/{user_id}", response_model=NotificationRead, status_code=201)
async def ingest_notification(
    user_id: int,
    payload: NotificationIngest,
    db: AsyncSession = Depends(get_db),
):
    category_str = await classify_notification(
        payload.package_name,
        payload.title or "",
        payload.body or "",
    )
    category = NotificationCategory(category_str)

    # Determine suppression & AI reply
    suppress = False
    ai_reply = None
    focus_on = _focus_active.get(user_id, False)

    if focus_on and category == NotificationCategory.IGNORE:
        suppress = True
        ai_reply = await generate_focus_reply(
            payload.title or "Friend", payload.body or ""
        )

    notif = Notification(
        user_id=user_id,
        package_name=payload.package_name,
        title=payload.title,
        body=payload.body,
        category=category,
        ai_reply=ai_reply,
        was_suppressed=suppress,
    )
    db.add(notif)
    await db.flush()
    return notif


@router.get("/{user_id}", response_model=List[NotificationRead])
async def list_notifications(
    user_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.received_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
