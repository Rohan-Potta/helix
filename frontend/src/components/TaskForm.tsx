import { useState, type FormEvent } from "react";
import type { TaskInput, TaskPriority, TaskStatus } from "../types";

interface TaskFormProps {
  initial?: TaskInput;
  submitLabel: string;
  onSubmit: (data: TaskInput) => Promise<void>;
  onCancel?: () => void;
}

export default function TaskForm({ initial, submitLabel, onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title,
        description: description || null,
        status,
        priority,
        due_date: dueDate || null,
      });
      if (!initial) {
        setTitle("");
        setDescription("");
        setStatus("todo");
        setPriority("medium");
        setDueDate("");
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
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        placeholder="Description (optional)"
        value={description ?? ""}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <div className="form-row">
        <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          type="date"
          value={dueDate ?? ""}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
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
