import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const USERNAME_REGEX = /^[a-z0-9]{3,24}$/;

const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => USERNAME_REGEX.test(value), {
        message:
          "Username must be 3-24 characters and use only lowercase letters and numbers.",
      }),
    email: z.string().trim().toLowerCase().email("A valid email is required."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  try {
    const payload = registerSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        {
          error: payload.error.issues[0]?.message ?? "Invalid registration payload.",
        },
        { status: 400 },
      );
    }

    const { username, email, password } = payload.data;

    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already exists." },
        { status: 409 },
      );
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email is already in use." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        name: username,
      },
    });

    return NextResponse.json({ message: "Account created." }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to create account." },
      { status: 500 },
    );
  }
}

