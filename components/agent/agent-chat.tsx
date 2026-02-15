"use client";

import {
  isLlmProvider,
  type AvailableLlmModels,
  type LlmProvider,
} from "@/lib/llm-config";
import { cn } from "@/lib/utils";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  action?: "reply" | "create_task" | "create_event";
  meta?: string | null;
  createdAt?: string;
};

type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: {
    content: string;
    role: string;
    createdAt: string;
  } | null;
};

type ConversationsResponse = {
  conversations: ConversationSummary[];
};

type ConversationDetailResponse = {
  conversation: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: ChatMessage[];
  };
};

type AgentResponse = {
  conversationId?: string;
  action: "reply" | "create_task" | "create_event";
  reply: string;
  provider?: string;
  model?: string;
  hasLinkedAi?: boolean;
  availableModels?: AvailableLlmModels;
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

function getLinkedProvidersFromAvailableModels(availableModels: AvailableLlmModels) {
  return (Object.keys(availableModels) as LlmProvider[]).filter(
    (provider) => availableModels[provider].length > 0,
  );
}

function resolveProviderAndModelSelection(args: {
  availableModels: AvailableLlmModels;
  provider?: string | null;
  model?: string | null;
}) {
  const linkedProviders = getLinkedProvidersFromAvailableModels(args.availableModels);
  const provider =
    args.provider &&
    isLlmProvider(args.provider) &&
    linkedProviders.includes(args.provider)
      ? args.provider
      : linkedProviders[0] ?? "openai";
  const providerModels = args.availableModels[provider];
  const model =
    args.model && providerModels.includes(args.model)
      ? args.model
      : providerModels[0] ?? "";

  return { provider, model, linkedProviders };
}

type RecognitionAlternativeLike = {
  transcript: string;
};

type RecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternativeLike;
};

type RecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
};

type BrowserRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserRecognitionConstructorLike = new () => BrowserRecognitionLike;

function getRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as typeof window & {
    webkitSpeechRecognition?: BrowserRecognitionConstructorLike;
    SpeechRecognition?: BrowserRecognitionConstructorLike;
  };

  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition ??
    null
  );
}

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

  return null;
}

function buildConversationTitleFromUserMessage(content: string) {
  const cleaned = content.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 ? cleaned.slice(0, 60) : "New chat";
}

function formatThreadDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMessageDateTime(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AgentChat() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [conversationQuery, setConversationQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showComposerSettings, setShowComposerSettings] = useState(false);
  const [sendOnEnter, setSendOnEnter] = useState(true);
  const [showMessageTimes, setShowMessageTimes] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerSettingsRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<BrowserRecognitionLike | null>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const root = composerSettingsRef.current;
      if (!root) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !root.contains(target)) {
        setShowComposerSettings(false);
      }
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setShowComposerSettings(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoadingConfig(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/settings", { cache: "no-store" });
      const payload = (await response.json()) as AgentSettingsResponse;

      if (!response.ok) {
        setError(payload.error ?? "Unable to load AI agent model settings.");
        return;
      }

      const { provider, model } = resolveProviderAndModelSelection({
        availableModels: payload.availableModels,
        provider: payload.provider,
        model: payload.model,
      });

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
  }, []);

  const loadConversationById = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    setError(null);

    try {
      const response = await fetch(`/api/agent/conversations/${conversationId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | ConversationDetailResponse
        | { error?: string };

      if (!response.ok || !("conversation" in payload)) {
        setError(
          ("error" in payload && payload.error) || "Unable to load chat messages.",
        );
        setIsLoadingMessages(false);
        return;
      }

      setActiveConversationId(payload.conversation.id);
      setMessages(payload.conversation.messages);
    } catch {
      setError("Unable to load chat messages.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const refreshConversations = useCallback(async (options?: {
    selectConversationId?: string | null;
    autoSelectFirst?: boolean;
  }) => {
    if (!options) {
      setIsLoadingConversations(true);
    }

    try {
      const response = await fetch("/api/agent/conversations", {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | ConversationsResponse
        | { error?: string };

      if (!response.ok || !("conversations" in payload)) {
        setError(
          ("error" in payload && payload.error) ||
            "Unable to load conversations.",
        );
        return;
      }

      setConversations(payload.conversations);

      const explicitSelection = options?.selectConversationId ?? null;
      if (explicitSelection) {
        void loadConversationById(explicitSelection);
        return;
      }

      if (options?.autoSelectFirst) {
        if (payload.conversations.length > 0) {
          void loadConversationById(payload.conversations[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    } catch {
      setError("Unable to load conversations.");
    } finally {
      setIsLoadingConversations(false);
    }
  }, [loadConversationById]);

  useEffect(() => {
    void loadSettings();
    void refreshConversations({ autoSelectFirst: true });
  }, [loadSettings, refreshConversations]);

  const historyPayload = useMemo(
    () =>
      messages
        .slice(-20)
        .map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );

  const linkedProviders = useMemo(
    () =>
      config ? getLinkedProvidersFromAvailableModels(config.availableModels) : [],
    [config],
  );
  const hasLinkedAi = linkedProviders.length > 0;
  const modelOptions = useMemo(() => {
    if (!config || !linkedProviders.includes(config.provider)) {
      return [];
    }
    return config.availableModels[config.provider];
  }, [config, linkedProviders]);

  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const inTitle = conversation.title.toLowerCase().includes(query);
      const inLastMessage = conversation.lastMessage?.content
        .toLowerCase()
        .includes(query);
      return inTitle || Boolean(inLastMessage);
    });
  }, [conversationQuery, conversations]);

  const activeConversationTitle = useMemo(() => {
    if (!activeConversationId) {
      return "New chat";
    }
    return (
      conversations.find((conversation) => conversation.id === activeConversationId)
        ?.title ?? "Chat"
    );
  }, [activeConversationId, conversations]);

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

      const payload = (await response.json()) as AgentSettingsResponse;

      if (!response.ok) {
        setError(payload.error ?? "Unable to switch model.");
        return;
      }

      const { provider: nextProvider, model: nextModel } =
        resolveProviderAndModelSelection({
          availableModels: payload.availableModels,
          provider: payload.provider,
          model: payload.model,
        });

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
    if (!config || !isLlmProvider(nextValue) || !linkedProviders.includes(nextValue)) {
      return;
    }

    const nextProviderModels = config.availableModels[nextValue];
    const nextModel = nextProviderModels.includes(config.model)
      ? config.model
      : nextProviderModels[0] ?? "";

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
    if (!config || !config.availableModels[config.provider].includes(nextModel)) {
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

  async function handleNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setError(null);
    setCopiedMessageId(null);
    textareaRef.current?.focus();
  }

  async function handleRenameConversation(conversationId: string, currentTitle: string) {
    const nextTitle = window.prompt("Rename chat", currentTitle)?.trim();
    if (!nextTitle || nextTitle === currentTitle) {
      return;
    }

    const response = await fetch(`/api/agent/conversations/${conversationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: nextTitle }),
    });

    if (!response.ok) {
      setError("Unable to rename chat.");
      return;
    }

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title: nextTitle, updatedAt: new Date().toISOString() }
          : conversation,
      ),
    );
  }

  async function handleDeleteConversation(conversationId: string) {
    const confirmed = window.confirm("Delete this chat?");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/agent/conversations/${conversationId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError("Unable to delete chat.");
      return;
    }

    let nextConversationId: string | null = null;
    setConversations((current) => {
      const remaining = current.filter(
        (conversation) => conversation.id !== conversationId,
      );
      nextConversationId = remaining[0]?.id ?? null;
      return remaining;
    });

    if (activeConversationId === conversationId) {
      if (nextConversationId) {
        void loadConversationById(nextConversationId);
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    }
  }

  async function submit(text: string) {
    const cleaned = text.trim();
    if (!cleaned || isSending || !config || !hasLinkedAi) {
      return;
    }

    setError(null);
    setIsSending(true);
    setInput("");

    const optimisticUserMessage: ChatMessage = {
      id: `optimistic-user-${id()}`,
      role: "user",
      content: cleaned,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticUserMessage]);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: cleaned,
          history: historyPayload,
          conversationId: activeConversationId ?? undefined,
          provider: config.provider,
          model: config.model,
        }),
      });

      const payload = (await response.json()) as AgentResponse;

      if (!response.ok || !payload.conversationId) {
        setError(payload.error ?? "Agent request failed.");
        return;
      }
      const conversationId = payload.conversationId;

      const assistantMessage: ChatMessage = {
        id: `optimistic-assistant-${id()}`,
        role: "assistant",
        content: payload.reply,
        action: payload.action,
        meta: formatMeta(payload),
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, assistantMessage]);
      setActiveConversationId(conversationId);

      setConversations((current) => {
        const nextTitle = buildConversationTitleFromUserMessage(cleaned);
        const existing = current.find(
          (conversation) => conversation.id === conversationId,
        );

        const nextConversation: ConversationSummary = existing
          ? {
              ...existing,
              updatedAt: new Date().toISOString(),
              lastMessage: {
                content: payload.reply,
                role: "assistant",
                createdAt: new Date().toISOString(),
              },
            }
          : {
              id: conversationId,
              title: nextTitle,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastMessage: {
                content: payload.reply,
                role: "assistant",
                createdAt: new Date().toISOString(),
              },
            };

        return [
          nextConversation,
          ...current.filter(
            (conversation) => conversation.id !== conversationId,
          ),
        ];
      });

      if (payload.availableModels) {
        const { provider: nextProvider, model: nextModel } =
          resolveProviderAndModelSelection({
            availableModels: payload.availableModels,
            provider: payload.provider,
            model: payload.model,
          });

        setConfig({
          provider: nextProvider,
          model: nextModel,
          availableModels: payload.availableModels,
          hasOpenaiApiKey: payload.availableModels.openai.length > 0,
          hasAnthropicApiKey: payload.availableModels.anthropic.length > 0,
          hasGoogleApiKey: payload.availableModels.google.length > 0,
        });
      }

      await loadConversationById(conversationId);
      await refreshConversations();
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

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!hasLinkedAi) {
      return;
    }

    if (sendOnEnter && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit(input);
      return;
    }

    if (
      !sendOnEnter &&
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      void submit(input);
    }
  }

  async function handleCopyMessage(messageId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
      }, 1400);
    } catch {
      setError("Unable to copy message.");
    }
  }

  function handleToggleVoiceCapture() {
    if (!hasLinkedAi || isSending) {
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const RecognitionConstructor = getRecognitionConstructor();
    if (!RecognitionConstructor) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new RecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result?.[0]?.transcript) {
          transcript += result[0].transcript;
        }
      }

      const next = transcript.trim();
      if (next.length > 0) {
        setInput((current) => `${current} ${next}`.trim());
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setError("Unable to capture voice input.");
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    setError(null);
    setIsRecording(true);
    recognition.start();
  }

  function handleRegenerate() {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      return;
    }
    void submit(lastUserMessage.content);
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">AI Agent</h1>
        <p className="mt-1 text-sm text-textMuted">
          ChatGPT-style workspace with conversation history and model switching.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-panel p-3 shadow-glow">
          <button
            type="button"
            onClick={() => void handleNewChat()}
            className="w-full rounded-md border border-accent/25 bg-accent px-3 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90"
          >
            New chat
          </button>

          <div className="mt-3">
            <label htmlFor="chat-search" className="mb-1 block text-xs text-textMuted">
              Search chats
            </label>
            <input
              id="chat-search"
              value={conversationQuery}
              onChange={(event) => setConversationQuery(event.target.value)}
              placeholder="Search title or message"
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            />
          </div>

          <div className="mt-3 max-h-[62vh] space-y-1 overflow-y-auto pr-1">
            {isLoadingConversations ? (
              <p className="rounded-md border border-border bg-panelSoft/80 px-3 py-2 text-sm text-textMuted">
                Loading chats...
              </p>
            ) : filteredConversations.length === 0 ? (
              <p className="rounded-md border border-border bg-panelSoft/80 px-3 py-2 text-sm text-textMuted">
                {conversationQuery.trim().length > 0
                  ? "No chats match your search."
                  : "No chats yet. Start with a message."}
              </p>
            ) : (
              filteredConversations.map((conversation) => {
                const isActive = activeConversationId === conversation.id;
                return (
                  <div
                    key={conversation.id}
                    className={cn(
                      "rounded-md border p-2 transition",
                      isActive
                        ? "border-accent/25 bg-accent/10"
                        : "border-border bg-panelSoft/80",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void loadConversationById(conversation.id)}
                      className="w-full text-left"
                    >
                      <p className="truncate text-sm font-medium text-textMain">
                        {conversation.title}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-textMuted">
                        <p className="line-clamp-2">
                          {conversation.lastMessage?.content ?? "No messages yet."}
                        </p>
                        <span className="shrink-0">
                          {formatThreadDate(conversation.updatedAt)}
                        </span>
                      </div>
                    </button>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleRenameConversation(
                            conversation.id,
                            conversation.title,
                          )
                        }
                        className="rounded border border-border px-2 py-0.5 text-[11px] text-textMuted transition hover:bg-panel hover:text-textMain"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteConversation(conversation.id)}
                        className="rounded border border-red-700/40 px-2 py-0.5 text-[11px] text-red-300 transition hover:bg-red-900/25"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <div className="rounded-xl border border-border bg-panel p-3 shadow-glow sm:p-4">
          <div className="mb-3 border-b border-border pb-3">
            <p className="truncate text-sm font-semibold text-textMain">
              {activeConversationTitle}
            </p>
            <p className="text-xs text-textMuted">
              {messages.length > 0
                ? `${messages.length} messages`
                : "No messages yet"}
            </p>
          </div>

          <p className="text-xs text-textMuted">
            {isLoadingConfig
              ? "Loading model settings..."
              : config
                ? `Using ${PROVIDER_LABELS[config.provider]} - ${config.model}`
                : "Model settings unavailable."}
          </p>

          <div
            ref={listRef}
            className="mt-4 h-[52vh] min-h-[360px] space-y-3 overflow-y-auto rounded-lg border border-border bg-panelSoft p-3"
          >
            {isLoadingMessages ? (
              <p className="text-sm text-textMuted">Loading messages...</p>
            ) : messages.length === 0 ? (
              <div className="rounded-md border border-border bg-panel px-3 py-3 text-sm text-textMuted">
                Start a new conversation. I can answer questions, create tasks, and
                create calendar events.
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={cn("flex", isUser ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={`group max-w-[90%] rounded-lg border px-3 py-2 text-sm sm:max-w-[80%] ${
                        isUser
                          ? "border-accent/25 bg-accent text-accentText"
                          : "border-border bg-panel text-textMain"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em]">
                        <span className={isUser ? "text-accentText/85" : "text-textMuted"}>
                          {isUser ? "You" : "Assistant"}
                        </span>
                        <div className="flex items-center gap-2">
                          {showMessageTimes && message.createdAt && (
                            <span className={isUser ? "text-accentText/80" : "text-textMuted"}>
                              {formatMessageDateTime(message.createdAt)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyMessage(message.id, message.content)
                            }
                            className={cn(
                              "rounded border px-1.5 py-0.5 text-[10px] normal-case tracking-normal transition",
                              isUser
                                ? "border-accentText/25 text-accentText hover:bg-accentText/15"
                                : "border-border text-textMuted hover:bg-panelSoft hover:text-textMain",
                            )}
                          >
                            {copiedMessageId === message.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.meta && (
                        <p
                          className={cn(
                            "mt-2 rounded border px-2 py-1 text-xs",
                            isUser
                              ? "border-accentText/30 bg-accentText/10 text-accentText"
                              : "border-border bg-panelSoft text-textMuted",
                          )}
                        >
                          {message.meta}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}

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
                className="rounded-md border border-border bg-panelSoft px-2.5 py-1 text-xs text-textMuted transition hover:bg-panel hover:text-textMain disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isSending || messages.length === 0 || !hasLinkedAi}
              className="rounded-md border border-border bg-panelSoft px-2.5 py-1 text-xs text-textMuted transition hover:bg-panel hover:text-textMain disabled:cursor-not-allowed disabled:opacity-60"
            >
              Regenerate
            </button>
          </div>

          <form
            onSubmit={onSubmit}
            className="mt-3 rounded-2xl border border-border bg-panelSoft/80 p-3 shadow-glow"
          >
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="agent-provider"
                value={config?.provider ?? "openai"}
                disabled={isLoadingConfig || isSwitchingModel || !config || !hasLinkedAi}
                onChange={(event) => handleProviderChange(event.target.value)}
                className="min-w-[130px] rounded-full border border-border bg-panel px-3 py-1.5 text-xs font-medium text-textMain disabled:opacity-60"
                aria-label="LLM provider"
              >
                {linkedProviders.length === 0 ? (
                  <option value={config?.provider ?? "openai"}>No linked provider</option>
                ) : (
                  linkedProviders.map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDER_LABELS[provider]}
                    </option>
                  ))
                )}
              </select>

              <select
                id="agent-model"
                value={config?.model ?? ""}
                disabled={isLoadingConfig || isSwitchingModel || !config || !hasLinkedAi}
                onChange={(event) => handleModelChange(event.target.value)}
                className="min-w-[160px] rounded-full border border-border bg-panel px-3 py-1.5 text-xs font-medium text-textMain disabled:opacity-60"
                aria-label="LLM model"
              >
                {modelOptions.length === 0 ? (
                  <option value="">No models available</option>
                ) : (
                  modelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))
                )}
              </select>

              <div className="relative ml-auto" ref={composerSettingsRef}>
                <button
                  type="button"
                  onClick={() => setShowComposerSettings((current) => !current)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel text-textMuted transition hover:text-textMain"
                  aria-label="Chat settings"
                  title="Chat settings"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15" />
                    <circle cx="8" cy="7.5" r="1.5" />
                    <circle cx="16" cy="12" r="1.5" />
                    <circle cx="10" cy="16.5" r="1.5" />
                  </svg>
                </button>

                {showComposerSettings && (
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-panel p-3 shadow-glow">
                    <p className="text-xs uppercase tracking-[0.2em] text-textMuted">
                      Chat settings
                    </p>
                    <label className="mt-3 flex items-center justify-between gap-3 text-sm text-textMain">
                      <span>Send with Enter</span>
                      <input
                        type="checkbox"
                        checked={sendOnEnter}
                        onChange={(event) => setSendOnEnter(event.target.checked)}
                        className="h-4 w-4 rounded border-border bg-panel"
                      />
                    </label>
                    <label className="mt-2 flex items-center justify-between gap-3 text-sm text-textMain">
                      <span>Show timestamps</span>
                      <input
                        type="checkbox"
                        checked={showMessageTimes}
                        onChange={(event) => setShowMessageTimes(event.target.checked)}
                        className="h-4 w-4 rounded border-border bg-panel"
                      />
                    </label>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleVoiceCapture}
                disabled={!hasLinkedAi || isSending}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
                  isRecording
                    ? "border-red-700/60 bg-red-900/30 text-red-300"
                    : "border-border bg-panel text-textMuted hover:text-textMain",
                  (!hasLinkedAi || isSending) && "cursor-not-allowed opacity-60",
                )}
                aria-label={isRecording ? "Stop voice input" : "Start voice input"}
                title={isRecording ? "Stop voice input" : "Start voice input"}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a2.25 2.25 0 0 1 2.25 2.25v4.5a2.25 2.25 0 1 1-4.5 0v-4.5A2.25 2.25 0 0 1 12 4.5Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 10.5a5.25 5.25 0 1 0 10.5 0M12 15.75v3.75M9.75 19.5h4.5" />
                </svg>
              </button>
            </div>

            <textarea
              ref={textareaRef}
              rows={3}
              value={
                hasLinkedAi
                  ? input
                  : "No AI API key linked. Add one in Settings to start chatting."
              }
              onChange={(event) => {
                if (hasLinkedAi) {
                  setInput(event.target.value);
                }
              }}
              onKeyDown={onComposerKeyDown}
              disabled={!hasLinkedAi || isSending}
              placeholder="Message BlackDesk..."
              aria-label="Chat input"
              className="mt-3 w-full resize-none bg-transparent px-1 py-1.5 text-sm text-textMain placeholder:text-textMuted disabled:cursor-not-allowed disabled:text-textMuted focus:outline-none"
            />

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-textMuted">
                {sendOnEnter
                  ? "Enter sends. Shift+Enter adds a new line."
                  : "Ctrl/Cmd+Enter sends. Enter adds a new line."}
              </p>
              <button
                type="submit"
                disabled={isSending || input.trim().length === 0 || !hasLinkedAi}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-accent/25 bg-accent text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Send message"
                title="Send"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5.25 12 13.5-6.75-3 6.75 3 6.75L5.25 12Z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
