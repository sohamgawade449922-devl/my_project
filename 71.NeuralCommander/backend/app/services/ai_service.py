"""
AI Notification Service
=======================
Calls the Neural Engine microservice to classify a notification and,
when Focus Mode is active, generate an AI auto-reply.
"""
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SOCIAL_PACKAGES = {
    "com.whatsapp",
    "com.instagram.android",
    "com.facebook.katana",
    "com.twitter.android",
    "com.snapchat.android",
}


async def classify_notification(package_name: str, title: str, body: str) -> str:
    """
    Call /classify endpoint on the neural engine.
    Returns: 'Urgent' | 'Academic' | 'Ignore'
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{settings.NEURAL_ENGINE_URL}/classify",
                json={"package_name": package_name, "title": title, "body": body},
            )
            resp.raise_for_status()
            return resp.json().get("category", "Ignore")
    except Exception as exc:
        logger.warning("Neural Engine unreachable, defaulting to Ignore: %s", exc)
        return "Ignore"


async def generate_focus_reply(sender: str, body: str) -> Optional[str]:
    """
    Generate a polite AI auto-reply when Focus Mode is active.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.NEURAL_ENGINE_URL}/generate_reply",
                json={"sender": sender, "message": body},
            )
            resp.raise_for_status()
            return resp.json().get("reply")
    except Exception as exc:
        logger.warning("Could not generate AI reply: %s", exc)
        return (
            "Hey! I'm in focus mode right now. "
            "I'll get back to you when my study session ends. 📚"
        )
