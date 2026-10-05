from fastapi import FastAPI

from app.routers import projects, tasks

app = FastAPI(title="Helix API")

app.include_router(projects.router, prefix="/api")
app.include_router(tasks.project_tasks_router, prefix="/api")
app.include_router(tasks.tasks_router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
