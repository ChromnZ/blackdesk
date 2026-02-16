import { prisma } from "@/lib/prisma";
import { rrulestr } from "rrule";

export const DEFAULT_CALENDAR_COLOR = "#3b82f6";
export const DEFAULT_CALENDAR_NAME = "Personal";

export const EVENT_TYPE_VALUES = [
  "default",
  "focus",
  "outOfOffice",
  "workingLocation",
] as const;

export const REMINDER_METHOD_VALUES = ["inapp", "email"] as const;

export type EventTypeValue = (typeof EVENT_TYPE_VALUES)[number];
export type ReminderMethodValue = (typeof REMINDER_METHOD_VALUES)[number];

export function sanitizeHexColor(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(trimmed)) {
    return null;
  }

  return trimmed.length === 4
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
    : trimmed.toLowerCase();
}

export async function ensureDefaultCalendar(userId: string) {
  const existing = await prisma.calendar.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.calendar.create({
    data: {
      userId,
      name: DEFAULT_CALENDAR_NAME,
      color: DEFAULT_CALENDAR_COLOR,
    },
  });
}

export function parseCalendarIdsParam(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function validateRRule(rule: string) {
  try {
    rrulestr(rule);
    return true;
  } catch {
    return false;
  }
}

export function dateToIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}
