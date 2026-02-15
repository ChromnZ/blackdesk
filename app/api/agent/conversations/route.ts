import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.agentConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          content: true,
          role: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessage:
        conversation.messages[0]
          ? {
              content: conversation.messages[0].content,
              role: conversation.messages[0].role,
              createdAt: conversation.messages[0].createdAt,
            }
          : null,
    })),
  });
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = createConversationSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid conversation payload." },
      { status: 400 },
    );
  }

  const conversation = await prisma.agentConversation.create({
    data: {
      userId,
      title: payload.data.title ?? "New chat",
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ conversation }, { status: 201 });
}
