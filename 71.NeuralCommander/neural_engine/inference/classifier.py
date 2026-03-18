"""
BERT-based Intent Classifier
==============================
Classifies a notification into one of three categories:
  - Urgent
  - Academic
  - Ignore

Uses a fine-tuned MiniLM sentence transformer (fast, lightweight).
Falls back to rule-based classification when the model is not loaded.
"""
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Social app package names → likely Ignore
SOCIAL_PACKAGES = {
    "com.whatsapp",
    "com.instagram.android",
    "com.snapchat.android",
    "com.twitter.android",
    "com.facebook.katana",
    "com.tiktok.android",
}

# Keywords that suggest urgency
URGENT_KEYWORDS = re.compile(
    r"\b(urgent|asap|deadline|emergency|critical|immediately|now|help)\b",
    re.IGNORECASE,
)
# Keywords that suggest academic content
ACADEMIC_KEYWORDS = re.compile(
    r"\b(assignment|homework|exam|quiz|lecture|submission|grade|marks|"
    r"classroom|course|professor|faculty|due|study)\b",
    re.IGNORECASE,
)

# Label map consistent with the backend enum
LABELS = ["Urgent", "Academic", "Ignore"]


class IntentClassifier:
    """
    Wraps a sentence-transformers model for zero-shot or fine-tuned
    3-class notification intent classification.

    On startup it attempts to load a fine-tuned model from
    ``neural_engine/models/intent_classifier``.  If that path does not
    exist it falls back to rule-based heuristics so the service remains
    functional without heavy model files.
    """

    def __init__(self, model_path: str = "neural_engine/models/intent_classifier"):
        self._model = None
        self._tokenizer = None
        self._try_load_model(model_path)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _try_load_model(self, model_path: str) -> None:
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            import torch

            self._tokenizer = AutoTokenizer.from_pretrained(model_path)
            self._model = AutoModelForSequenceClassification.from_pretrained(model_path)
            self._model.eval()
            logger.info("Intent classifier loaded from %s", model_path)
        except Exception as exc:
            logger.warning(
                "Could not load fine-tuned model (%s). Using rule-based fallback.", exc
            )

    def _rule_based(self, package_name: str, title: str, body: str) -> str:
        text = f"{title} {body}"
        if URGENT_KEYWORDS.search(text):
            return "Urgent"
        if ACADEMIC_KEYWORDS.search(text) or "com.google.android.apps.classroom" == package_name:
            return "Academic"
        if package_name in SOCIAL_PACKAGES:
            return "Ignore"
        return "Ignore"

    def _model_predict(self, text: str) -> str:
        import torch

        inputs = self._tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=128,
            padding=True,
        )
        with torch.no_grad():
            logits = self._model(**inputs).logits
        idx = int(torch.argmax(logits, dim=-1).item())
        return LABELS[idx % len(LABELS)]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, package_name: str, title: str, body: str) -> str:
        """Return one of 'Urgent', 'Academic', 'Ignore'."""
        if self._model is not None and self._tokenizer is not None:
            text = f"App: {package_name}. {title}. {body}"
            try:
                return self._model_predict(text)
            except Exception as exc:
                logger.warning("Model inference failed, using rules: %s", exc)
        return self._rule_based(package_name, title, body)
