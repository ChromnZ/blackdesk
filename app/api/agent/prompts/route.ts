import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const createPromptSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(150),
  description: z
    .union([z.string().trim().max(280), z.null()])
    .optional()
    .transform((value) => (typeof value === "string" ? value : null)),
  prompt: z.string().trim().min(1, "Prompt is required.").max(12000),
});

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = createPromptSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message ?? "Invalid prompt payload." },
        { status: 400 },
      );
    }

    const prompt = await prisma.agentPrompt.create({
      data: {
        userId,
        title: payload.data.title,
        description: payload.data.description,
        prompt: payload.data.prompt,
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

    return NextResponse.json({ prompt }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to create prompt." },
      { status: 500 },
    );
  }
}
