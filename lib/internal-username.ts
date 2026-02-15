import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

function normalizeSeed(seed: string | null | undefined) {
  return (seed ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
}

export async function generateInternalUsername(seed?: string | null) {
  const base = normalizeSeed(seed);

  let candidate =
    base.length >= 3
      ? `${base}${randomBytes(3).toString("hex")}`
      : `u${randomBytes(8).toString("hex")}`;

  while (true) {
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }

    candidate =
      base.length >= 3
        ? `${base}${randomBytes(3).toString("hex")}`
        : `u${randomBytes(8).toString("hex")}`;
  }
}
