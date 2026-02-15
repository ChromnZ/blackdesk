import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.event.findFirst({
    where: { id: params.id, userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  try {
    const body = await request.json();

    const title =
      typeof body.title === "string" ? body.title.trim() : existing.title;
    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : (existing.notes ?? "");

    const startAt = body.startAt ? new Date(body.startAt) : existing.startAt;
    const endAt = body.endAt ? new Date(body.endAt) : existing.endAt;

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return NextResponse.json(
        { error: "Start and end times are required." },
        { status: 400 },
      );
    }

    if (startAt >= endAt) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }

    const updated = await prisma.event.update({
      where: { id: params.id },
      data: {
        title,
        startAt,
        endAt,
        notes: notes || null,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Unable to update event." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.event.findFirst({
    where: { id: params.id, userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  await prisma.event.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "Event deleted." });
}

