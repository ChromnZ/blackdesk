import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

const PRIORITIES = ["low", "med", "high"] as const;
const STATUSES = ["todo", "doing", "done"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.task.findFirst({
    where: { id: params.id, userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  try {
    const body = await request.json();

    const title =
      typeof body.title === "string" ? body.title.trim() : existing.title;
    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : (existing.notes ?? "");

    const dueAt =
      body.dueAt === null
        ? null
        : body.dueAt
          ? new Date(body.dueAt)
          : existing.dueAt;

    const priority: string | null =
      body.priority === null
        ? null
        : typeof body.priority === "string" &&
            PRIORITIES.includes(body.priority as (typeof PRIORITIES)[number])
          ? body.priority
          : existing.priority;

    const status: string =
      typeof body.status === "string" &&
      STATUSES.includes(body.status as (typeof STATUSES)[number])
        ? body.status
        : existing.status;

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    if (dueAt && Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        title,
        dueAt,
        notes: notes || null,
        priority,
        status,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Unable to update task." },
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

  const existing = await prisma.task.findFirst({
    where: { id: params.id, userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "Task deleted." });
}

