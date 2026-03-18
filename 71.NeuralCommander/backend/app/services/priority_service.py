"""
Priority Scoring Service
========================
Computes a numeric priority score for academic tasks using:

    score = w1 * urgency(deadline) + w2 * difficulty_score

urgency is a decaying function of hours-to-deadline.
"""
from datetime import datetime, timezone
import math
from typing import Optional

# Weights (tunable)
W_URGENCY = 0.6
W_DIFFICULTY = 0.4
MAX_HOURS = 168  # 1 week = baseline urgency reference


def compute_priority_score(
    deadline: Optional[datetime],
    difficulty_score: float,
    now: Optional[datetime] = None,
) -> float:
    """Return a 0–10 priority score."""
    if now is None:
        now = datetime.now(timezone.utc)

    urgency = 0.0
    if deadline is not None:
        # Ensure timezone-aware comparison
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        hours_left = (deadline - now).total_seconds() / 3600
        if hours_left <= 0:
            urgency = 10.0  # overdue
        else:
            # Exponential decay: urgency rises as deadline approaches
            urgency = 10.0 * math.exp(-hours_left / MAX_HOURS * 4)

    difficulty_normalized = min(difficulty_score / 10.0, 1.0) * 10.0
    score = W_URGENCY * urgency + W_DIFFICULTY * difficulty_normalized
    return round(min(score, 10.0), 3)


def assign_priority_label(score: float) -> str:
    if score >= 7.5:
        return "critical"
    elif score >= 5.0:
        return "high"
    elif score >= 2.5:
        return "medium"
    return "low"
