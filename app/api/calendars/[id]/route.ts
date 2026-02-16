import { jsonError, logApiError, parseJsonBody } from "@/lib/api-response";
import { sanitizeHexColor } from "@/lib/calendar";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  const body = await parseJsonBody(request);
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(400, "Invalid calendar payload.", {
      issues: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;

  if (payload.name === undefined && payload.color === undefined) {
    return jsonError(400, "Nothing to update.");
  }

  const color =
    payload.color === undefined
      ? undefined
      : sanitizeHexColor(payload.color) ?? null;

  if (payload.color !== undefined && !color) {
    return jsonError(400, "Invalid color value.");
  }

  try {
    const existing = await prisma.calendar.findFirst({
      where: { id: params.id, userId },
    });

    if (!existing) {
      return jsonError(404, "Calendar not found.");
    }

    const updated = await prisma.calendar.update({
      where: { id: existing.id },
      data: {
        name: payload.name ?? existing.name,
        color: color ?? existing.color,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logApiError("PATCH /api/calendars/[id]", error, {
      userId,
      calendarId: params.id,
      payloadShape: Object.keys(payload),
    });

    return jsonError(500, "Unable to update calendar.", {
      route: "PATCH /api/calendars/[id]",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  try {
    const existing = await prisma.calendar.findFirst({
      where: { id: params.id, userId },
    });

    if (!existing) {
      return jsonError(404, "Calendar not found.");
    }

    const calendars = await prisma.calendar.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (calendars.length <= 1) {
      return jsonError(400, "At least one calendar is required.");
    }

    const fallback = calendars.find((calendar) => calendar.id !== existing.id);

    if (!fallback) {
      return jsonError(400, "Unable to resolve fallback calendar.");
    }

    await prisma.$transaction([
      prisma.event.updateMany({
        where: {
          userId,
          calendarId: existing.id,
        },
        data: {
          calendarId: fallback.id,
        },
      }),
      prisma.calendar.delete({ where: { id: existing.id } }),
    ]);

    return NextResponse.json({ message: "Calendar deleted." });
  } catch (error) {
    logApiError("DELETE /api/calendars/[id]", error, {
      userId,
      calendarId: params.id,
    });

    return jsonError(500, "Unable to delete calendar.", {
      route: "DELETE /api/calendars/[id]",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
