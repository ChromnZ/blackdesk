import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const renameSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = await prisma.agentConversation.findFirst({
    where: {
      id: params.id,
      userId,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          action: true,
          meta: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = renameSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid title." }, { status: 400 });
  }

  const existing = await prisma.agentConversation.findFirst({
    where: {
      id: params.id,
      userId,
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const updated = await prisma.agentConversation.update({
    where: { id: params.id },
    data: { title: payload.data.title },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ conversation: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.agentConversation.findFirst({
    where: {
      id: params.id,
      userId,
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  await prisma.agentConversation.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
