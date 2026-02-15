"use client";

import {
  LLM_MODELS,
  defaultModelForProvider,
  isLlmProvider,
  isValidModelForProvider,
  type LlmProvider,
} from "@/lib/llm-config";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  action?: "reply" | "create_task" | "create_event";
  meta?: string;
};

type AgentResponse = {
  action: "reply" | "create_task" | "create_event";
  reply: string;
  provider?: string;
  model?: string;
  hasLinkedAi?: boolean;
  availableModels?: typeof LLM_MODELS;
  createdTask?: {
    id: string;
    title: string;
    status: string;
    dueAt: string | null;
  };
  createdEvent?: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
  };
  usedFallback?: boolean;
  error?: string;
};

type AgentSettingsResponse = {
  provider: string;
  model: string;
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
  availableModels: typeof LLM_MODELS;
};

type AgentConfig = {
  provider: LlmProvider;
  model: string;
  availableModels: typeof LLM_MODELS;
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
};

const QUICK_PROMPTS = [
  "Create a task to send the monthly report tomorrow at 9am.",
  "Schedule an event called Team standup for tomorrow at 10am.",
  "Help me plan my top 3 priorities for this week.",
];

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  openai: "OpenAI",
  anthropic: "Claude (Anthropic)",
  google: "Google (Gemini)",
};

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatMeta(data: AgentResponse) {
  if (data.action === "create_task" && data.createdTask) {
    const due = data.createdTask.dueAt
      ? new Date(data.createdTask.dueAt).toLocaleString()
      : "No due date";

    return `Task created: ${data.createdTask.title} (${data.createdTask.status}, ${due})`;
  }

  if (data.action === "create_event" && data.createdEvent) {
    const start = new Date(data.createdEvent.startAt).toLocaleString();
    const end = new Date(data.createdEvent.endAt).toLocaleString();
    return `Event created: ${data.createdEvent.title} (${start} - ${end})`;
  }

  return undefined;
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: id(),
      role: "assistant",
      content:
        "I am your BlackDesk agent. Tell me what you need, and I can reply or create tasks/events for you.",
      action: "reply",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    async function loadSettings() {
      setIsLoadingConfig(true);

      try {
        const response = await fetch("/api/agent/settings", { cache: "no-store" });
        const payload = (await response.json()) as
          | AgentSettingsResponse
          | { error?: string };

        if (!response.ok || !("provider" in payload) || !isLlmProvider(payload.provider)) {
          setError("Unable to load AI agent model settings.");
          return;
        }

        const provider = payload.provider;
        const model = isValidModelForProvider(provider, payload.model)
          ? payload.model
          : defaultModelForProvider(provider);

        setConfig({
          provider,
          model,
          availableModels: payload.availableModels,
          hasOpenaiApiKey: payload.hasOpenaiApiKey,
          hasAnthropicApiKey: payload.hasAnthropicApiKey,
          hasGoogleApiKey: payload.hasGoogleApiKey,
        });
      } catch {
        setError("Unable to load AI agent model settings.");
      } finally {
        setIsLoadingConfig(false);
      }
    }

    void loadSettings();
  }, []);

  const historyPayload = useMemo(
    () =>
      messages
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );

  const hasLinkedAi = Boolean(
    config?.hasOpenaiApiKey || config?.hasAnthropicApiKey || config?.hasGoogleApiKey,
  );

  async function persistModelSelection(provider: LlmProvider, model: string) {
    setIsSwitchingModel(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider, model }),
      });

      const payload = (await response.json()) as
        | AgentSettingsResponse
        | { error?: string };

      if (!response.ok || !("provider" in payload) || !isLlmProvider(payload.provider)) {
        setError(("error" in payload && payload.error) || "Unable to switch model.");
        return;
      }

      const nextProvider = payload.provider;
      const nextModel = isValidModelForProvider(nextProvider, payload.model)
        ? payload.model
        : defaultModelForProvider(nextProvider);

      setConfig({
        provider: nextProvider,
        model: nextModel,
        availableModels: payload.availableModels,
        hasOpenaiApiKey: payload.hasOpenaiApiKey,
        hasAnthropicApiKey: payload.hasAnthropicApiKey,
        hasGoogleApiKey: payload.hasGoogleApiKey,
      });
    } catch {
      setError("Unable to switch model.");
    } finally {
      setIsSwitchingModel(false);
    }
  }

  function handleProviderChange(nextValue: string) {
    if (!config || !isLlmProvider(nextValue)) {
      return;
    }

    const nextModel = isValidModelForProvider(nextValue, config.model)
      ? config.model
      : defaultModelForProvider(nextValue);

    setConfig((current) =>
      current
        ? {
            ...current,
            provider: nextValue,
            model: nextModel,
          }
        : current,
    );
    void persistModelSelection(nextValue, nextModel);
  }

  function handleModelChange(nextModel: string) {
    if (!config || !isValidModelForProvider(config.provider, nextModel)) {
      return;
    }

    setConfig((current) =>
      current
        ? {
            ...current,
            model: nextModel,
          }
        : current,
    );
    void persistModelSelection(config.provider, nextModel);
  }

  async function submit(text: string) {
    const cleaned = text.trim();
    if (!cleaned || isSending || !config || !hasLinkedAi) {
      return;
    }

    setError(null);
    setIsSending(true);
    setInput("");

    const userMessage: ChatMessage = {
      id: id(),
      role: "user",
      content: cleaned,
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: cleaned,
          history: historyPayload,
          provider: config.provider,
          model: config.model,
        }),
      });

      const payload = (await response.json()) as AgentResponse;

      if (!response.ok) {
        setError(payload.error ?? "Agent request failed.");
        return;
      }

      const assistantMessage: ChatMessage = {
        id: id(),
        role: "assistant",
        content: payload.reply,
        action: payload.action,
        meta: formatMeta(payload),
      };

      setMessages((current) => [...current, assistantMessage]);

      if (
        payload.provider &&
        payload.model &&
        isLlmProvider(payload.provider) &&
        isValidModelForProvider(payload.provider, payload.model)
      ) {
        setConfig((current) =>
          current
            ? {
                ...current,
                provider: payload.provider as LlmProvider,
                model: payload.model as string,
              }
            : current,
        );
      }
    } catch {
      setError("Unable to reach the agent right now.");
    } finally {
      setIsSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(input);
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">AI Agent</h1>
        <p className="mt-1 text-sm text-textMuted">
          Describe what you need. The agent decides whether to answer, create a task, or create a calendar event.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-panel p-4 shadow-glow">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <label htmlFor="agent-provider" className="mb-1 block text-xs text-textMuted">
              LLM Provider
            </label>
            <select
              id="agent-provider"
              value={config?.provider ?? "openai"}
              disabled={isLoadingConfig || isSwitchingModel || !config}
              onChange={(event) => handleProviderChange(event.target.value)}
              className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain disabled:opacity-60"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Claude (Anthropic)</option>
              <option value="google">Google (Gemini)</option>
            </select>
          </div>

          <div className="min-w-[220px]">
            <label htmlFor="agent-model" className="mb-1 block text-xs text-textMuted">
              Model
            </label>
            <select
              id="agent-model"
              value={config?.model ?? ""}
              disabled={isLoadingConfig || isSwitchingModel || !config}
              onChange={(event) => handleModelChange(event.target.value)}
              className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain disabled:opacity-60"
            >
              {config &&
                config.availableModels[config.provider].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
            </select>
          </div>

          <p className="text-xs text-textMuted">
            {isLoadingConfig
              ? "Loading model settings..."
              : config
                ? `Using ${PROVIDER_LABELS[config.provider]} - ${config.model}`
                : "Model settings unavailable."}
          </p>
        </div>

        {!isLoadingConfig && !hasLinkedAi && (
          <p className="mt-3 rounded-md border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-sm text-amber-300">
            No AI provider is linked to your account yet. Add at least one API key in Settings to chat with the agent.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-border bg-panel p-3 shadow-glow sm:p-4">
        <div
          ref={listRef}
          className="h-[50vh] min-h-[360px] space-y-3 overflow-y-auto rounded-lg border border-border bg-black p-3"
        >
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg border px-3 py-2 text-sm sm:max-w-[80%] ${
                    isUser
                      ? "border-white/20 bg-white text-black"
                      : "border-border bg-panel text-textMain"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.meta && (
                    <p className="mt-2 text-xs text-textMuted">{message.meta}</p>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-border bg-panel px-3 py-2 text-xs text-textMuted">
                Agent is thinking...
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                void submit(prompt);
              }}
              disabled={isSending || !hasLinkedAi}
              className="rounded-md border border-border bg-black px-2.5 py-1 text-xs text-textMuted transition hover:bg-panelSoft hover:text-textMain disabled:cursor-not-allowed disabled:opacity-60"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type anything..."
            aria-label="Chat input"
            className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
          />
          <button
            type="submit"
            disabled={isSending || input.trim().length === 0 || !hasLinkedAi}
            className="rounded-md border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
