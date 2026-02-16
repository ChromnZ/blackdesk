import { jsonError, logApiError, parseJsonBody } from "@/lib/api-response";
import { DEFAULT_CALENDAR_COLOR, ensureDefaultCalendar, sanitizeHexColor } from "@/lib/calendar";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const createCalendarSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().optional(),
});

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  try {
    await ensureDefaultCalendar(userId);

    const calendars = await prisma.calendar.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }],
    });

    return NextResponse.json({ calendars });
  } catch (error) {
    logApiError("GET /api/calendars", error, { userId });
    return jsonError(500, "Unable to load calendars.", {
      route: "GET /api/calendars",
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
  const parsed = createCalendarSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(400, "Invalid calendar payload.", {
      issues: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const color = sanitizeHexColor(payload.color ?? null) ?? DEFAULT_CALENDAR_COLOR;

  try {
    const calendar = await prisma.calendar.create({
      data: {
        userId,
        name: payload.name,
        color,
      },
    });

    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    logApiError("POST /api/calendars", error, {
      userId,
      payloadShape: Object.keys(payload),
    });

    return jsonError(500, "Unable to create calendar.", {
      route: "POST /api/calendars",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
