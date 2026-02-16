import { jsonError, logApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

function toReminderAt(startAt: Date, minutesBefore: number) {
  return new Date(startAt.getTime() - minutesBefore * 60_000);
}

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  const url = new URL(request.url);
  const windowMinutesRaw = Number(url.searchParams.get("windowMinutes") ?? "240");
  const windowMinutes = Number.isFinite(windowMinutesRaw)
    ? Math.min(Math.max(Math.trunc(windowMinutesRaw), 1), 24 * 60)
    : 240;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMinutes * 60_000);
  const queryStart = new Date(now.getTime() - 24 * 60 * 60_000);
  const queryEnd = new Date(now.getTime() + 30 * 24 * 60 * 60_000);

  try {
    const reminders = await prisma.eventReminder.findMany({
      where: {
        userId,
        method: "inapp",
        firedAt: null,
        event: {
          startAt: {
            gte: queryStart,
            lte: queryEnd,
          },
        },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startAt: true,
            calendarId: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 300,
    });

    const upcoming = reminders
      .map((reminder) => {
        const reminderAt = toReminderAt(reminder.event.startAt, reminder.minutesBefore);
        return {
          id: reminder.id,
          eventId: reminder.event.id,
          eventTitle: reminder.event.title,
          calendarId: reminder.event.calendarId,
          eventStartAt: reminder.event.startAt.toISOString(),
          reminderAt: reminderAt.toISOString(),
          minutesBefore: reminder.minutesBefore,
        };
      })
      .filter((item) => {
        const reminderAt = new Date(item.reminderAt);
        return reminderAt >= new Date(now.getTime() - 5 * 60_000) && reminderAt <= windowEnd;
      })
      .sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime());

    return NextResponse.json({ now: now.toISOString(), reminders: upcoming });
  } catch (error) {
    logApiError("GET /api/events/reminders", error, {
      userId,
      windowMinutes,
    });

    return jsonError(500, "Unable to load reminders.", {
      route: "GET /api/events/reminders",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
