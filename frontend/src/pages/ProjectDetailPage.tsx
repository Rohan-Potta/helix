import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  getProject,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../api/client";
import type { Project, Task, TaskInput, TaskPriority, TaskStatus } from "../types";
import TaskForm from "../components/TaskForm";
import TaskList from "../components/TaskList";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "">("");

  useEffect(() => {
    getProject(id)
      .then(setProject)
      .catch(() => setNotFound(true));
  }, [id]);

  async function loadTasks() {
    try {
      setError(null);
      const data = await listTasks(id, { status: statusFilter, priority: priorityFilter });
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    }
  }

  useEffect(() => {
    if (!notFound) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, statusFilter, priorityFilter, notFound]);

  async function handleCreate(data: TaskInput) {
    const task = await createTask(id, data);
    setTasks((prev) => (prev ? [...prev, task] : [task]));
  }

  async function handleUpdate(taskId: number, data: Partial<TaskInput>) {
    const updated = await updateTask(taskId, data);
    setTasks((prev) => prev?.map((t) => (t.id === taskId ? updated : t)) ?? null);
  }

  async function handleDelete(taskId: number) {
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  if (notFound) {
    return (
      <div>
        <p className="error-message">Project not found</p>
        <Link to="/">← Back to projects</Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/">← Back to projects</Link>
      {project && (
        <div>
          <h2>{project.name}</h2>
          {project.description && <p>{project.description}</p>}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <TaskForm submitLabel="Add task" onSubmit={handleCreate} />

      <div className="filters">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
        >
          <option value="">All statuses</option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "")}
        >
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {tasks === null && !error && <p>Loading…</p>}
      {tasks && tasks.length === 0 && <p className="empty-state">No tasks yet</p>}
      {tasks && tasks.length > 0 && (
        <TaskList tasks={tasks} onUpdate={handleUpdate} onDelete={handleDelete} />
      )}
    </div>
  );
}
