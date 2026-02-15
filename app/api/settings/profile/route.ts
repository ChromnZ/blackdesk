import { authOptions } from "@/lib/auth";
import { formatDisplayName } from "@/lib/name-utils";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const IMAGE_DATA_URL_REGEX =
  /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;

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
    image: z
      .string()
      .max(3_000_000, "Profile image is too large.")
      .refine((value) => IMAGE_DATA_URL_REGEX.test(value), {
        message: "Invalid image format. Use PNG, JPG, WEBP, or GIF.",
      })
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
        image: true,
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
    image: user.image,
    googleLinked: Boolean(googleAccount),
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
