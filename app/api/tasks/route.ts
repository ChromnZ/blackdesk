import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { normalizeTags } from "@/lib/tags";
import { NextResponse } from "next/server";

const PRIORITIES = ["low", "med", "high"] as const;
const STATUSES = ["todo", "doing", "done"] as const;

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const tags = normalizeTags(body.tags);

    const dueAt = body.dueAt ? new Date(body.dueAt) : null;

    const priority: string | null =
      typeof body.priority === "string" &&
      PRIORITIES.includes(body.priority as (typeof PRIORITIES)[number])
        ? body.priority
        : null;

    const status: string =
      typeof body.status === "string" &&
      STATUSES.includes(body.status as (typeof STATUSES)[number])
        ? body.status
        : "todo";

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    if (dueAt && Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        userId,
        title,
        dueAt,
        notes: notes || null,
        priority,
        status,
        tags,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to create task." },
      { status: 500 },
    );
  }
}

