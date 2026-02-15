import {
  defaultModelForProvider,
  isLlmProvider,
  isValidModelForProvider,
  type LlmProvider,
} from "@/lib/llm-config";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(3000),
});

const chatRequestSchema = z.object({
  message: z.string().min(1).max(3000),
  history: z.array(messageSchema).max(20).optional(),
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
    const history = parsedRequest.data.history ?? [];

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

    const provider: LlmProvider =
      userSettings && isLlmProvider(userSettings.provider)
        ? userSettings.provider
        : "openai";

    const model =
      userSettings?.model && isValidModelForProvider(provider, userSettings.model)
        ? userSettings.model
        : defaultModelForProvider(provider);

    const openaiUserKey = decryptSecret(userSettings?.openaiApiKeyEnc);
    const anthropicUserKey = decryptSecret(userSettings?.anthropicApiKeyEnc);
    const googleUserKey = decryptSecret(userSettings?.googleApiKeyEnc);

    const apiKey =
      provider === "openai"
        ? openaiUserKey ?? process.env.OPENAI_API_KEY ?? null
        : provider === "anthropic"
          ? anthropicUserKey ?? process.env.ANTHROPIC_API_KEY ?? null
          : googleUserKey ?? process.env.GOOGLE_API_KEY ?? null;

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

    if (decision.action === "create_task" && decision.task) {
      const title = decision.task.title.trim();
      if (!title) {
        return NextResponse.json(
          {
            action: "reply",
            reply: "I need a valid task title before creating it.",
            usedFallback,
            provider,
            model,
          },
          { status: 200 },
        );
      }

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

      return NextResponse.json({
        action: "create_task",
        reply: decision.reply,
        createdTask: {
          id: task.id,
          title: task.title,
          status: task.status,
          dueAt: task.dueAt,
        },
        usedFallback,
        provider,
        model,
      });
    }

    if (decision.action === "create_event" && decision.event) {
      const title = decision.event.title.trim();
      if (!title) {
        return NextResponse.json(
          {
            action: "reply",
            reply: "I need a valid event title before creating it.",
            usedFallback,
            provider,
            model,
          },
          { status: 200 },
        );
      }

      const startAt = parseDate(decision.event.startAt) ?? new Date();
      const requestedEndAt = parseDate(decision.event.endAt);
      const endAt =
        requestedEndAt && requestedEndAt > startAt
          ? requestedEndAt
          : new Date(startAt.getTime() + 60 * 60 * 1000);

      const eventRecord = await prisma.event.create({
        data: {
          userId,
          title,
          startAt,
          endAt,
          notes: decision.event.notes?.trim() || null,
        },
      });

      return NextResponse.json({
        action: "create_event",
        reply: decision.reply,
        createdEvent: {
          id: eventRecord.id,
          title: eventRecord.title,
          startAt: eventRecord.startAt,
          endAt: eventRecord.endAt,
        },
        usedFallback,
        provider,
        model,
      });
    }

    return NextResponse.json({
      action: "reply",
      reply: decision.reply,
      usedFallback,
      provider,
      model,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to process agent request." },
      { status: 500 },
    );
  }
}
