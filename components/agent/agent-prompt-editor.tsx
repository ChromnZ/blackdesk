"use client";

import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AgentPromptEditorProps = {
  prompt: {
    id: string;
    title: string;
    description: string | null;
    prompt: string;
    updatedAt: string;
  };
};

type PromptResponse = {
  prompt?: {
    id: string;
    title: string;
    description: string | null;
    prompt: string;
    updatedAt: string;
  };
  error?: string;
};

export function AgentPromptEditor({ prompt }: AgentPromptEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(prompt.title);
  const [description, setDescription] = useState(prompt.description ?? "");
  const [promptText, setPromptText] = useState(prompt.prompt);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && promptText.trim().length > 0;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || isSaving) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/agent/prompts/${prompt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          prompt: promptText.trim(),
        }),
      });

      const payload = (await response.json()) as PromptResponse;
      if (!response.ok || !payload.prompt) {
        setError(payload.error ?? "Unable to save prompt.");
        return;
      }

      setTitle(payload.prompt.title);
      setDescription(payload.prompt.description ?? "");
      setPromptText(payload.prompt.prompt);
      setSuccess("Prompt saved.");
      router.refresh();
    } catch {
      setError("Unable to save prompt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    const confirmed = window.confirm("Delete this prompt?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/agent/prompts/${prompt.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to delete prompt.");
        return;
      }

      router.push("/app/agent");
      router.refresh();
    } catch {
      setError("Unable to delete prompt.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-900/80 bg-zinc-950/40 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Agent Builder</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-100">Prompt Editor</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Refine and save your prompt. Last update: {new Date(prompt.updatedAt).toLocaleString()}.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-900/80 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="mb-4 rounded-md border border-emerald-900/80 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      )}

      <form className="space-y-4" onSubmit={handleSave}>
        <div>
          <label htmlFor="editor-title" className="mb-1 block text-sm text-zinc-300">
            Title
          </label>
          <input
            id="editor-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={150}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="editor-description" className="mb-1 block text-sm text-zinc-300">
            Description (optional)
          </label>
          <input
            id="editor-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={280}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
            placeholder="Purpose or context"
          />
        </div>

        <div>
          <label htmlFor="editor-prompt" className="mb-1 block text-sm text-zinc-300">
            Prompt
          </label>
          <textarea
            id="editor-prompt"
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            rows={16}
            required
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-red-900/80 bg-red-950/40 px-3 py-2 text-sm text-red-300 transition hover:bg-red-950/70",
              isDeleting && "cursor-not-allowed opacity-50",
            )}
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>

          <button
            type="submit"
            disabled={!canSave || isSaving}
            className={cn(
              "rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white",
              (!canSave || isSaving) && "cursor-not-allowed opacity-50",
            )}
          >
            {isSaving ? "Saving..." : "Save prompt"}
          </button>
        </div>
      </form>
    </section>
  );
}
