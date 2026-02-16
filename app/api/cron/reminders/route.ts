import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    message:
      "Cron email reminders are not enabled yet. In-app reminders are available in Calendar.",
  });
}
