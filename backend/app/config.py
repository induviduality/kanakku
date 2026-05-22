from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://kanakku:kanakku@localhost:5432/kanakku"
    jwt_secret: str = "change-me-in-production"
    llm_backend: str = "none"
    ollama_host: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:1.5b"
    redis_url: str = "redis://localhost:6379"
    public_base_url: str = "http://localhost:8000"
    debug: bool = False


settings = Settings()
