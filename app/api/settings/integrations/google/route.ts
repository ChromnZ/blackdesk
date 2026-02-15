import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const disconnectGoogleSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters.").max(100).optional(),
  confirmPassword: z.string().optional(),
});

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedBody: z.infer<typeof disconnectGoogleSchema> = {};

  try {
    const rawBody = await request.text();
    if (rawBody.trim().length > 0) {
      const payload = disconnectGoogleSchema.safeParse(JSON.parse(rawBody));
      if (!payload.success) {
        return NextResponse.json(
          { error: payload.error.issues[0]?.message ?? "Invalid payload." },
          { status: 400 },
        );
      }
      parsedBody = payload.data;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const googleAccount = await prisma.account.findFirst({
    where: {
      userId: user.id,
      provider: "google",
    },
    select: {
      id: true,
    },
  });

  if (!googleAccount) {
    return NextResponse.json(
      { error: "Google integration is already disconnected." },
      { status: 400 },
    );
  }

  const hasPassword = Boolean(user.passwordHash);
  const password = parsedBody.password?.trim() ?? "";
  const confirmPassword = parsedBody.confirmPassword?.trim() ?? "";

  let nextPasswordHash: string | null = null;

  if (!hasPassword) {
    if (!password) {
      return NextResponse.json(
        { error: "Set a password before disconnecting Google." },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 },
      );
    }

    nextPasswordHash = await bcrypt.hash(password, 10);
  }

  await prisma.$transaction(async (tx) => {
    if (nextPasswordHash) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: nextPasswordHash,
        },
      });
    }

    await tx.account.deleteMany({
      where: {
        userId: user.id,
        provider: "google",
      },
    });
  });

  return NextResponse.json({
    message: "Google integration disconnected.",
    googleLinked: false,
    hasPassword: true,
  });
}
