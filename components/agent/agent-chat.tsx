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
import {
  AppWindow,
  Code2,
  FolderKanban,
  Library,
  type LucideIcon,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  Search,
  SendHorizontal,
  Share2,
  Telescope,
} from "lucide-react";

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

const LEFT_SHORTCUTS: { label: string; icon: LucideIcon }[] = [
  { label: "New chat", icon: MessageSquarePlus },
  { label: "Search chats", icon: Search },
  { label: "Library", icon: Library },
  { label: "Apps", icon: AppWindow },
  { label: "Deep research", icon: Telescope },
  { label: "Codex", icon: Code2 },
  { label: "Projects", icon: FolderKanban },
];

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

  const showWelcomeState = !isLoadingMessages && messages.length === 0;
  const renderComposer = (variant: "welcome" | "chat") => {
    if (variant === "chat") {
      return (
        <form
          onSubmit={onSubmit}
          className="rounded-[28px] border border-zinc-700/80 bg-zinc-900/95 px-4 py-3 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur"
        >
          <div className="flex items-end gap-2">
            <button
              type="button"
              disabled={!hasLinkedAi || isSending}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-800/90 text-zinc-300 transition hover:bg-zinc-700/80 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Attach files"
              title="Attach files"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
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
              placeholder="Ask anything"
              aria-label="Chat input"
              className="max-h-36 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-zinc-100 placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-500 focus:outline-none"
            />

            <button
              type="button"
              onClick={handleToggleVoiceCapture}
              disabled={!hasLinkedAi || isSending}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
                isRecording
                  ? "border-red-700/60 bg-red-900/30 text-red-300"
                  : "border-zinc-700/80 bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700/80 hover:text-zinc-50",
                (!hasLinkedAi || isSending) && "cursor-not-allowed opacity-50",
              )}
              aria-label={isRecording ? "Stop voice input" : "Start voice input"}
              title={isRecording ? "Stop voice input" : "Start voice input"}
            >
              <Mic className="h-4 w-4" />
            </button>

            <button
              type="submit"
              disabled={isSending || input.trim().length === 0 || !hasLinkedAi}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
              title="Send"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
        </form>
      );
    }

    return (
      <form
        onSubmit={onSubmit}
        className="w-full rounded-[26px] border border-zinc-700/70 bg-zinc-900/70 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur"
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="agent-provider"
            value={config?.provider ?? "openai"}
            disabled={isLoadingConfig || isSwitchingModel || !config || !hasLinkedAi}
            onChange={(event) => handleProviderChange(event.target.value)}
            className="min-w-[130px] rounded-full border border-zinc-700/80 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-textMain disabled:opacity-60"
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
            className="min-w-[160px] rounded-full border border-zinc-700/80 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-textMain disabled:opacity-60"
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900 text-textMuted transition hover:text-textMain"
              aria-label="Chat settings"
              title="Chat settings"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {showComposerSettings && (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-zinc-700/80 bg-zinc-950 p-3 shadow-glow">
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
                : "border-zinc-700/80 bg-zinc-900 text-textMuted hover:text-textMain",
              (!hasLinkedAi || isSending) && "cursor-not-allowed opacity-60",
            )}
            aria-label={isRecording ? "Stop voice input" : "Start voice input"}
            title={isRecording ? "Stop voice input" : "Start voice input"}
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>

        <textarea
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
          className="mt-3 min-h-[110px] w-full resize-none bg-transparent px-1 py-1.5 text-sm text-textMain placeholder:text-textMuted disabled:cursor-not-allowed disabled:text-textMuted focus:outline-none"
        />

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={isSending || input.trim().length === 0 || !hasLinkedAi}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-accent/25 bg-accent text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Send message"
            title="Send"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </form>
    );
  };

  return (
    <section className="-m-4 min-h-[calc(100vh-56px)] overflow-hidden bg-[#0f1013] md:-m-6">
      {error && (
        <div className="absolute left-6 right-6 top-4 z-30">
          <p className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        </div>
      )}

      <div className="grid min-h-[calc(100vh-56px)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden border-r border-zinc-800/80 bg-[#111215] lg:flex lg:flex-col">
          <div className="border-b border-zinc-800/70 px-4 py-3">
            <button
              type="button"
              onClick={() => void handleNewChat()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
            >
              <MessageSquarePlus className="h-4 w-4" />
              New chat
            </button>
          </div>

          <nav className="mt-2 px-2">
            {LEFT_SHORTCUTS.map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900/80 hover:text-zinc-100"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-2 px-3">
            <label
              htmlFor="chat-search"
              className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-zinc-500"
            >
              Search chats
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-zinc-500" />
              <input
                id="chat-search"
                value={conversationQuery}
                onChange={(event) => setConversationQuery(event.target.value)}
                placeholder="Find by title or message"
                className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3 px-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Chats
          </div>

          <div className="mt-2 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
            {isLoadingConversations ? (
              <p className="rounded-md border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-400">
                Loading chats...
              </p>
            ) : filteredConversations.length === 0 ? (
              <p className="rounded-md border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-400">
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
                      "group rounded-lg border px-3 py-2 transition",
                      isActive
                        ? "border-zinc-700 bg-zinc-800/80"
                        : "border-transparent hover:border-zinc-800 hover:bg-zinc-900/70",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void loadConversationById(conversation.id)}
                      className="w-full text-left"
                    >
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {conversation.title}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                        <p className="line-clamp-1">
                          {conversation.lastMessage?.content ?? "No messages yet."}
                        </p>
                        <span className="shrink-0">{formatThreadDate(conversation.updatedAt)}</span>
                      </div>
                    </button>
                    <div className="mt-2 flex gap-1 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() =>
                          void handleRenameConversation(conversation.id, conversation.title)
                        }
                        className="rounded border border-zinc-700/80 px-2 py-0.5 text-[10px] text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteConversation(conversation.id)}
                        className="rounded border border-red-900/70 px-2 py-0.5 text-[10px] text-red-300 transition hover:bg-red-900/20"
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

        <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[#1b1d21]">
          <header className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 md:px-6">
            <div className="flex items-center gap-2">
              <select
                id="agent-provider-header"
                value={config?.provider ?? "openai"}
                disabled={isLoadingConfig || isSwitchingModel || !config || !hasLinkedAi}
                onChange={(event) => handleProviderChange(event.target.value)}
                className="min-w-[120px] rounded-full border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-100 disabled:opacity-50"
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
                id="agent-model-header"
                value={config?.model ?? ""}
                disabled={isLoadingConfig || isSwitchingModel || !config || !hasLinkedAi}
                onChange={(event) => handleModelChange(event.target.value)}
                className="min-w-[170px] rounded-full border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-100 disabled:opacity-50"
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
            </div>

            {!showWelcomeState && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isSending || messages.length === 0 || !hasLinkedAi}
                  className="rounded-full border border-zinc-700/80 bg-zinc-900/75 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/75 px-3 text-sm text-zinc-200 transition hover:bg-zinc-800"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/75 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="More options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            )}
          </header>

          {showWelcomeState ? (
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-12 text-center md:px-6">
              <h2 className="text-[clamp(2.05rem,3.3vw,3.1rem)] font-semibold tracking-tight text-zinc-100">
                What can I help with?
              </h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-400">
                Start a chat to plan your day, create tasks, and schedule events.
              </p>
              <div className="mt-7 w-full max-w-3xl">{renderComposer("welcome")}</div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt);
                      void submit(prompt);
                    }}
                    disabled={isSending || !hasLinkedAi}
                    className="rounded-full border border-zinc-700/80 bg-zinc-900/75 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative flex-1 overflow-hidden">
              <div ref={listRef} className="h-full overflow-y-auto px-4 pb-44 pt-7 md:px-6">
                <div className="mx-auto w-full max-w-3xl space-y-8">
                  {isLoadingMessages ? (
                    <p className="text-sm text-zinc-400">Loading messages...</p>
                  ) : (
                    messages.map((message) => {
                      const isUser = message.role === "user";
                      return (
                        <div key={message.id} className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
                          {isUser ? (
                            <div className="max-w-[76%] rounded-3xl bg-zinc-800 px-4 py-2.5 text-[15px] leading-7 text-zinc-100">
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                          ) : (
                            <article className="w-full text-[15px] leading-8 text-zinc-100">
                              <p className="whitespace-pre-wrap">{message.content}</p>
                              {message.meta && (
                                <p className="mt-3 rounded-xl border border-zinc-700/80 bg-zinc-900/75 px-3 py-2 text-xs text-zinc-300">
                                  {message.meta}
                                </p>
                              )}
                              <div className="mt-3 flex items-center gap-2 text-zinc-500">
                                <button
                                  type="button"
                                  onClick={() => void handleCopyMessage(message.id, message.content)}
                                  className="rounded border border-zinc-700/70 px-2 py-1 text-[11px] transition hover:border-zinc-600 hover:text-zinc-300"
                                >
                                  {copiedMessageId === message.id ? "Copied" : "Copy"}
                                </button>
                                {showMessageTimes && message.createdAt && (
                                  <span className="text-[11px]">{formatMessageDateTime(message.createdAt)}</span>
                                )}
                              </div>
                            </article>
                          )}
                        </div>
                      );
                    })
                  )}

                  {isSending && (
                    <div className="w-full text-sm text-zinc-400">
                      BlackDesk is thinking...
                    </div>
                  )}
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1b1d21] via-[#1b1d21]/95 to-transparent pb-5 pt-10">
                <div className="pointer-events-auto mx-auto w-full max-w-3xl px-4 md:px-0">
                  {renderComposer("chat")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
