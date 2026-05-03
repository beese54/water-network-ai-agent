from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Provider selection: "anthropic" | "openai" | "together"
    llm_provider: str = "together"

    # API keys
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    together_api_key: str = ""

    # Model per provider (override via .env if desired)
    anthropic_model: str = "claude-sonnet-4-6"
    openai_model: str = "gpt-4o"
    together_model: str = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

    network_file_path: str = "data/bukit_batok.inp"
    port: int = 8000

    # Hydraulic threshold — 1 bar = 10.197 m head (project-specific)
    min_residual_head_m: float = 10.197


settings = Settings()
