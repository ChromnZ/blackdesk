import { jsonError, logApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import ical from "ical-generator";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  try {
    const calendarRecord = await prisma.calendar.findFirst({
      where: { id: params.id, userId },
    });

    if (!calendarRecord) {
      return jsonError(404, "Calendar not found.");
    }

    const events = await prisma.event.findMany({
      where: {
        userId,
        calendarId: calendarRecord.id,
      },
      orderBy: [{ startAt: "asc" }],
      take: 5000,
    });

    const feed = ical({
      name: `BlackDesk - ${calendarRecord.name}`,
      prodId: { company: "BlackDesk", product: "Calendar", language: "EN" },
    });

    for (const event of events) {
      feed.createEvent({
        id: event.id,
        start: event.startAt,
        end: event.endAt,
        summary: event.title,
        description: event.description ?? event.notes ?? undefined,
        location: event.location ?? undefined,
        allDay: event.allDay,
      });
    }

    const filename = `${calendarRecord.name.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "calendar"}.ics`;

    return new NextResponse(feed.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logApiError("GET /api/calendars/[id]/export", error, {
      userId,
      calendarId: params.id,
    });

    return jsonError(500, "Unable to export calendar.", {
      route: "GET /api/calendars/[id]/export",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
