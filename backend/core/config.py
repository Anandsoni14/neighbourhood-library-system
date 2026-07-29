from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, sourced from environment variables and .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Library Management System"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://user:password@localhost:5432/library_db"
    log_level: str = "INFO"
    api_prefix: str = "/api/v1"
    jwt_secret_key: str = "change-me-in-production-min-32-bytes-long"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
