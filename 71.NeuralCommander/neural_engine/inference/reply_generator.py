"""
AI Reply Generator
==================
Generates a polite focus-mode auto-reply.

Strategy (in order of availability):
  1. OpenAI GPT via LangChain
  2. Local LLM via LangChain Ollama
  3. Static templated reply
"""
import logging
import os
import random

logger = logging.getLogger(__name__)

TEMPLATES = [
    "Hey {sender}! 📚 I'm deep in a study session right now. I'll reply when I'm done!",
    "Hi {sender}, I'm in focus mode. Talk soon! 🔕",
    "Study mode ON 📖 – I'll get back to you shortly, {sender}!",
    "Can't chat right now, {sender} – focusing hard. Catch you later! 🎯",
]


class ReplyGenerator:
    """Generates an auto-reply for incoming messages during focus mode."""

    def __init__(self):
        self._chain = None
        self._try_init_llm()

    def _try_init_llm(self) -> None:
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key:
            try:
                from langchain_openai import ChatOpenAI
                from langchain.prompts import ChatPromptTemplate

                llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.7, api_key=openai_key)
                prompt = ChatPromptTemplate.from_messages(
                    [
                        (
                            "system",
                            "You are a polite assistant. The user is in focus/study mode. "
                            "Write a short, friendly auto-reply (max 2 sentences) telling "
                            "{sender} that the user is studying and will reply later.",
                        ),
                        ("human", "Message from {sender}: {message}"),
                    ]
                )
                self._chain = prompt | llm
                logger.info("ReplyGenerator using OpenAI GPT")
            except Exception as exc:
                logger.warning("OpenAI LangChain init failed: %s", exc)

    def generate(self, sender: str, message: str) -> str:
        if self._chain is not None:
            try:
                result = self._chain.invoke({"sender": sender, "message": message})
                return result.content.strip()
            except Exception as exc:
                logger.warning("LLM reply generation failed: %s", exc)
        # Fallback to template
        return random.choice(TEMPLATES).format(sender=sender)
