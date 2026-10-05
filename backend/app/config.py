from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://helix:helix@localhost:5432/helix"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
