import { prisma } from "@/lib/prisma";
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

async function requestDecisionFromOpenAI(args: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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

  try {
    const parsedJson = JSON.parse(content);
    const parsedDecision = agentDecisionSchema.safeParse(parsedJson);
    if (!parsedDecision.success) {
      return null;
    }
    return parsedDecision.data;
  } catch {
    return null;
  }
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

    let decision = await requestDecisionFromOpenAI({ message, history });
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
      });
    }

    return NextResponse.json({
      action: "reply",
      reply: decision.reply,
      usedFallback,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to process agent request." },
      { status: 500 },
    );
  }
}
