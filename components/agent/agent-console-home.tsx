"use client";

import { ConsolePill } from "@/components/console/ConsolePill";
import { Modal } from "@/components/console/Modal";
import { cn } from "@/lib/utils";
import { ArrowRight, MessagesSquare, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type GenerateResponse = {
  titleSuggestion?: string;
  promptDraft: string;
  error?: string;
};

type CreateResponse = {
  prompt?: { id: string };
  error?: string;
};

const SUGGESTIONS = [
  "Trip planner",
  "Image generator",
  "Code debugger",
  "Research assistant",
  "Decision helper",
];

export function AgentConsoleHome() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [promptText, setPromptText] = useState("");
  const [generateDescription, setGenerateDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(() => {
    return title.trim().length > 0 && promptText.trim().length > 0;
  }, [title, promptText]);

  function openCreateModal() {
    setError(null);
    setTitle("");
    setDescription("");
    setPromptText("");
    setModalOpen(true);
  }

  async function generateFromDescription(rawDescription?: string) {
    const descriptionInput = (rawDescription ?? generateDescription).trim();
    if (!descriptionInput || isGenerating) {
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descriptionInput }),
      });

      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok || !payload.promptDraft) {
        setError(payload.error ?? "Unable to generate a prompt draft.");
        return;
      }

      setTitle(payload.titleSuggestion?.trim() || descriptionInput.slice(0, 80));
      setDescription(descriptionInput);
      setPromptText(payload.promptDraft);
      setModalOpen(true);
    } catch {
      setError("Unable to generate a prompt draft.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCreatePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || isCreating) {
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch("/api/agent/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          prompt: promptText.trim(),
        }),
      });

      const payload = (await response.json()) as CreateResponse;
      if (!response.ok || !payload.prompt?.id) {
        setError(payload.error ?? "Unable to create prompt.");
        return;
      }

      setModalOpen(false);
      router.push(`/app/agent/prompts/${payload.prompt.id}`);
      router.refresh();
    } catch {
      setError("Unable to create prompt.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="relative flex min-h-[calc(100vh-7.5rem)] items-center justify-center rounded-2xl border border-zinc-900/80 bg-zinc-950/40 px-5 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="w-full max-w-3xl text-center">
        <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 text-zinc-200">
          <MessagesSquare className="h-6 w-6" />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Create an agent prompt
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
          Start from scratch, or generate a draft and refine it.
        </p>

        {error && (
          <p className="mx-auto mt-4 max-w-xl rounded-lg border border-red-900/80 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mx-auto mt-7 flex max-w-2xl flex-col items-stretch gap-2 sm:flex-row">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white"
          >
            Create
          </button>

          <div className="flex h-11 min-w-0 flex-1 items-center rounded-md border border-zinc-800 bg-zinc-900/75 pl-3 pr-1.5">
            <Sparkles className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={generateDescription}
              onChange={(event) => setGenerateDescription(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void generateFromDescription();
                }
              }}
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              placeholder="Generate from idea..."
              aria-label="Generate prompt description"
            />
            <button
              type="button"
              onClick={() => void generateFromDescription()}
              disabled={isGenerating || generateDescription.trim().length === 0}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-100 text-zinc-950 transition hover:bg-white",
                (isGenerating || generateDescription.trim().length === 0) &&
                  "cursor-not-allowed opacity-50",
              )}
              aria-label="Generate prompt"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <ConsolePill
              key={suggestion}
              label={suggestion}
              onClick={() => {
                setGenerateDescription(suggestion);
                void generateFromDescription(suggestion);
              }}
            />
          ))}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!isCreating) {
            setModalOpen(false);
          }
        }}
        title="Create prompt"
        description="Save an agent prompt you can iterate and reuse."
      >
        <form className="space-y-4" onSubmit={handleCreatePrompt}>
          <div>
            <label htmlFor="prompt-title" className="mb-1 block text-sm text-zinc-300">
              Title
            </label>
            <input
              id="prompt-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={150}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Customer support assistant"
            />
          </div>

          <div>
            <label htmlFor="prompt-description" className="mb-1 block text-sm text-zinc-300">
              Description (optional)
            </label>
            <input
              id="prompt-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={280}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Short context for this prompt"
            />
          </div>

          <div>
            <label htmlFor="prompt-text" className="mb-1 block text-sm text-zinc-300">
              Prompt draft
            </label>
            <textarea
              id="prompt-text"
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              rows={10}
              required
              className="w-full rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="You are a helpful assistant..."
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300 transition hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canCreate || isCreating}
              className={cn(
                "rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white",
                (!canCreate || isCreating) && "cursor-not-allowed opacity-50",
              )}
            >
              {isCreating ? "Creating..." : "Create prompt"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
