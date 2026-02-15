import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { message: "Extract tasks/events is coming soon." },
    { status: 501 },
  );
}

