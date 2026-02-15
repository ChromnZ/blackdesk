import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.inboxItem.findFirst({
    where: { id: params.id, userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
  }

  await prisma.inboxItem.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "Inbox item deleted." });
}

