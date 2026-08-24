from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List


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
    debug: bool = True
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://datapilot:datapilot_secret@localhost:5432/datapilot"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "insecure_dev_secret_change_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    # File Upload
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 100

    # Ollama (Phase 2+)
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "llama3.2"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
