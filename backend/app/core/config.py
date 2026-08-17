import json
from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def parse_list_setting(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        if stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                inner = stripped.strip("[]")
                return [item.strip().strip('"') for item in inner.split(",") if item.strip()]
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
            return [str(parsed).strip()]
        return [item.strip() for item in stripped.split(",") if item.strip()]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


class Settings(BaseSettings):
    app_name: str = "Broiler Wholesale API"
    api_v1_prefix: str = "/api/v1"
    
    # DATABASE
    postgres_user: str = "postgres"
    postgres_password: str = "root"
    postgres_server: str = "localhost"
    postgres_port: str = "5432"
    postgres_db: str = "MM_Poultry"

    # SECURITY
    production: bool = False
    secret_key: str = ""
    backup_secret_key: str = ""
    algorithm: str = "HS256"
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
    def async_database_url(self) -> str:
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_server}:{self.postgres_port}/{self.postgres_db}"
    
    @property
    def sync_database_url(self) -> str:
        return f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}@{self.postgres_server}:{self.postgres_port}/{self.postgres_db}"

    @property
    def cors_origins(self) -> list[str]:
        return parse_list_setting(self.cors_origins_raw)

    @property
    def allowed_hosts(self) -> list[str]:
        return parse_list_setting(self.allowed_hosts_raw)

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if not self.production:
            return self

        if (
            not self.secret_key
            or self.secret_key == "dev-secret-change-me-in-production"
            or len(self.secret_key) < 32
        ):
            raise ValueError(
                "SECRET_KEY must be set to a strong value with at least 32 characters in production"
            )
        if self.cors_origins == ["*"]:
            self.cors_origins_raw = ""
        if not self.cors_origins:
            raise ValueError("CORS_ORIGINS must be explicitly set in production")
        
        # In production, we typically don't allow wildcard hosts
        if not self.allowed_hosts or self.allowed_hosts == ["*"]:
            raise ValueError("ALLOWED_HOSTS must be explicitly set in production")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
