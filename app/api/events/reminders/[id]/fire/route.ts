import { jsonError, logApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  try {
    const reminder = await prisma.eventReminder.findFirst({
      where: { id: params.id, userId },
      select: { id: true, firedAt: true },
    });

    if (!reminder) {
      return jsonError(404, "Reminder not found.");
    }

    if (reminder.firedAt) {
      return NextResponse.json({ message: "Already marked as fired." });
    }

    await prisma.eventReminder.update({
      where: { id: reminder.id },
      data: { firedAt: new Date() },
    });

    return NextResponse.json({ message: "Reminder marked as fired." });
  } catch (error) {
    logApiError("POST /api/events/reminders/[id]/fire", error, {
      userId,
      reminderId: params.id,
    });

    return jsonError(500, "Unable to update reminder.", {
      route: "POST /api/events/reminders/[id]/fire",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
