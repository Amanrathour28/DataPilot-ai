import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List, Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "DataPilot AI"
    app_env: str = "development"
    debug: bool = False
    allowed_origins: str = "http://localhost:5173,http://localhost:3000,https://datapilot-ai.vercel.app"

    # Database
    database_url: str = "postgresql+asyncpg://datapilot:datapilot_secret@localhost:5432/datapilot"

    @property
    def async_database_url(self) -> str:
        """Ensure the connection string is asyncpg-ready and Neon-compatible."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        
        # Replace sslmode with asyncpg compatible ssl
        if "sslmode=require" in url:
            url = url.replace("sslmode=require", "ssl=require")
        return url

    # Redis (Optional in serverless)
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "datapilot_production_jwt_secret_change_me_in_vercel"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    # File Upload (Uses /tmp in Vercel serverless environments)
    upload_dir: str = "/tmp/uploads" if (os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")) else "uploads"
    max_upload_size_mb: int = 100

    # Optional Cloud LLM (OpenAI / Groq / OpenRouter)
    openai_api_key: Optional[str] = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    groq_api_key: Optional[str] = None

    # Local Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "llama3.2"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
