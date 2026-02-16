import { jsonError, logApiError, parseJsonBody } from "@/lib/api-response";
import {
  EVENT_TYPE_VALUES,
  REMINDER_METHOD_VALUES,
  ensureDefaultCalendar,
  parseCalendarIdsParam,
  sanitizeHexColor,
  validateRRule,
} from "@/lib/calendar";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { normalizeTags } from "@/lib/tags";
import { NextResponse } from "next/server";
import { z } from "zod";

const reminderInputSchema = z.object({
  id: z.string().cuid().optional(),
  minutesBefore: z.number().int().min(0).max(60 * 24 * 30),
  method: z.enum(REMINDER_METHOD_VALUES),
});

const baseEventSchema = z.object({
  calendarId: z.string().cuid().optional(),
  parentEventId: z.string().cuid().optional(),
  originalOccurrenceStart: z.string().datetime().optional(),
  title: z.string().trim().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().optional().default(false),
  location: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  color: z.string().trim().optional().nullable(),
  eventType: z.enum(EVENT_TYPE_VALUES).optional().default("default"),
  workingLocationLabel: z.string().trim().max(120).optional().nullable(),
  timezone: z.string().trim().max(120).optional().nullable(),
  recurrenceRule: z.string().trim().optional().nullable(),
  recurrenceUntil: z.string().datetime().optional().nullable(),
  recurrenceCount: z.number().int().positive().optional().nullable(),
  exdates: z.array(z.string().datetime()).optional(),
  tags: z.array(z.string()).optional(),
  reminders: z.array(reminderInputSchema).optional(),
});

function mapEvent(event: {
  id: string;
  userId: string;
  calendarId: string;
  parentEventId: string | null;
  originalOccurrenceStart: Date | null;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  description: string | null;
  notes: string | null;
  color: string | null;
  eventType: string;
  workingLocationLabel: string | null;
  timezone: string | null;
  recurrenceRule: string | null;
  recurrenceUntil: Date | null;
  recurrenceCount: number | null;
  exdates: Date[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  reminders: { id: string; minutesBefore: number; method: string; firedAt: Date | null }[];
}) {
  return {
    ...event,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    originalOccurrenceStart: event.originalOccurrenceStart?.toISOString() ?? null,
    recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
    exdates: event.exdates.map((item) => item.toISOString()),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    reminders: event.reminders.map((reminder) => ({
      ...reminder,
      firedAt: reminder.firedAt?.toISOString() ?? null,
    })),
  };
}

function parseDateOrNull(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  const url = new URL(request.url);
  const startRaw = url.searchParams.get("start");
  const endRaw = url.searchParams.get("end");
  const calendarIds = parseCalendarIdsParam(url.searchParams.get("calendarIds"));

  const fallbackStart = new Date();
  fallbackStart.setMonth(fallbackStart.getMonth() - 3);
  const fallbackEnd = new Date();
  fallbackEnd.setMonth(fallbackEnd.getMonth() + 3);

  const parsedStart = parseDateOrNull(startRaw);
  const parsedEnd = parseDateOrNull(endRaw);

  if (startRaw && !parsedStart) {
    return jsonError(400, "Invalid start date.");
  }

  if (endRaw && !parsedEnd) {
    return jsonError(400, "Invalid end date.");
  }

  const start = parsedStart ?? fallbackStart;
  const end = parsedEnd ?? fallbackEnd;

  if (start >= end) {
    return jsonError(400, "Invalid date range.");
  }

  try {
    await ensureDefaultCalendar(userId);

    const events = await prisma.event.findMany({
      where: {
        userId,
        ...(calendarIds.length > 0 ? { calendarId: { in: calendarIds } } : {}),
        OR: [
          {
            AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }],
          },
          {
            recurrenceRule: { not: null },
          },
          {
            originalOccurrenceStart: {
              gte: start,
              lt: end,
            },
          },
        ],
      },
      include: {
        reminders: {
          orderBy: [{ minutesBefore: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      events: events.map((event) => mapEvent(event)),
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error) {
    logApiError("GET /api/events", error, {
      userId,
      query: {
        hasStart: Boolean(startRaw),
        hasEnd: Boolean(endRaw),
        calendarCount: calendarIds.length,
      },
    });

    return jsonError(500, "Unable to load events.", {
      route: "GET /api/events",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  const body = await parseJsonBody(request);
  const parsed = baseEventSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(400, "Invalid event payload.", {
      issues: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const startAt = new Date(payload.startAt);
  const endAt = new Date(payload.endAt);

  if (startAt >= endAt) {
    return jsonError(400, "End time must be after start time.");
  }

  if (payload.recurrenceRule && !validateRRule(payload.recurrenceRule)) {
    return jsonError(400, "Invalid recurrence rule.");
  }

  const recurrenceUntil = payload.recurrenceUntil
    ? new Date(payload.recurrenceUntil)
    : null;

  if (recurrenceUntil && Number.isNaN(recurrenceUntil.getTime())) {
    return jsonError(400, "Invalid recurrence end date.");
  }

  const color = sanitizeHexColor(payload.color ?? null);
  if (payload.color && !color) {
    return jsonError(400, "Invalid color value.");
  }

  const exdates = (payload.exdates ?? [])
    .map((item) => new Date(item))
    .filter((item) => !Number.isNaN(item.getTime()));

  try {
    const defaultCalendar = await ensureDefaultCalendar(userId);
    const calendarId = payload.calendarId ?? defaultCalendar.id;

    const calendar = await prisma.calendar.findFirst({
      where: { id: calendarId, userId },
      select: { id: true },
    });

    if (!calendar) {
      return jsonError(404, "Calendar not found.");
    }

    const parentEvent = payload.parentEventId
      ? await prisma.event.findFirst({
          where: { id: payload.parentEventId, userId },
          select: { id: true },
        })
      : null;

    if (payload.parentEventId && !parentEvent) {
      return jsonError(404, "Parent recurring event not found.");
    }

    const event = await prisma.event.create({
      data: {
        userId,
        calendarId,
        parentEventId: payload.parentEventId ?? null,
        originalOccurrenceStart: payload.originalOccurrenceStart
          ? new Date(payload.originalOccurrenceStart)
          : null,
        title: payload.title,
        startAt,
        endAt,
        allDay: payload.allDay,
        location: payload.location || null,
        description: payload.description || null,
        notes: payload.notes || null,
        color,
        eventType: payload.eventType,
        workingLocationLabel: payload.workingLocationLabel || null,
        timezone: payload.timezone || null,
        recurrenceRule: payload.recurrenceRule || null,
        recurrenceUntil,
        recurrenceCount: payload.recurrenceCount ?? null,
        exdates,
        tags: normalizeTags(payload.tags ?? []),
        reminders: payload.reminders
          ? {
              create: payload.reminders.map((reminder) => ({
                userId,
                minutesBefore: reminder.minutesBefore,
                method: reminder.method,
              })),
            }
          : undefined,
      },
      include: {
        reminders: {
          orderBy: [{ minutesBefore: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json(mapEvent(event), { status: 201 });
  } catch (error) {
    logApiError("POST /api/events", error, {
      userId,
      payloadShape: Object.keys(payload),
    });

    return jsonError(500, "Unable to create event.", {
      route: "POST /api/events",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
