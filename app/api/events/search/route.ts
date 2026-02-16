import { jsonError, logApiError } from "@/lib/api-response";
import { parseCalendarIdsParam } from "@/lib/calendar";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const calendarIds = parseCalendarIdsParam(url.searchParams.get("calendarIds"));

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const events = await prisma.event.findMany({
      where: {
        userId,
        ...(calendarIds.length > 0 ? { calendarId: { in: calendarIds } } : {}),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { location: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        calendarId: true,
        location: true,
        description: true,
      },
      orderBy: [{ startAt: "asc" }],
      take: 20,
    });

    return NextResponse.json({
      results: events.map((event) => ({
        ...event,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
      })),
    });
  } catch (error) {
    logApiError("GET /api/events/search", error, {
      userId,
      queryLength: query.length,
      calendarCount: calendarIds.length,
    });

    return jsonError(500, "Unable to search events.", {
      route: "GET /api/events/search",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
