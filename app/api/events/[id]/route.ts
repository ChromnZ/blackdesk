import { jsonError, logApiError, parseJsonBody } from "@/lib/api-response";
import { EVENT_TYPE_VALUES, REMINDER_METHOD_VALUES, sanitizeHexColor, validateRRule } from "@/lib/calendar";
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

const eventPatchSchema = z.object({
  scope: z.enum(["series", "single"]).optional().default("series"),
  occurrenceStart: z.string().datetime().optional(),
  calendarId: z.string().cuid().optional(),
  title: z.string().trim().min(1).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  location: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  color: z.string().trim().optional().nullable(),
  eventType: z.enum(EVENT_TYPE_VALUES).optional(),
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

function mergeExdates(existing: Date[], incoming: Date[]) {
  const map = new Map<string, Date>();

  for (const item of existing) {
    map.set(item.toISOString(), item);
  }

  for (const item of incoming) {
    map.set(item.toISOString(), item);
  }

  return [...map.values()].sort((a, b) => a.getTime() - b.getTime());
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  try {
    const event = await prisma.event.findFirst({
      where: { id: params.id, userId },
      include: {
        reminders: {
          orderBy: [{ minutesBefore: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!event) {
      return jsonError(404, "Event not found.");
    }

    return NextResponse.json(mapEvent(event));
  } catch (error) {
    logApiError("GET /api/events/[id]", error, {
      userId,
      eventId: params.id,
    });

    return jsonError(500, "Unable to load event.", {
      route: "GET /api/events/[id]",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  const body = await parseJsonBody(request);
  const parsed = eventPatchSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(400, "Invalid event payload.", {
      issues: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;

  try {
    const existing = await prisma.event.findFirst({
      where: { id: params.id, userId },
      include: {
        reminders: {
          orderBy: [{ minutesBefore: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!existing) {
      return jsonError(404, "Event not found.");
    }

    if (payload.calendarId) {
      const calendar = await prisma.calendar.findFirst({
        where: { id: payload.calendarId, userId },
        select: { id: true },
      });

      if (!calendar) {
        return jsonError(404, "Calendar not found.");
      }
    }

    const color =
      payload.color === undefined
        ? existing.color
        : payload.color === null
          ? null
          : sanitizeHexColor(payload.color);

    if (payload.color && !color) {
      return jsonError(400, "Invalid color value.");
    }

    const nextStartAt = payload.startAt ? new Date(payload.startAt) : existing.startAt;
    const nextEndAt = payload.endAt ? new Date(payload.endAt) : existing.endAt;

    if (nextStartAt >= nextEndAt) {
      return jsonError(400, "End time must be after start time.");
    }

    if (payload.recurrenceRule !== undefined && payload.recurrenceRule && !validateRRule(payload.recurrenceRule)) {
      return jsonError(400, "Invalid recurrence rule.");
    }

    const recurrenceUntil =
      payload.recurrenceUntil === undefined
        ? existing.recurrenceUntil
        : payload.recurrenceUntil
          ? new Date(payload.recurrenceUntil)
          : null;

    const exdates = payload.exdates
      ? payload.exdates.map((item) => new Date(item)).filter((item) => !Number.isNaN(item.getTime()))
      : existing.exdates;

    if (payload.scope === "single") {
      if (!payload.occurrenceStart) {
        return jsonError(400, "occurrenceStart is required for single occurrence edits.");
      }

      if (!existing.recurrenceRule) {
        return jsonError(400, "Single occurrence edits require a recurring event.");
      }

      const occurrenceStart = new Date(payload.occurrenceStart);
      if (Number.isNaN(occurrenceStart.getTime())) {
        return jsonError(400, "Invalid occurrenceStart value.");
      }

      const occurrenceDuration = existing.endAt.getTime() - existing.startAt.getTime();
      const occurrenceEnd = new Date(occurrenceStart.getTime() + occurrenceDuration);

      const mergedExdates = mergeExdates(existing.exdates, [occurrenceStart]);

      const updateSeriesPromise = prisma.event.update({
        where: { id: existing.id },
        data: { exdates: mergedExdates },
      });

      const exception = await prisma.event.create({
        data: {
          userId,
          calendarId: payload.calendarId ?? existing.calendarId,
          parentEventId: existing.id,
          originalOccurrenceStart: occurrenceStart,
          title: payload.title ?? existing.title,
          startAt: payload.startAt ? new Date(payload.startAt) : occurrenceStart,
          endAt: payload.endAt ? new Date(payload.endAt) : occurrenceEnd,
          allDay: payload.allDay ?? existing.allDay,
          location:
            payload.location === undefined ? existing.location : payload.location,
          description:
            payload.description === undefined
              ? existing.description
              : payload.description,
          notes: payload.notes === undefined ? existing.notes : payload.notes,
          color,
          eventType: payload.eventType ?? existing.eventType,
          workingLocationLabel:
            payload.workingLocationLabel === undefined
              ? existing.workingLocationLabel
              : payload.workingLocationLabel,
          timezone:
            payload.timezone === undefined ? existing.timezone : payload.timezone,
          recurrenceRule: null,
          recurrenceUntil: null,
          recurrenceCount: null,
          exdates: [],
          tags: payload.tags ? normalizeTags(payload.tags) : existing.tags,
          reminders: payload.reminders
            ? {
                create: payload.reminders.map((reminder) => ({
                  userId,
                  minutesBefore: reminder.minutesBefore,
                  method: reminder.method,
                })),
              }
            : {
                create: existing.reminders.map((reminder) => ({
                  userId,
                  minutesBefore: reminder.minutesBefore,
                  method: reminder.method,
                })),
              },
        },
        include: {
          reminders: {
            orderBy: [{ minutesBefore: "asc" }, { createdAt: "asc" }],
          },
        },
      });

      await updateSeriesPromise;

      return NextResponse.json(mapEvent(exception));
    }

    const updated = await prisma.event.update({
      where: { id: params.id },
      data: {
        calendarId: payload.calendarId ?? existing.calendarId,
        title: payload.title ?? existing.title,
        startAt: nextStartAt,
        endAt: nextEndAt,
        allDay: payload.allDay ?? existing.allDay,
        location: payload.location === undefined ? existing.location : payload.location,
        description:
          payload.description === undefined ? existing.description : payload.description,
        notes: payload.notes === undefined ? existing.notes : payload.notes,
        color,
        eventType: payload.eventType ?? existing.eventType,
        workingLocationLabel:
          payload.workingLocationLabel === undefined
            ? existing.workingLocationLabel
            : payload.workingLocationLabel,
        timezone: payload.timezone === undefined ? existing.timezone : payload.timezone,
        recurrenceRule:
          payload.recurrenceRule === undefined
            ? existing.recurrenceRule
            : payload.recurrenceRule,
        recurrenceUntil,
        recurrenceCount:
          payload.recurrenceCount === undefined
            ? existing.recurrenceCount
            : payload.recurrenceCount,
        exdates,
        tags: payload.tags ? normalizeTags(payload.tags) : existing.tags,
        reminders:
          payload.reminders !== undefined
            ? {
                deleteMany: {},
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

    return NextResponse.json(mapEvent(updated));
  } catch (error) {
    logApiError("PATCH /api/events/[id]", error, {
      userId,
      eventId: params.id,
      payloadShape: Object.keys(payload),
    });

    return jsonError(500, "Unable to update event.", {
      route: "PATCH /api/events/[id]",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "series";
  const occurrenceStartRaw = url.searchParams.get("occurrenceStart");

  try {
    const existing = await prisma.event.findFirst({
      where: { id: params.id, userId },
    });

    if (!existing) {
      return jsonError(404, "Event not found.");
    }

    if (scope === "single") {
      if (!occurrenceStartRaw) {
        return jsonError(400, "occurrenceStart is required for single occurrence delete.");
      }

      const occurrenceStart = new Date(occurrenceStartRaw);
      if (Number.isNaN(occurrenceStart.getTime())) {
        return jsonError(400, "Invalid occurrenceStart value.");
      }

      if (!existing.recurrenceRule) {
        return jsonError(400, "Single occurrence delete requires a recurring event.");
      }

      const mergedExdates = mergeExdates(existing.exdates, [occurrenceStart]);
      await prisma.event.update({
        where: { id: existing.id },
        data: { exdates: mergedExdates },
      });

      return NextResponse.json({ message: "Occurrence removed from series." });
    }

    if (!existing.parentEventId) {
      await prisma.event.deleteMany({ where: { parentEventId: existing.id, userId } });
    }

    await prisma.event.delete({ where: { id: existing.id } });
    return NextResponse.json({ message: "Event deleted." });
  } catch (error) {
    logApiError("DELETE /api/events/[id]", error, {
      userId,
      eventId: params.id,
      scope,
      hasOccurrenceStart: Boolean(occurrenceStartRaw),
    });

    return jsonError(500, "Unable to delete event.", {
      route: "DELETE /api/events/[id]",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
