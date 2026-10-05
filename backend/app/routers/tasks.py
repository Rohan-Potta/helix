from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Task, TaskPriority, TaskStatus
from app.routers.projects import get_project_or_404
from app.schemas import TaskCreate, TaskRead, TaskUpdate

project_tasks_router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])
tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@project_tasks_router.get("", response_model=list[TaskRead])
def list_tasks(
    project_id: int,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    db: Session = Depends(get_db),
) -> list[Task]:
    get_project_or_404(db, project_id)
    query = select(Task).where(Task.project_id == project_id).order_by(Task.created_at.asc())
    if status is not None:
        query = query.where(Task.status == status)
    if priority is not None:
        query = query.where(Task.priority == priority)
    return list(db.scalars(query))


@project_tasks_router.post("", response_model=TaskRead, status_code=201)
def create_task(project_id: int, data: TaskCreate, db: Session = Depends(get_db)) -> Task:
    get_project_or_404(db, project_id)
    task = Task(project_id=project_id, **data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@tasks_router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)) -> Task:
    return get_task_or_404(db, task_id)


@tasks_router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)) -> Task:
    task = get_task_or_404(db, task_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@tasks_router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)) -> None:
    task = get_task_or_404(db, task_id)
    db.delete(task)
    db.commit()
