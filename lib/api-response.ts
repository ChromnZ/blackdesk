import { NextResponse } from "next/server";

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

export function isDevEnvironment() {
  return process.env.NODE_ENV !== "production";
}

export function jsonError(
  status: number,
  message: string,
  details?: unknown,
) {
  const payload: { error: string; details?: unknown } = { error: message };

  if (isDevEnvironment() && details !== undefined) {
    payload.details = details;
  }

  return NextResponse.json(payload, { status });
}

export function logApiError(
  route: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const normalized = normalizeError(error);
  const logPayload: Record<string, unknown> = {
    route,
    ...context,
    error: {
      name: normalized.name,
      message: normalized.message,
    },
  };

  if (isDevEnvironment() && normalized.stack) {
    logPayload.error = {
      ...((logPayload.error as Record<string, unknown>) ?? {}),
      stack: normalized.stack,
    };
  }

  console.error("[api-error]", logPayload);
}

export async function parseJsonBody<T = unknown>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
