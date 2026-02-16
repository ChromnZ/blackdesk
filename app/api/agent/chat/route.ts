import {
  defaultModelForProvider,
  getLinkedProviders,
  isLlmProvider,
  type LlmProvider,
} from "@/lib/llm-config";
import { discoverAvailableModels } from "@/lib/llm-model-discovery";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret";
import { getAuthUserId } from "@/lib/session";
import { ensureDefaultCalendar } from "@/lib/calendar";
import { NextResponse } from "next/server";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(3000),
});

const chatRequestSchema = z.object({
  message: z.string().min(1).max(3000),
  history: z.array(messageSchema).max(20).optional(),
  conversationId: z.string().cuid().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

const taskDecisionSchema = z.object({
  title: z.string().min(1).max(200),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(["low", "med", "high"]).optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  notes: z.string().max(2000).optional(),
});

const eventDecisionSchema = z.object({
  title: z.string().min(1).max(200),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const agentDecisionSchema = z.object({
  action: z.enum(["reply", "create_task", "create_event"]),
  reply: z.string().min(1).max(2000),
  task: taskDecisionSchema.optional(),
  event: eventDecisionSchema.optional(),
});

type AgentDecision = z.infer<typeof agentDecisionSchema>;
type ChatHistory = Array<{ role: "user" | "assistant"; content: string }>;

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function buildConversationTitle(input: string) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "New chat";
  }
  return normalized.slice(0, 80);
}

function buildMessageMetaFromDecision(data: {
  action: "reply" | "create_task" | "create_event";
  createdTask?: {
    title: string;
    status: string;
    dueAt: Date | null;
  };
  createdEvent?: {
    title: string;
    startAt: Date;
    endAt: Date;
  };
}) {
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

const EVENT_INTENT_PATTERN =
  /\b(appointment|meeting|call|visit|dentist|doctor|event|calendar|schedule|book|reservation|flight|trip|sync)\b/i;
const TASK_INTENT_PATTERN =
  /\b(task|todo|to-do|remind me to|i need to|follow up|complete|finish)\b/i;

function parseClockFromMessage(message: string) {
  const meridianMatch = message.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (meridianMatch) {
    const rawHour = Number(meridianMatch[1]);
    const minutes = Number(meridianMatch[2] ?? "0");
    if (rawHour >= 1 && rawHour <= 12 && minutes >= 0 && minutes <= 59) {
      const meridian = meridianMatch[3].toLowerCase();
      let hours = rawHour % 12;
      if (meridian === "pm") {
        hours += 12;
      }
      return { hours, minutes };
    }
  }

  const twentyFourMatch = message.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourMatch) {
    return {
      hours: Number(twentyFourMatch[1]),
      minutes: Number(twentyFourMatch[2]),
    };
  }

  return null;
}

function parseNaturalEventStart(message: string) {
  const lower = message.toLowerCase();
  const now = new Date();
  const start = new Date(now);
  let hasExplicitDate = false;
  let hasExplicitTime = false;

  if (/\b(tomorrow|tomo|tmrw)\b/.test(lower)) {
    start.setDate(start.getDate() + 1);
    hasExplicitDate = true;
  } else if (/\btoday\b/.test(lower)) {
    hasExplicitDate = true;
  } else if (/\btonight\b/.test(lower)) {
    hasExplicitDate = true;
    start.setHours(20, 0, 0, 0);
    hasExplicitTime = true;
  } else {
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ] as const;

    for (let index = 0; index < dayNames.length; index += 1) {
      if (!new RegExp(`\\b${dayNames[index]}\\b`, "i").test(lower)) {
        continue;
      }

      const currentDay = start.getDay();
      let offset = (index - currentDay + 7) % 7;
      if (offset === 0) {
        offset = 7;
      }
      start.setDate(start.getDate() + offset);
      hasExplicitDate = true;
      break;
    }
  }

  const parsedClock = parseClockFromMessage(lower);
  if (parsedClock) {
    start.setHours(parsedClock.hours, parsedClock.minutes, 0, 0);
    hasExplicitTime = true;
  } else if (/\bmorning\b/.test(lower)) {
    start.setHours(9, 0, 0, 0);
    hasExplicitTime = true;
  } else if (/\bafternoon\b/.test(lower)) {
    start.setHours(14, 0, 0, 0);
    hasExplicitTime = true;
  } else if (/\bevening\b/.test(lower)) {
    start.setHours(18, 0, 0, 0);
    hasExplicitTime = true;
  } else if (/\bnight\b/.test(lower)) {
    start.setHours(20, 0, 0, 0);
    hasExplicitTime = true;
  }

  if (!hasExplicitDate && !hasExplicitTime) {
    return null;
  }

  if (!hasExplicitDate && hasExplicitTime && start.getTime() < now.getTime()) {
    start.setDate(start.getDate() + 1);
  }

  if (hasExplicitDate && !hasExplicitTime) {
    start.setHours(9, 0, 0, 0);
  }

  return start;
}

function extractEventTitle(input: string) {
  let title = input
    .trim()
    .replace(/[.?!]+$/g, "")
    .replace(/^((please)\s+)?(schedule|add|create|book|set up|put)\s+(an?\s+|the\s+)?/i, "")
    .replace(/^i (have|got)\s+(an?\s+|the\s+)?/i, "")
    .replace(/^there is\s+/i, "")
    .replace(/\b(tomorrow|tomo|tmrw|today|tonight)\b.*$/i, "")
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)\b.*$/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .trim();

  if (!title) {
    return "New event";
  }

  title = title.slice(0, 200);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function extractTaskTitle(input: string) {
  let title = input
    .trim()
    .replace(/[.?!]+$/g, "")
    .replace(/^task:\s*/i, "")
    .replace(/^todo:\s*/i, "")
    .replace(/^to-do:\s*/i, "")
    .replace(/^remind me to\s+/i, "")
    .replace(/^i need to\s+/i, "")
    .replace(/^please\s+/i, "")
    .trim();

  if (!title) {
    return "";
  }

  title = title.slice(0, 200);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function fallbackDecision(input: string): AgentDecision {
  const message = input.trim();
  const lower = message.toLowerCase();

  if (lower.startsWith("task:")) {
    const title = message.slice(5).trim();
    if (title.length > 0) {
      return {
        action: "create_task",
        reply: `Done. I created a task: "${title}".`,
        task: { title, status: "todo" },
      };
    }
  }

  if (lower.startsWith("event:")) {
    const title = message.slice(6).trim();
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    if (title.length > 0) {
      return {
        action: "create_event",
        reply: `Done. I created an event: "${title}".`,
        event: {
          title,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        },
      };
    }
  }

  const inferredStart = parseNaturalEventStart(message);
  if (inferredStart && EVENT_INTENT_PATTERN.test(lower)) {
    const title = extractEventTitle(message);
    const endAt = new Date(inferredStart.getTime() + 60 * 60 * 1000);

    return {
      action: "create_event",
      reply: `Done. I added "${title}" to your calendar for ${inferredStart.toLocaleString()}.`,
      event: {
        title,
        startAt: inferredStart.toISOString(),
        endAt: endAt.toISOString(),
        notes: message,
      },
    };
  }

  if (TASK_INTENT_PATTERN.test(lower)) {
    const title = extractTaskTitle(message);
    if (title) {
      return {
        action: "create_task",
        reply: `Done. I created a task: "${title}".`,
        task: {
          title,
          status: "todo",
          notes: message,
        },
      };
    }
  }

  return {
    action: "reply",
    reply:
      "I can help with planning. Try plain requests like: 'Create a task to ship invoice Friday' or 'Schedule event Team sync tomorrow 10am'.",
  };
}

function buildSystemPrompt(nowIso: string) {
  return [
    "You are BlackDesk Agent inside a productivity app.",
    "Decide if the user message should only get a reply, create a task, or create a calendar event.",
    "Always return JSON only with this exact shape:",
    '{ "action": "reply|create_task|create_event", "reply": "string", "task": {...optional...}, "event": {...optional...} }',
    "Rules:",
    "- If user intent is actionable and specific enough, choose create_task or create_event.",
    "- Task fields: title required, optional dueAt ISO datetime, priority low|med|high, status todo|doing|done, notes.",
    "- Event fields: title required, optional startAt and endAt in ISO datetime, notes.",
    "- If datetime is missing for event, still choose create_event and set a reasonable startAt/endAt.",
    "- If ambiguous, ask a concise clarification using action=reply.",
    `Current server time (ISO): ${nowIso}.`,
    "Never include markdown fences or extra text around JSON.",
  ].join("\n");
}

function parseDecisionFromText(text: string) {
  const attempt = text.trim();

  try {
    const parsedJson = JSON.parse(attempt);
    const parsedDecision = agentDecisionSchema.safeParse(parsedJson);
    if (parsedDecision.success) {
      return parsedDecision.data;
    }
  } catch {
    // continue
  }

  const start = attempt.indexOf("{");
  const end = attempt.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsedJson = JSON.parse(attempt.slice(start, end + 1));
      const parsedDecision = agentDecisionSchema.safeParse(parsedJson);
      if (parsedDecision.success) {
        return parsedDecision.data;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

async function requestDecisionFromOpenAI(args: {
  apiKey: string;
  model: string;
  message: string;
  history: ChatHistory;
}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(new Date().toISOString()) },
        ...args.history.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: args.message },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  return parseDecisionFromText(content);
}

async function requestDecisionFromAnthropic(args: {
  apiKey: string;
  model: string;
  message: string;
  history: ChatHistory;
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 1024,
      temperature: 0.2,
      system: buildSystemPrompt(new Date().toISOString()),
      messages: [
        ...args.history.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        { role: "user", content: args.message },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = payload.content?.find((part) => part.type === "text")?.text;
  if (!text) {
    return null;
  }

  return parseDecisionFromText(text);
}

async function requestDecisionFromGoogle(args: {
  apiKey: string;
  model: string;
  message: string;
  history: ChatHistory;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${encodeURIComponent(args.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt(new Date().toISOString()) }],
        },
        generationConfig: {
          temperature: 0.2,
        },
        contents: [
          ...args.history.map((item) => ({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.content }],
          })),
          { role: "user", parts: [{ text: args.message }] },
        ],
      }),
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return null;
  }

  return parseDecisionFromText(text);
}

async function requestDecisionByProvider(args: {
  provider: LlmProvider;
  model: string;
  apiKey: string | null;
  message: string;
  history: ChatHistory;
}) {
  if (!args.apiKey) {
    return null;
  }

  if (args.provider === "openai") {
    return requestDecisionFromOpenAI({
      apiKey: args.apiKey,
      model: args.model,
      message: args.message,
      history: args.history,
    });
  }

  if (args.provider === "anthropic") {
    return requestDecisionFromAnthropic({
      apiKey: args.apiKey,
      model: args.model,
      message: args.message,
      history: args.history,
    });
  }

  return requestDecisionFromGoogle({
    apiKey: args.apiKey,
    model: args.model,
    message: args.message,
    history: args.history,
  });
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsedRequest = chatRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: "Invalid chat payload." },
        { status: 400 },
      );
    }

    const message = parsedRequest.data.message.trim();
    const fallbackHistory = parsedRequest.data.history ?? [];
    const requestedConversationId = parsedRequest.data.conversationId ?? null;
    const requestProvider = parsedRequest.data.provider;
    const requestModel = parsedRequest.data.model;
    const userSettings = await prisma.userLlmSettings.findUnique({
      where: { userId },
      select: {
        provider: true,
        model: true,
        openaiApiKeyEnc: true,
        anthropicApiKeyEnc: true,
        googleApiKeyEnc: true,
      },
    });

    const openaiUserKey = decryptSecret(userSettings?.openaiApiKeyEnc);
    const anthropicUserKey = decryptSecret(userSettings?.anthropicApiKeyEnc);
    const googleUserKey = decryptSecret(userSettings?.googleApiKeyEnc);

    const availableModels = await discoverAvailableModels({
      openaiApiKey: openaiUserKey,
      anthropicApiKey: anthropicUserKey,
      googleApiKey: googleUserKey,
    });
    const linkedProviders = getLinkedProviders(availableModels);
    const hasLinkedAi = linkedProviders.length > 0;

    if (!hasLinkedAi) {
      return NextResponse.json(
        {
          error: "No AI provider is linked. Add an API key in Settings.",
          hasLinkedAi: false,
          availableModels,
        },
        { status: 400 },
      );
    }

    const persistedProvider: LlmProvider =
      userSettings &&
      isLlmProvider(userSettings.provider) &&
      linkedProviders.includes(userSettings.provider)
        ? userSettings.provider
        : linkedProviders[0];

    const requestedProvider =
      requestProvider &&
      isLlmProvider(requestProvider) &&
      linkedProviders.includes(requestProvider)
        ? requestProvider
        : null;
    const provider = requestedProvider ?? persistedProvider;
    const allowedModelsForProvider = availableModels[provider];
    const defaultAllowedModel =
      allowedModelsForProvider[0] ?? defaultModelForProvider(provider);
    const persistedModel =
      userSettings?.model && allowedModelsForProvider.includes(userSettings.model)
        ? userSettings.model
        : defaultAllowedModel;
    const model =
      requestModel && allowedModelsForProvider.includes(requestModel)
        ? requestModel
        : provider === persistedProvider
          ? persistedModel
          : defaultAllowedModel;

    const apiKey =
      provider === "openai"
        ? openaiUserKey
        : provider === "anthropic"
          ? anthropicUserKey
          : googleUserKey;

    let conversation = requestedConversationId
      ? await prisma.agentConversation.findFirst({
          where: {
            id: requestedConversationId,
            userId,
          },
          select: {
            id: true,
          },
        })
      : null;

    if (requestedConversationId && !conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    if (!conversation) {
      conversation = await prisma.agentConversation.create({
        data: {
          userId,
          title: buildConversationTitle(message),
        },
        select: {
          id: true,
        },
      });
    }

    const persistedHistory = await prisma.agentMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        role: true,
        content: true,
      },
    });

    const history: ChatHistory =
      persistedHistory.length > 0
        ? [...persistedHistory]
            .reverse()
            .filter((entry) => entry.role === "user" || entry.role === "assistant")
            .map((entry) => ({
              role: entry.role as "user" | "assistant",
              content: entry.content,
            }))
        : fallbackHistory;

    const userMessageRecord = await prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: message,
      },
      select: {
        id: true,
      },
    });

    let decision = await requestDecisionByProvider({
      provider,
      model,
      apiKey,
      message,
      history,
    });
    let usedFallback = false;

    if (!decision) {
      decision = fallbackDecision(message);
      usedFallback = true;
    }

    let responseAction: "reply" | "create_task" | "create_event" = "reply";
    let responseReply = decision.reply;
    let responseCreatedTask:
      | {
          id: string;
          title: string;
          status: string;
          dueAt: Date | null;
        }
      | undefined;
    let responseCreatedEvent:
      | {
          id: string;
          title: string;
          startAt: Date;
          endAt: Date;
        }
      | undefined;

    if (decision.action === "create_task" && decision.task) {
      const title = decision.task.title.trim();
      if (!title) {
        responseAction = "reply";
        responseReply = "I need a valid task title before creating it.";
      } else {
        const dueAt = parseDate(decision.task.dueAt);

        const task = await prisma.task.create({
          data: {
            userId,
            title,
            dueAt,
            priority: decision.task.priority ?? null,
            status: decision.task.status ?? "todo",
            notes: decision.task.notes?.trim() || null,
          },
        });

        responseAction = "create_task";
        responseCreatedTask = {
          id: task.id,
          title: task.title,
          status: task.status,
          dueAt: task.dueAt,
        };
      }
    } else if (decision.action === "create_event" && decision.event) {
      const title = decision.event.title.trim();
      if (!title) {
        responseAction = "reply";
        responseReply = "I need a valid event title before creating it.";
      } else {
        const startAt = parseDate(decision.event.startAt) ?? new Date();
        const requestedEndAt = parseDate(decision.event.endAt);
        const endAt =
          requestedEndAt && requestedEndAt > startAt
            ? requestedEndAt
            : new Date(startAt.getTime() + 60 * 60 * 1000);
        const defaultCalendar = await ensureDefaultCalendar(userId);

        const eventRecord = await prisma.event.create({
          data: {
            userId,
            calendarId: defaultCalendar.id,
            title,
            startAt,
            endAt,
            notes: decision.event.notes?.trim() || null,
          },
        });

        responseAction = "create_event";
        responseCreatedEvent = {
          id: eventRecord.id,
          title: eventRecord.title,
          startAt: eventRecord.startAt,
          endAt: eventRecord.endAt,
        };
      }
    }

    const assistantMeta = buildMessageMetaFromDecision({
      action: responseAction,
      createdTask: responseCreatedTask,
      createdEvent: responseCreatedEvent,
    });

    const assistantMessageRecord = await prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: responseReply,
        action: responseAction,
        meta: assistantMeta,
      },
      select: {
        id: true,
      },
    });

    await prisma.agentConversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      userMessageId: userMessageRecord.id,
      assistantMessageId: assistantMessageRecord.id,
      action: responseAction,
      reply: responseReply,
      createdTask: responseCreatedTask,
      createdEvent: responseCreatedEvent,
      usedFallback,
      provider,
      model,
      hasLinkedAi,
      availableModels,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to process agent request." },
      { status: 500 },
    );
  }
}
