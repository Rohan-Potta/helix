import type {
  Project,
  ProjectInput,
  Task,
  TaskInput,
  TaskStatus,
  TaskPriority,
} from "../types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        message = body.detail
          .map((e: { loc: string[]; msg: string }) => `${e.loc.at(-1)}: ${e.msg}`)
          .join("; ");
      }
    } catch {
      // response had no JSON body; keep the default message
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function getHealth(): Promise<{ status: string }> {
  return request("/api/health");
}

export function listProjects(): Promise<Project[]> {
  return request("/api/projects");
}

export function getProject(id: number): Promise<Project> {
  return request(`/api/projects/${id}`);
}

export function createProject(data: ProjectInput): Promise<Project> {
  return request("/api/projects", { method: "POST", body: JSON.stringify(data) });
}

export function updateProject(id: number, data: Partial<ProjectInput>): Promise<Project> {
  return request(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteProject(id: number): Promise<void> {
  return request(`/api/projects/${id}`, { method: "DELETE" });
}

export function listTasks(
  projectId: number,
  filters: { status?: TaskStatus | ""; priority?: TaskPriority | "" } = {},
): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  const query = params.toString();
  return request(`/api/projects/${projectId}/tasks${query ? `?${query}` : ""}`);
}

export function createTask(projectId: number, data: TaskInput): Promise<Task> {
  return request(`/api/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTask(id: number, data: Partial<TaskInput>): Promise<Task> {
  return request(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteTask(id: number): Promise<void> {
  return request(`/api/tasks/${id}`, { method: "DELETE" });
}
