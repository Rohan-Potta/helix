import { useState } from "react";
import type { Task, TaskInput, TaskStatus } from "../types";
import TaskForm from "./TaskForm";
import ConfirmDialog from "./ConfirmDialog";

interface TaskListProps {
  tasks: Task[];
  onUpdate: (id: number, data: Partial<TaskInput>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
];

function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === "done") return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

function TaskCard({
  task,
  onUpdate,
  onDelete,
}: {
  task: Task;
  onUpdate: (id: number, data: Partial<TaskInput>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (editing) {
    return (
      <TaskForm
        initial={{
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
        }}
        submitLabel="Save"
        onSubmit={async (data) => {
          await onUpdate(task.id, data);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="card">
      {error && <div className="error-message">{error}</div>}
      <div className="card-row">
        <strong>{task.title}</strong>
        <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
      </div>
      {task.description && <p>{task.description}</p>}
      {task.due_date && (
        <p className={isOverdue(task) ? "due-overdue" : undefined}>
          Due {task.due_date}
          {isOverdue(task) ? " (overdue)" : ""}
        </p>
      )}
      <div className="form-actions">
        <select
          value={task.status}
          onChange={async (e) => {
            try {
              await onUpdate(task.id, { status: e.target.value as TaskStatus });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to update status");
            }
          }}
        >
          {COLUMNS.map((c) => (
            <option key={c.status} value={c.status}>
              {c.label}
            </option>
          ))}
        </select>
        <button onClick={() => setEditing(true)}>Edit</button>
        <button onClick={() => setConfirmingDelete(true)}>Delete</button>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          message={`Delete "${task.title}"?`}
          onConfirm={() => onDelete(task.id)}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

export default function TaskList({ tasks, onUpdate, onDelete }: TaskListProps) {
  return (
    <div className="task-columns">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.status);
        return (
          <div className="task-column" key={column.status}>
            <h3>
              {column.label} ({columnTasks.length})
            </h3>
            {columnTasks.map((task) => (
              <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
