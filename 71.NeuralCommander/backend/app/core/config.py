"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "NeuralCommander"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://neural:neural@db:5432/neuralcommander"
    SYNC_DATABASE_URL: str = "postgresql://neural:neural@db:5432/neuralcommander"

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8081"]

    # Google OAuth2
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # Neural Engine
    NEURAL_ENGINE_URL: str = "http://neural_engine:8001"

    # OpenAI (optional fallback LLM)
    OPENAI_API_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
