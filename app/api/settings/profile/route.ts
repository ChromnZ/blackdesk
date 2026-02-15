import { authOptions } from "@/lib/auth";
import { formatDisplayName } from "@/lib/name-utils";
import {
  MAX_PROFILE_IMAGE_DATA_URL_LENGTH,
  validateProfileImageDataUrl,
} from "@/lib/profile-image";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required.").max(60).optional(),
    lastName: z.string().trim().min(1, "Last name is required.").max(60).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("A valid email is required.")
      .optional(),
    location: z
      .string()
      .trim()
      .max(160, "Location must be 160 characters or fewer.")
      .optional(),
    timezone: z
      .string()
      .trim()
      .max(120, "Timezone must be 120 characters or fewer.")
      .optional(),
    image: z
      .string()
      .max(MAX_PROFILE_IMAGE_DATA_URL_LENGTH, "Profile image is too large.")
      .optional(),
    removeImage: z.boolean().optional(),
  })
  .refine((data) => !(data.image && data.removeImage), {
    message: "Cannot upload and remove image in the same request.",
    path: ["image"],
  });

async function loadProfileState(userId: string) {
  const [user, googleAccount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        location: true,
        timezone: true,
        image: true,
        passwordHash: true,
      },
    }),
    prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!user) {
    return null;
  }

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    location: user.location,
    timezone: user.timezone,
    image: user.image,
    googleLinked: Boolean(googleAccount),
    hasPassword: Boolean(user.passwordHash),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await loadProfileState(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = updateProfileSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid profile update." },
      { status: 400 },
    );
  }

  if (
    typeof payload.data.firstName === "undefined" &&
    typeof payload.data.lastName === "undefined" &&
    typeof payload.data.email === "undefined" &&
    typeof payload.data.location === "undefined" &&
    typeof payload.data.timezone === "undefined" &&
    typeof payload.data.image === "undefined" &&
    !payload.data.removeImage
  ) {
    return NextResponse.json(
      { error: "No profile changes provided." },
      { status: 400 },
    );
  }

  if (payload.data.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.data.email },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== session.user.id) {
      return NextResponse.json(
        { error: "Email is already in use." },
        { status: 409 },
      );
    }
  }

  if (payload.data.image) {
    const imageError = validateProfileImageDataUrl(payload.data.image);
    if (imageError) {
      return NextResponse.json({ error: imageError }, { status: 400 });
    }
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  if (!currentUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const nextFirstName = payload.data.firstName ?? currentUser.firstName;
  const nextLastName = payload.data.lastName ?? currentUser.lastName;
  const nextEmail = payload.data.email ?? currentUser.email;

  const updateData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    location?: string | null;
    timezone?: string | null;
    emailVerified?: null;
    image?: string | null;
    name?: string;
  } = {};

  if (typeof payload.data.firstName !== "undefined") {
    updateData.firstName = payload.data.firstName;
  }

  if (typeof payload.data.lastName !== "undefined") {
    updateData.lastName = payload.data.lastName;
  }

  if (payload.data.email) {
    updateData.email = payload.data.email;
    updateData.emailVerified = null;
  }

  if (typeof payload.data.location !== "undefined") {
    const nextLocation = payload.data.location.trim();
    updateData.location = nextLocation.length > 0 ? nextLocation : null;
  }

  if (typeof payload.data.timezone !== "undefined") {
    const nextTimezone = payload.data.timezone.trim();
    updateData.timezone = nextTimezone.length > 0 ? nextTimezone : null;
  }

  if (payload.data.removeImage) {
    updateData.image = null;
  } else if (payload.data.image) {
    updateData.image = payload.data.image;
  }

  updateData.name = formatDisplayName(nextFirstName, nextLastName, nextEmail);

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  const profile = await loadProfileState(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json(profile);
}
