import { jsonError, logApiError } from "@/lib/api-response";
import { ensureDefaultCalendar } from "@/lib/calendar";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMPORT_EVENTS = 1000;

type ParsedIcsEvent = {
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
};

function unfoldIcsLines(input: string) {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
      continue;
    }

    lines.push(line);
  }

  return lines;
}

function parseIcsDate(value: string, forceDateOnly = false) {
  const trimmed = value.trim();

  if (forceDateOnly || /^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return {
      date,
      allDay: true,
    };
  }

  const dateTimeMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!dateTimeMatch) {
    return null;
  }

  const year = Number(dateTimeMatch[1]);
  const month = Number(dateTimeMatch[2]);
  const day = Number(dateTimeMatch[3]);
  const hour = Number(dateTimeMatch[4]);
  const minute = Number(dateTimeMatch[5]);
  const second = Number(dateTimeMatch[6]);

  const isUtc = trimmed.endsWith("Z");
  const date = isUtc
    ? new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0))
    : new Date(year, month - 1, day, hour, minute, second, 0);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date,
    allDay: false,
  };
}

function parseIcsEvents(input: string): ParsedIcsEvent[] {
  const lines = unfoldIcsLines(input);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let title = "";
  let description: string | null = null;
  let location: string | null = null;
  let startAt: Date | null = null;
  let endAt: Date | null = null;
  let allDay = false;

  const flushCurrentEvent = () => {
    if (!startAt) {
      return;
    }

    const normalizedEnd =
      endAt && endAt > startAt
        ? endAt
        : new Date(startAt.getTime() + (allDay ? 24 * 60 * 60_000 : 60 * 60_000));

    events.push({
      title: title.trim() || "Imported event",
      description: description?.trim() ? description.trim() : null,
      location: location?.trim() ? location.trim() : null,
      startAt,
      endAt: normalizedEnd,
      allDay,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      title = "";
      description = null;
      location = null;
      startAt = null;
      endAt = null;
      allDay = false;
      continue;
    }

    if (trimmed === "END:VEVENT") {
      if (inEvent) {
        flushCurrentEvent();
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const rawKey = line.slice(0, separatorIndex).toUpperCase();
    const value = line.slice(separatorIndex + 1);
    const isDateOnly = rawKey.includes("VALUE=DATE");

    if (rawKey.startsWith("SUMMARY")) {
      title = value;
      continue;
    }

    if (rawKey.startsWith("DESCRIPTION")) {
      description = value.replace(/\\n/g, "\n");
      continue;
    }

    if (rawKey.startsWith("LOCATION")) {
      location = value;
      continue;
    }

    if (rawKey.startsWith("DTSTART")) {
      const parsed = parseIcsDate(value, isDateOnly);
      if (parsed) {
        startAt = parsed.date;
        allDay = parsed.allDay;
      }
      continue;
    }

    if (rawKey.startsWith("DTEND")) {
      const parsed = parseIcsDate(value, isDateOnly);
      if (parsed) {
        endAt = parsed.date;
      }
    }
  }

  return events;
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const calendarIdRaw = formData.get("calendarId");
    const calendarId = typeof calendarIdRaw === "string" && calendarIdRaw ? calendarIdRaw : null;

    if (!(file instanceof File)) {
      return jsonError(400, "ICS file is required.");
    }

    const text = await file.text();
    if (!text.trim()) {
      return jsonError(400, "ICS file is empty.");
    }

    const fallbackCalendar = await ensureDefaultCalendar(userId);
    const targetCalendarId = calendarId ?? fallbackCalendar.id;

    const calendar = await prisma.calendar.findFirst({
      where: {
        id: targetCalendarId,
        userId,
      },
      select: { id: true },
    });

    if (!calendar) {
      return jsonError(404, "Calendar not found.");
    }

    const parsedEvents = parseIcsEvents(text).slice(0, MAX_IMPORT_EVENTS);

    if (parsedEvents.length === 0) {
      return jsonError(400, "No valid events found in the ICS file.");
    }

    const data = parsedEvents.map((event) => ({
      userId,
      calendarId: calendar.id,
      title: event.title.slice(0, 255),
      description: event.description?.slice(0, 5000) ?? null,
      location: event.location?.slice(0, 200) ?? null,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
    }));

    await prisma.event.createMany({
      data,
    });

    return NextResponse.json({
      importedCount: data.length,
      skippedCount: 0,
    });
  } catch (error) {
    logApiError("POST /api/calendars/import", error, {
      userId,
    });

    return jsonError(500, "Unable to import calendar.", {
      route: "POST /api/calendars/import",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
