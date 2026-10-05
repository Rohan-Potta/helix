import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../api/client";
import type { Project, ProjectInput } from "../types";
import ProjectForm from "../components/ProjectForm";
import ConfirmDialog from "../components/ConfirmDialog";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  async function load() {
    try {
      setError(null);
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(data: ProjectInput) {
    const project = await createProject(data);
    setProjects((prev) => [project, ...(prev ?? [])]);
  }

  async function handleUpdate(id: number, data: ProjectInput) {
    const updated = await updateProject(id, data);
    setProjects((prev) => prev?.map((p) => (p.id === id ? updated : p)) ?? null);
    setEditingId(null);
  }

  async function handleDelete(id: number) {
    try {
      await deleteProject(id);
      setProjects((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <h2>Projects</h2>
      {error && <div className="error-message">{error}</div>}

      <ProjectForm submitLabel="Add project" onSubmit={handleCreate} />

      {projects === null && !error && <p>Loading…</p>}
      {projects && projects.length === 0 && (
        <p className="empty-state">No projects yet</p>
      )}

      {projects?.map((project) =>
        editingId === project.id ? (
          <ProjectForm
            key={project.id}
            initial={{ name: project.name, description: project.description }}
            submitLabel="Save"
            onSubmit={(data) => handleUpdate(project.id, data)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div className="card" key={project.id}>
            <div className="card-row">
              <div>
                <Link to={`/projects/${project.id}`}>
                  <strong>{project.name}</strong>
                </Link>
                {project.description && <p>{project.description}</p>}
                <small>Created {new Date(project.created_at).toLocaleDateString()}</small>
              </div>
              <div className="form-actions">
                <button onClick={() => setEditingId(project.id)}>Edit</button>
                <button onClick={() => setDeleteTarget(project)}>Delete</button>
              </div>
            </div>
          </div>
        ),
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Delete "${deleteTarget.name}"? All of its tasks will be deleted too.`}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
