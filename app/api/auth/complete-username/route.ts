import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const USERNAME_REGEX = /^[a-z0-9]{3,24}$/;

const completeUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => USERNAME_REGEX.test(value), {
      message:
        "Username must be 3-24 characters and use only lowercase letters and numbers.",
    }),
});

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = completeUsernameSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid username." }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, usernameSetupComplete: true },
  });

  if (!currentUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (currentUser.usernameSetupComplete) {
    return NextResponse.json(
      { error: "Username is already locked for this account." },
      { status: 409 },
    );
  }

  const username = payload.data.username;

  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existingUser && existingUser.id !== session.user.id) {
    return NextResponse.json({ error: "Username already exists." }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      username,
      usernameSetupComplete: true,
    },
  });

  return NextResponse.json({ message: "Username saved." });
}
