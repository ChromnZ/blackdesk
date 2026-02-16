"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Modal } from "@/components/console/Modal";
import {
  isLlmProvider,
  type AvailableLlmModels,
  type LlmProvider,
} from "@/lib/llm-config";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Mic,
  Paperclip,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useMemo, useState } from "react";

type GenerateResponse = {
  titleSuggestion?: string;
  promptDraft: string;
  error?: string;
};

type CreateResponse = {
  prompt?: { id: string };
  error?: string;
};

type AgentSettingsResponse = {
  provider: string;
  model: string;
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
  availableModels: AvailableLlmModels;
  error?: string;
};

type AgentConfig = {
  provider: LlmProvider;
  model: string;
  availableModels: AvailableLlmModels;
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
};

const SUGGESTIONS = [
  "Trip planner",
  "Image generator",
  "Code debugger",
  "Research assistant",
  "Decision helper",
];

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
  google: "Google",
};

function getLinkedProviders(config: AgentConfig | null) {
  if (!config) {
    return [] as LlmProvider[];
  }

  return (Object.keys(config.availableModels) as LlmProvider[]).filter(
    (provider) => config.availableModels[provider].length > 0,
  );
}

export function AgentConsoleHome() {
  const router = useRouter();

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSwitchingConfig, setIsSwitchingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [toolMessage, setToolMessage] = useState<string | null>(null);

  const [composerInput, setComposerInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [promptText, setPromptText] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      setIsLoadingConfig(true);
      setConfigError(null);

      try {
        const response = await fetch("/api/agent/settings", { cache: "no-store" });
        const payload = (await response.json()) as AgentSettingsResponse;

        if (!response.ok || !isLlmProvider(payload.provider)) {
          setConfigError(payload.error ?? "Unable to load LLM settings.");
          return;
        }

        const linkedProviders = (Object.keys(payload.availableModels) as LlmProvider[]).filter(
          (provider) => payload.availableModels[provider].length > 0,
        );
        const provider = linkedProviders.includes(payload.provider)
          ? payload.provider
          : linkedProviders[0] ?? "openai";
        const allowedModelsForProvider = payload.availableModels[provider];
        const model = allowedModelsForProvider.includes(payload.model)
          ? payload.model
          : allowedModelsForProvider[0] ?? "";

        setConfig({
          provider,
          model,
          availableModels: payload.availableModels,
          hasOpenaiApiKey: payload.hasOpenaiApiKey,
          hasAnthropicApiKey: payload.hasAnthropicApiKey,
          hasGoogleApiKey: payload.hasGoogleApiKey,
        });
      } catch {
        setConfigError("Unable to load LLM settings.");
      } finally {
        setIsLoadingConfig(false);
      }
    }

    void loadSettings();
  }, []);

  async function persistConfig(provider: LlmProvider, model: string) {
    setIsSwitchingConfig(true);
    setConfigError(null);

    try {
      const response = await fetch("/api/agent/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider, model }),
      });

      const payload = (await response.json()) as AgentSettingsResponse;
      if (!response.ok || !isLlmProvider(payload.provider)) {
        setConfigError(payload.error ?? "Unable to update LLM settings.");
        return;
      }

      const linkedProviders = (Object.keys(payload.availableModels) as LlmProvider[]).filter(
        (provider) => payload.availableModels[provider].length > 0,
      );
      const nextProvider = linkedProviders.includes(payload.provider)
        ? payload.provider
        : linkedProviders[0] ?? "openai";
      const allowedModelsForProvider = payload.availableModels[nextProvider];
      const nextModel = allowedModelsForProvider.includes(payload.model)
        ? payload.model
        : allowedModelsForProvider[0] ?? "";

      setConfig({
        provider: nextProvider,
        model: nextModel,
        availableModels: payload.availableModels,
        hasOpenaiApiKey: payload.hasOpenaiApiKey,
        hasAnthropicApiKey: payload.hasAnthropicApiKey,
        hasGoogleApiKey: payload.hasGoogleApiKey,
      });
    } catch {
      setConfigError("Unable to update LLM settings.");
    } finally {
      setIsSwitchingConfig(false);
    }
  }

  function handleProviderSelect(nextProvider: LlmProvider) {
    if (!config || isSwitchingConfig) {
      return;
    }

    const nextProviderModels = config.availableModels[nextProvider];
    if (nextProviderModels.length === 0) {
      return;
    }

    const nextModel = nextProviderModels.includes(config.model)
      ? config.model
      : nextProviderModels[0];

    setConfig((current) =>
      current
        ? {
            ...current,
            provider: nextProvider,
            model: nextModel,
          }
        : current,
    );

    void persistConfig(nextProvider, nextModel);
  }

  function handleModelSelect(nextModel: string) {
    if (!config || isSwitchingConfig) {
      return;
    }

    if (!config.availableModels[config.provider].includes(nextModel)) {
      return;
    }

    setConfig((current) => (current ? { ...current, model: nextModel } : current));
    void persistConfig(config.provider, nextModel);
  }

  function selectedProviderHasKey() {
    if (!config) {
      return false;
    }

    if (config.provider === "openai") {
      return config.hasOpenaiApiKey;
    }
    if (config.provider === "anthropic") {
      return config.hasAnthropicApiKey;
    }
    return config.hasGoogleApiKey;
  }

  const linkedProviders = useMemo(() => getLinkedProviders(config), [config]);
  const hasLinkedProvider = linkedProviders.length > 0;
  const modelOptions = useMemo(() => {
    if (!config || !hasLinkedProvider || !linkedProviders.includes(config.provider)) {
      return [];
    }

    return config.availableModels[config.provider];
  }, [config, hasLinkedProvider, linkedProviders]);

  useEffect(() => {
    if (!config || linkedProviders.length === 0 || isSwitchingConfig) {
      return;
    }

    if (linkedProviders.includes(config.provider)) {
      return;
    }

    const nextProvider = linkedProviders[0];
    const nextModel = config.availableModels[nextProvider][0] ?? "";

    setConfig((current) =>
      current
        ? {
            ...current,
            provider: nextProvider,
            model: nextModel,
          }
        : current,
    );

    void persistConfig(nextProvider, nextModel);
  }, [config, linkedProviders, isSwitchingConfig]);

  const canCreate = useMemo(() => {
    return title.trim().length > 0 && promptText.trim().length > 0;
  }, [title, promptText]);

  async function generateFromDescription(rawDescription?: string) {
    const descriptionInput = (rawDescription ?? composerInput).trim();
    if (!descriptionInput || isGenerating) {
      return;
    }

    setError(null);
    setToolMessage(null);
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

  async function handleCreatePrompt(event: React.FormEvent<HTMLFormElement>) {
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

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void generateFromDescription();
    }
  }

  function handleToolAction(label: string) {
    setToolMessage(`${label} is coming soon.`);
  }

  return (
    <section className="relative min-h-[calc(100vh-7.5rem)] rounded-2xl border border-zinc-900/80 bg-zinc-950/40 px-5 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:px-7">
      <div className="absolute left-5 top-5 sm:left-7 sm:top-6">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              disabled={!config || isLoadingConfig || !hasLinkedProvider}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 text-sm text-zinc-200 outline-none transition hover:border-zinc-700 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-500",
                (!config || isLoadingConfig || !hasLinkedProvider) &&
                  "cursor-not-allowed opacity-70",
              )}
              aria-label="Select LLM and model"
            >
              <span className="font-medium">
                {!config || isLoadingConfig
                  ? "Loading LLM"
                  : hasLinkedProvider
                    ? PROVIDER_LABELS[config.provider]
                    : "No linked LLM"}
              </span>
              <span className="text-zinc-500">|</span>
              <span className="max-w-[180px] truncate text-zinc-300">
                {!config || isLoadingConfig
                  ? "Loading model"
                  : hasLinkedProvider
                    ? config.model
                    : "Add API key in Settings"}
              </span>
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={10}
              className="z-[70] w-[320px] rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2.5 shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-md"
            >
              <div className="px-2 py-1">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Provider</p>
              </div>

              <div className="space-y-1 px-1 pb-2">
                {linkedProviders.map((provider) => (
                  <DropdownMenu.Item
                    key={provider}
                    onSelect={() => handleProviderSelect(provider)}
                    className="flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-sm text-zinc-200 outline-none transition hover:bg-zinc-900/70 focus:bg-zinc-900/70"
                  >
                    <span>{PROVIDER_LABELS[provider]}</span>
                    {config?.provider === provider && <Check className="h-4 w-4 text-zinc-400" />}
                  </DropdownMenu.Item>
                ))}
              </div>

              <div className="my-2 h-px bg-zinc-800/70" />

              <div className="px-2 py-1">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Model</p>
              </div>

              <div className="max-h-[220px] space-y-1 overflow-y-auto px-1">
                {modelOptions.map((model) => (
                  <DropdownMenu.Item
                    key={model}
                    onSelect={() => handleModelSelect(model)}
                    className="flex min-h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-sm text-zinc-200 outline-none transition hover:bg-zinc-900/70 focus:bg-zinc-900/70"
                  >
                    <span className="pr-3">{model}</span>
                    {config?.model === model && <Check className="h-4 w-4 shrink-0 text-zinc-400" />}
                  </DropdownMenu.Item>
                ))}
              </div>

              <div className="my-2 h-px bg-zinc-800/70" />

              <div className="px-2 py-1 text-xs text-zinc-500">
                {config
                  ? !hasLinkedProvider
                    ? "No linked provider. Add an API key in Settings."
                    : selectedProviderHasKey()
                    ? "API key linked for selected provider."
                    : "No API key for selected provider. Add one in Settings."
                  : "Loading provider status..."}
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {configError && (
          <p className="mt-2 max-w-[320px] rounded-md border border-red-900/80 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-300">
            {configError}
          </p>
        )}
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-18rem)] w-full max-w-3xl flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          What can I help with?
        </h1>

        <div className="mx-auto mt-7 w-full rounded-[24px] border border-zinc-800 bg-zinc-900/75 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.32)] sm:p-4">
          <textarea
            rows={2}
            value={composerInput}
            onChange={(event) => setComposerInput(event.target.value)}
            onKeyDown={onComposerKeyDown}
            className="w-full resize-none border-0 bg-transparent px-2 py-2 text-base text-zinc-100 placeholder:text-zinc-500 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Ask anything"
            aria-label="Ask anything"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    aria-label="Open tools"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/90 text-zinc-200 transition hover:bg-zinc-700"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="start"
                    sideOffset={10}
                    className="z-[70] w-64 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-md"
                  >
                    <DropdownMenu.Item
                      onSelect={() => handleToolAction("Add photos & files")}
                      className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm text-zinc-200 outline-none transition hover:bg-zinc-800/80 focus:bg-zinc-800/80"
                    >
                      <Paperclip className="h-4 w-4 text-zinc-400" />
                      Add photos & files
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToolAction("Voice input")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
                aria-label="Voice input"
              >
                <Mic className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => void generateFromDescription()}
                disabled={isGenerating || composerInput.trim().length === 0}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-950 transition hover:bg-white",
                  (isGenerating || composerInput.trim().length === 0) &&
                    "cursor-not-allowed opacity-50",
                )}
                aria-label="Generate prompt"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {(error || toolMessage) && (
          <p className="mx-auto mt-4 max-w-xl rounded-lg border border-red-900/80 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error ?? toolMessage}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setComposerInput(suggestion);
                void generateFromDescription(suggestion);
              }}
              className="rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900/70 hover:text-zinc-100"
            >
              {suggestion}
            </button>
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
