"""
Reinforcement Learning Agent – Focus Session Lock Difficulty
============================================================
Implements a simple Q-learning / tabular RL loop that adapts
the App Lock difficulty based on the user's bypass history.

State  : (bypass_count_in_session,)  → discretized to bins
Action : increase | keep | decrease lock_difficulty
Reward : +1 for completed session with 0 bypasses,
         -1 per bypass within a session,
         +0.5 for session completed regardless

This is intentionally lightweight and designed to run on-device
or as a backend microservice without GPU requirements.
"""
import json
import logging
import os
from pathlib import Path
from typing import Dict

import numpy as np

logger = logging.getLogger(__name__)

# RL hyper-parameters
ALPHA = 0.1   # learning rate
GAMMA = 0.9   # discount factor
EPSILON = 0.1 # exploration rate
MAX_DIFFICULTY = 5
MIN_DIFFICULTY = 1

# Bypass count bins: [0, 1, 2, 3, 4+]
BYPASS_BINS = [0, 1, 2, 3, 4]
N_STATES = len(BYPASS_BINS)
N_ACTIONS = 3  # 0=decrease, 1=keep, 2=increase

QTABLE_PATH = Path("neural_engine/models/rl_qtable.json")


class FocusRLAgent:
    """Per-user RL agent that adapts lock difficulty from bypass history."""

    def __init__(self):
        # user_id → {"q_table": np.array, "difficulty": int}
        self._user_states: Dict[int, dict] = {}
        self._load_all()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load_all(self) -> None:
        if QTABLE_PATH.exists():
            try:
                with QTABLE_PATH.open() as f:
                    raw = json.load(f)
                for uid_str, data in raw.items():
                    self._user_states[int(uid_str)] = {
                        "q_table": np.array(data["q_table"]),
                        "difficulty": data["difficulty"],
                    }
                logger.info("RL agent: loaded %d user tables", len(self._user_states))
            except Exception as exc:
                logger.warning("Could not load RL Q-tables: %s", exc)

    def _save_all(self) -> None:
        QTABLE_PATH.parent.mkdir(parents=True, exist_ok=True)
        serializable = {
            str(uid): {
                "q_table": state["q_table"].tolist(),
                "difficulty": state["difficulty"],
            }
            for uid, state in self._user_states.items()
        }
        with QTABLE_PATH.open("w") as f:
            json.dump(serializable, f)

    def _get_or_create(self, user_id: int) -> dict:
        if user_id not in self._user_states:
            self._user_states[user_id] = {
                "q_table": np.zeros((N_STATES, N_ACTIONS)),
                "difficulty": MIN_DIFFICULTY,
            }
        return self._user_states[user_id]

    # ------------------------------------------------------------------
    # RL Core
    # ------------------------------------------------------------------

    @staticmethod
    def _discretize(bypass_count: int) -> int:
        return min(bypass_count, N_STATES - 1)

    def _choose_action(self, q_row: np.ndarray) -> int:
        if np.random.random() < EPSILON:
            return np.random.randint(N_ACTIONS)
        return int(np.argmax(q_row))

    def _apply_action(self, difficulty: int, action: int) -> int:
        if action == 0:
            return max(MIN_DIFFICULTY, difficulty - 1)
        elif action == 2:
            return min(MAX_DIFFICULTY, difficulty + 1)
        return difficulty  # keep

    def _compute_reward(self, bypass_count: int, completed: bool) -> float:
        reward = -float(bypass_count)
        if completed:
            reward += 0.5
        if completed and bypass_count == 0:
            reward += 1.0
        return reward

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_difficulty(self, user_id: int) -> int:
        state = self._get_or_create(user_id)
        return state["difficulty"]

    def update(self, user_id: int, bypass_count: int, completed: bool = False) -> int:
        """
        Update the Q-table given the outcome of a focus session.
        Returns the new lock difficulty.
        """
        state = self._get_or_create(user_id)
        q_table = state["q_table"]
        current_difficulty = state["difficulty"]

        s = self._discretize(bypass_count)
        action = self._choose_action(q_table[s])
        reward = self._compute_reward(bypass_count, completed)

        # Next state after taking action
        new_difficulty = self._apply_action(current_difficulty, action)
        # Q-learning update: next state reflects difficulty after taking action
        new_bypass_estimate = max(0, bypass_count - 1) if action == 2 else bypass_count
        s_next = self._discretize(new_bypass_estimate)
        q_table[s, action] += ALPHA * (
            reward + GAMMA * np.max(q_table[s_next]) - q_table[s, action]
        )

        state["difficulty"] = new_difficulty
        self._save_all()
        return new_difficulty
