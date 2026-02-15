"use client";

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

const QUICK_PROMPTS = [
  "Create a task to send the monthly report tomorrow at 9am.",
  "Schedule an event called Team standup for tomorrow at 10am.",
  "Help me plan my top 3 priorities for this week.",
];

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
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  const historyPayload = useMemo(
    () =>
      messages
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );

  async function submit(text: string) {
    const cleaned = text.trim();
    if (!cleaned || isSending) {
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
              disabled={isSending}
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
            disabled={isSending || input.trim().length === 0}
            className="rounded-md border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
