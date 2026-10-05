import { useState, type FormEvent } from "react";
import type { ProjectInput } from "../types";

interface ProjectFormProps {
  initial?: ProjectInput;
  submitLabel: string;
  onSubmit: (data: ProjectInput) => Promise<void>;
  onCancel?: () => void;
}

export default function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, description: description || null });
      if (!initial) {
        setName("");
        setDescription("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}
      <input
        type="text"
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <textarea
        placeholder="Description (optional)"
        value={description ?? ""}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
