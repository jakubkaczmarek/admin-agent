from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    openai_api_key: str
    openai_model: str = "gpt-4o"
    mcp_server_url: str
    mcp_transport: str = "streamable_http"
    cors_origins: str = "*"
    autocomplete_threshold: float = 0.90

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS as a list (supports comma-separated values)."""
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
