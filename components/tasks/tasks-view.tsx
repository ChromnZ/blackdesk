"use client";

import { Modal } from "@/components/ui/modal";
import { swrFetcher } from "@/lib/swr-fetcher";
import { toLocalInputValue } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";

type TaskPriority = "low" | "med" | "high";
type TaskStatus = "todo" | "doing" | "done";

type TaskRecord = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: TaskPriority | null;
  status: TaskStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskForm = {
  title: string;
  dueAt: string;
  priority: "" | TaskPriority;
  status: TaskStatus;
  notes: string;
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
};

function emptyTaskForm(): TaskForm {
  return {
    title: "",
    dueAt: "",
    priority: "",
    status: "todo",
    notes: "",
  };
}

function formatDueDate(value: string | null) {
  if (!value) {
    return "No due date";
  }
  return new Date(value).toLocaleString();
}

export function TasksView() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<TaskForm>(emptyTaskForm());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TaskForm>(emptyTaskForm());
  const [isSaving, setSaving] = useState(false);

  const {
    data: tasksData,
    error: tasksError,
    isLoading,
    mutate,
  } = useSWR<TaskRecord[]>("/api/tasks", swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
    keepPreviousData: true,
  });

  const tasks = tasksData ?? [];
  const displayError = actionError ?? tasksError?.message ?? null;

  async function createTask() {
    const title = createForm.title.trim();
    if (!title) {
      setActionError("Task title is required.");
      return;
    }

    setSaving(true);
    setActionError(null);

    const dueAtIso = createForm.dueAt ? new Date(createForm.dueAt).toISOString() : null;

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        dueAt: dueAtIso,
        priority: createForm.priority || null,
        status: createForm.status,
        notes: createForm.notes.trim(),
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setActionError(payload?.error ?? "Unable to create task.");
      return;
    }

    const task = (await response.json()) as TaskRecord;
    setCreateForm(emptyTaskForm());
    setActionError(null);

    await mutate((current) => [task, ...(current ?? [])], { revalidate: false });
  }

  async function saveTaskEdit() {
    if (!editingTaskId) {
      return;
    }

    const title = editForm.title.trim();
    if (!title) {
      setActionError("Task title is required.");
      return;
    }

    setSaving(true);
    setActionError(null);

    const response = await fetch(`/api/tasks/${editingTaskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        dueAt: editForm.dueAt ? new Date(editForm.dueAt).toISOString() : null,
        priority: editForm.priority || null,
        status: editForm.status,
        notes: editForm.notes.trim(),
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setActionError(payload?.error ?? "Unable to update task.");
      return;
    }

    const updated = (await response.json()) as TaskRecord;
    setEditingTaskId(null);
    setEditForm(emptyTaskForm());
    setActionError(null);

    await mutate(
      (current) =>
        (current ?? []).map((task) => (task.id === updated.id ? updated : task)),
      { revalidate: false },
    );
  }

  function startEditing(task: TaskRecord) {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title,
      dueAt: task.dueAt ? toLocalInputValue(task.dueAt) : "",
      priority: task.priority ?? "",
      status: task.status,
      notes: task.notes ?? "",
    });
  }

  async function toggleDone(task: TaskRecord) {
    const nextStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    setActionError(null);

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: nextStatus,
      }),
    });

    if (!response.ok) {
      setActionError("Unable to update task status.");
      return;
    }

    const updated = (await response.json()) as TaskRecord;

    await mutate(
      (current) =>
        (current ?? []).map((item) => (item.id === updated.id ? updated : item)),
      { revalidate: false },
    );
  }

  async function deleteTask(taskId: string) {
    setActionError(null);

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setActionError("Unable to delete task.");
      return;
    }

    await mutate(
      (current) => (current ?? []).filter((task) => task.id !== taskId),
      { revalidate: false },
    );

    if (editingTaskId === taskId) {
      setEditingTaskId(null);
      setEditForm(emptyTaskForm());
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Tasks</h1>
        <p className="mt-1 text-sm text-textMuted">Capture, prioritize, and complete work quickly.</p>
      </header>

      {displayError && (
        <p className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {displayError}
        </p>
      )}

      <div className="rounded-xl border border-border bg-panel p-4 shadow-glow sm:p-5">
        <h2 className="font-display text-lg">Create task</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="task-title" className="mb-1 block text-sm text-textMuted">
              Title
            </label>
            <input
              id="task-title"
              value={createForm.title}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, title: event.target.value }))
              }
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
              placeholder="Task title"
            />
          </div>

          <div>
            <label htmlFor="task-due" className="mb-1 block text-sm text-textMuted">
              Due date
            </label>
            <input
              id="task-due"
              type="datetime-local"
              value={createForm.dueAt}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, dueAt: event.target.value }))
              }
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
            />
          </div>

          <div>
            <label htmlFor="task-priority" className="mb-1 block text-sm text-textMuted">
              Priority
            </label>
            <select
              id="task-priority"
              value={createForm.priority}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  priority: event.target.value as "" | TaskPriority,
                }))
              }
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="task-notes" className="mb-1 block text-sm text-textMuted">
              Notes
            </label>
            <textarea
              id="task-notes"
              rows={3}
              value={createForm.notes}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
              placeholder="Optional notes"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void createTask()}
          disabled={isSaving}
          className="mt-4 rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Add task"}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-panel p-4 shadow-glow sm:p-5">
        <h2 className="font-display text-lg">Your tasks</h2>

        {isLoading && tasks.length === 0 ? (
          <p className="mt-4 text-sm text-textMuted">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="mt-4 text-sm text-textMuted">No tasks yet. Add your first one above.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tasks.map((task) => (
              <li key={task.id} className="rounded-lg border border-border bg-panelSoft p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-medium">{task.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-textMuted">
                      {statusLabel[task.status]} - {task.priority ?? "no priority"}
                    </p>
                    <p className="mt-2 text-sm text-textMuted">{formatDueDate(task.dueAt)}</p>
                    {task.notes && <p className="mt-2 text-sm text-textMain">{task.notes}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleDone(task)}
                      className="rounded-md border border-border bg-panel px-3 py-1.5 text-xs text-textMain transition hover:bg-panelSoft"
                    >
                      {task.status === "done" ? "Undo" : "Mark done"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(task)}
                      className="rounded-md border border-border bg-panel px-3 py-1.5 text-xs text-textMain transition hover:bg-panelSoft"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteTask(task.id)}
                      className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-900/35"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        title="Edit task"
        open={Boolean(editingTaskId)}
        onClose={() => setEditingTaskId(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingTaskId(null)}
              className="rounded-md border border-border bg-panelSoft px-4 py-2 text-sm text-textMain transition hover:bg-panelSoft"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveTaskEdit()}
              disabled={isSaving}
              className="rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-task-title" className="mb-1 block text-sm text-textMuted">
              Title
            </label>
            <input
              id="edit-task-title"
              value={editForm.title}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, title: event.target.value }))
              }
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-task-due" className="mb-1 block text-sm text-textMuted">
                Due date
              </label>
              <input
                id="edit-task-due"
                type="datetime-local"
                value={editForm.dueAt}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, dueAt: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
              />
            </div>

            <div>
              <label htmlFor="edit-task-priority" className="mb-1 block text-sm text-textMuted">
                Priority
              </label>
              <select
                id="edit-task-priority"
                value={editForm.priority}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    priority: event.target.value as "" | TaskPriority,
                  }))
                }
                className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="edit-task-status" className="mb-1 block text-sm text-textMuted">
              Status
            </label>
            <select
              id="edit-task-status"
              value={editForm.status}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  status: event.target.value as TaskStatus,
                }))
              }
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
            >
              <option value="todo">To do</option>
              <option value="doing">Doing</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label htmlFor="edit-task-notes" className="mb-1 block text-sm text-textMuted">
              Notes
            </label>
            <textarea
              id="edit-task-notes"
              rows={3}
              value={editForm.notes}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
            />
          </div>
        </div>
      </Modal>
    </section>
  );
}
