import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const updatePromptSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(150).optional(),
    description: z
      .union([z.string().trim().max(280), z.null()])
      .optional()
      .transform((value) => (typeof value === "string" ? value : value ?? undefined)),
    prompt: z.string().trim().min(1, "Prompt is required.").max(12000).optional(),
  })
  .refine(
    (value) =>
      typeof value.title !== "undefined" ||
      typeof value.description !== "undefined" ||
      typeof value.prompt !== "undefined",
    {
      message: "No prompt updates provided.",
      path: ["title"],
    },
  );

async function findPrompt(userId: string, id: string) {
  return prisma.agentPrompt.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      description: true,
      prompt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prompt = await findPrompt(userId, params.id);
  if (!prompt) {
    return NextResponse.json({ error: "Prompt not found." }, { status: 404 });
  }

  return NextResponse.json({ prompt });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = updatePromptSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message ?? "Invalid prompt update payload." },
        { status: 400 },
      );
    }

    const existing = await findPrompt(userId, params.id);
    if (!existing) {
      return NextResponse.json({ error: "Prompt not found." }, { status: 404 });
    }

    const title = typeof payload.data.title === "undefined"
      ? undefined
      : payload.data.title.trim();
    const description = typeof payload.data.description === "undefined"
      ? undefined
      : payload.data.description?.trim() || null;
    const promptText = typeof payload.data.prompt === "undefined"
      ? undefined
      : payload.data.prompt.trim();

    const prompt = await prisma.agentPrompt.update({
      where: { id: existing.id },
      data: {
        ...(typeof title !== "undefined" ? { title } : {}),
        ...(typeof description !== "undefined" ? { description } : {}),
        ...(typeof promptText !== "undefined" ? { prompt: promptText } : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        prompt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ prompt });
  } catch {
    return NextResponse.json(
      { error: "Unable to update prompt." },
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

  try {
    const deleted = await prisma.agentPrompt.deleteMany({
      where: {
        id: params.id,
        userId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Prompt not found." }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete prompt." },
      { status: 500 },
    );
  }
}
