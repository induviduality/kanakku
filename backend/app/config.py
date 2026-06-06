from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = "change-me-in-production"
    llm_backend: str = "none"
    ollama_host: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:1.5b"
    redis_url: str = "redis://localhost:6379"
    public_base_url: str = "http://localhost:8765"
    debug: bool = False
    dev_mode: bool = False
    query_timeout_ms: int = 10000
    query_row_limit: int = 10000


settings = Settings()
