import json
from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, sourced from environment variables and .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Library Management System"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://user:password@localhost:5432/library_db"
    # A separate database for pytest, never seeded, so exact-count assertions in
    # the test suite stay meaningful once sample data lands in `database_url`'s
    # database via the Docker entrypoint. Never read by application runtime code
    # (only tests/conftest.py uses it) — kept in Settings anyway for the same
    # env/.env sourcing every other connection string gets.
    test_database_url: str = "postgresql+psycopg://user:password@localhost:5432/library_test_db"
    log_level: str = "INFO"
    api_prefix: str = "/api/v1"
    jwt_secret_key: str = "change-me-in-production-min-32-bytes-long"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    cors_allow_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost",
    ]

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _split_comma_separated(cls, value: object) -> object:
        """Accept `a,b` from the environment as well as a JSON list.

        NoDecode suppresses pydantic-settings' default JSON decoding of complex
        types, which would otherwise reject the comma-separated form that reads
        naturally in a .env file. JSON is still honoured so an existing
        deployment passing `["https://app.example.com"]` keeps working rather
        than silently ending up with one bracket-wrapped origin.
        """
        if not isinstance(value, str):
            return value
        text = value.strip()
        if text.startswith("["):
            return json.loads(text)
        return [origin.strip() for origin in text.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
