"""
Google Classroom OAuth2 & Sync Service
========================================
Fetches courses and coursework from Google Classroom API and
upserts them as Task records in the database.
"""
import logging
from typing import Any, Dict, List

import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.config import settings
from app.services.priority_service import assign_priority_label, compute_priority_score

logger = logging.getLogger(__name__)

CLASSROOM_SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
]


def get_google_auth_url() -> str:
    """Return the Google OAuth2 authorization URL."""
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        client_config={
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            }
        },
        scopes=CLASSROOM_SCOPES,
    )
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    auth_url, _ = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    return auth_url


def exchange_code_for_tokens(code: str) -> Dict[str, str]:
    """Exchange OAuth2 authorization code for access + refresh tokens."""
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        client_config={
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            }
        },
        scopes=CLASSROOM_SCOPES,
    )
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
    }


def fetch_classroom_tasks(access_token: str, refresh_token: str) -> List[Dict[str, Any]]:
    """
    Fetch all coursework assignments for the authenticated student.
    Returns a list of dicts ready to be converted to Task models.
    """
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
    )
    service = build("classroom", "v1", credentials=creds, cache_discovery=False)

    courses_result = service.courses().list(studentId="me", courseStates=["ACTIVE"]).execute()
    courses = courses_result.get("courses", [])

    tasks = []
    for course in courses:
        course_id = course["id"]
        course_name = course.get("name", "Unknown Course")
        cw_result = (
            service.courses()
            .courseWork()
            .list(courseId=course_id, orderBy="dueDate asc")
            .execute()
        )
        for cw in cw_result.get("courseWork", []):
            due = cw.get("dueDate")
            deadline = None
            if due:
                from datetime import datetime, timezone

                deadline = datetime(
                    year=due.get("year", 2025),
                    month=due.get("month", 1),
                    day=due.get("day", 1),
                    tzinfo=timezone.utc,
                )
            difficulty = float(cw.get("maxPoints", 100)) / 100.0 * 10  # rough heuristic
            score = compute_priority_score(deadline, difficulty)
            tasks.append(
                {
                    "title": cw.get("title", "Untitled"),
                    "description": cw.get("description"),
                    "course_name": course_name,
                    "deadline": deadline,
                    "difficulty_score": difficulty,
                    "priority_score": score,
                    "priority": assign_priority_label(score),
                    "classroom_assignment_id": cw["id"],
                }
            )
    return tasks
