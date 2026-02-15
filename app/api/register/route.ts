import bcrypt from "bcryptjs";
import { detectGeoFromRequest } from "@/lib/geo";
import { generateInternalUsername } from "@/lib/internal-username";
import { formatDisplayName } from "@/lib/name-utils";
import {
  MAX_PROFILE_IMAGE_DATA_URL_LENGTH,
  validateProfileImageDataUrl,
} from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required.").max(60),
    lastName: z.string().trim().min(1, "Last name is required.").max(60),
    email: z.string().trim().toLowerCase().email("A valid email is required."),
    image: z
      .string()
      .max(MAX_PROFILE_IMAGE_DATA_URL_LENGTH, "Profile image is too large.")
      .optional(),
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

    const { firstName, lastName, email, image, password } = payload.data;

    if (image) {
      const imageError = validateProfileImageDataUrl(image);
      if (imageError) {
        return NextResponse.json({ error: imageError }, { status: 400 });
      }
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
    const username = await generateInternalUsername(email);
    const geo = await detectGeoFromRequest(request);

    await prisma.user.create({
      data: {
        firstName,
        lastName,
        username,
        email,
        location: geo.location,
        timezone: geo.timezone,
        image: image ?? null,
        passwordHash,
        name: formatDisplayName(firstName, lastName, email),
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

