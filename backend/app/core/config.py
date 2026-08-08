from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Broiler Wholesale API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://postgres:root@localhost:5432/mmbroilers"
    production: bool = False
    secret_key: str = "dev-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720
    cors_origins_raw: str = Field(default="*", validation_alias="CORS_ORIGINS")
    allowed_hosts_raw: str = Field(
        default='["localhost","127.0.0.1"]', validation_alias="ALLOWED_HOSTS"
    )

    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_origins_raw.strip()
        if raw == "*":
            return ["*"]
        if raw.startswith("["):
            import json

            return list(json.loads(raw))
        return [part.strip() for part in raw.split(",") if part.strip()]

    @property
    def allowed_hosts(self) -> list[str]:
        raw = self.allowed_hosts_raw.strip()
        if raw.startswith("["):
            import json

            return list(json.loads(raw))
        return [part.strip() for part in raw.split(",") if part.strip()]

    @field_validator("secret_key")
    @classmethod
    def secret_not_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("SECRET_KEY is required")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
