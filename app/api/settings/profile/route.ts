import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, googleAccount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        username: true,
        email: true,
      },
    }),
    prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    username: user.username,
    email: user.email,
    googleLinked: Boolean(googleAccount),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = emailSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid email." },
      { status: 400 },
    );
  }

  const email = payload.data.email;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser && existingUser.id !== session.user.id) {
    return NextResponse.json(
      { error: "Email is already in use." },
      { status: 409 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      email,
      emailVerified: null,
    },
    select: {
      username: true,
      email: true,
    },
  });

  const googleAccount = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "google",
    },
    select: {
      id: true,
    },
  });

  return NextResponse.json({
    username: updated.username,
    email: updated.email,
    googleLinked: Boolean(googleAccount),
  });
}
