import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _bootstrap_env() -> None:
    """Fill empty shell env vars with values from backend/.env.

    Pydantic-settings prefers OS-level env vars over the .env file. On Windows
    (and some shell setups) it's common to have KEY="" pre-set in the process
    environment, which silently overrides the .env value. This shim walks
    backend/.env and sets any key whose OS value is missing or empty.
    """
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        key, val = k.strip(), v.strip()
        if os.environ.get(key, "") == "":
            os.environ[key] = val


_bootstrap_env()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "local"
    log_level: str = "INFO"

    database_url: str = Field(
        default="postgresql+asyncpg://dailypages:dailypages@localhost:5432/dailypages",
        description="SQLAlchemy async URL (asyncpg driver).",
    )

    clerk_issuer: str | None = None
    clerk_jwks_url: str | None = None
    clerk_audience: str | None = None
    clerk_secret_key: str | None = None  # used to fetch user details on first sign-in

    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket: str = "dailypages-uploads"
    r2_public_base: str | None = None

    cors_origins: str = "http://localhost:3000,http://localhost:3037"

    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # AI providers
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-4-7"
    anthropic_fast_model: str = "claude-haiku-4-5-20251001"
    voyage_api_key: str | None = None
    voyage_embed_model: str = "voyage-3-large"
    voyage_embed_dim: int = 1536

    @property
    def claude_configured(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def embeddings_configured(self) -> bool:
        return bool(self.voyage_api_key)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def r2_endpoint(self) -> str | None:
        if not self.r2_account_id:
            return None
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"

    @property
    def auth_configured(self) -> bool:
        return bool(self.clerk_issuer and self.clerk_jwks_url)

    @property
    def storage_configured(self) -> bool:
        return bool(self.r2_account_id and self.r2_access_key_id and self.r2_secret_access_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
