import {
  LLM_MODELS,
  defaultModelForProvider,
  isLlmProvider,
  isValidModelForProvider,
  type LlmProvider,
} from "@/lib/llm-config";
import { prisma } from "@/lib/prisma";
import { canEncryptSecrets, encryptSecret } from "@/lib/secret";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const providerValues = Object.keys(LLM_MODELS) as LlmProvider[];

const settingsUpdateSchema = z.object({
  provider: z.enum(providerValues as [LlmProvider, ...LlmProvider[]]).optional(),
  model: z.string().min(1).max(120).optional(),
  openaiApiKey: z.string().min(10).max(500).optional(),
  anthropicApiKey: z.string().min(10).max(500).optional(),
  googleApiKey: z.string().min(10).max(500).optional(),
  clearOpenaiApiKey: z.boolean().optional(),
  clearAnthropicApiKey: z.boolean().optional(),
  clearGoogleApiKey: z.boolean().optional(),
});

function publicResponse(settings: {
  provider: string;
  model: string;
  openaiApiKeyEnc: string | null;
  anthropicApiKeyEnc: string | null;
  googleApiKeyEnc: string | null;
}) {
  return {
    provider: settings.provider,
    model: settings.model,
    hasOpenaiApiKey: Boolean(settings.openaiApiKeyEnc),
    hasAnthropicApiKey: Boolean(settings.anthropicApiKeyEnc),
    hasGoogleApiKey: Boolean(settings.googleApiKeyEnc),
    availableModels: LLM_MODELS,
  };
}

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.userLlmSettings.findUnique({
    where: { userId },
    select: {
      provider: true,
      model: true,
      openaiApiKeyEnc: true,
      anthropicApiKeyEnc: true,
      googleApiKeyEnc: true,
    },
  });

  if (!settings) {
    return NextResponse.json(
      publicResponse({
        provider: "openai",
        model: defaultModelForProvider("openai"),
        openaiApiKeyEnc: null,
        anthropicApiKeyEnc: null,
        googleApiKeyEnc: null,
      }),
    );
  }

  return NextResponse.json(publicResponse(settings));
}

export async function PATCH(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = settingsUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid settings payload." },
      { status: 400 },
    );
  }

  const current =
    (await prisma.userLlmSettings.findUnique({
      where: { userId },
      select: {
        provider: true,
        model: true,
      },
    })) ?? {
      provider: "openai",
      model: defaultModelForProvider("openai"),
    };

  const nextProvider = payload.data.provider ?? current.provider;
  if (!isLlmProvider(nextProvider)) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }

  const requestedModel = payload.data.model ?? current.model;
  const nextModel = isValidModelForProvider(nextProvider, requestedModel)
    ? requestedModel
    : defaultModelForProvider(nextProvider);

  const needsEncryption =
    Boolean(payload.data.openaiApiKey) ||
    Boolean(payload.data.anthropicApiKey) ||
    Boolean(payload.data.googleApiKey);

  if (needsEncryption && !canEncryptSecrets()) {
    return NextResponse.json(
      {
        error:
          "Server encryption is not configured. Set ENCRYPTION_SECRET (or NEXTAUTH_SECRET) first.",
      },
      { status: 500 },
    );
  }

  const updated = await prisma.userLlmSettings.upsert({
    where: { userId },
    create: {
      userId,
      provider: nextProvider,
      model: nextModel,
      openaiApiKeyEnc: payload.data.openaiApiKey
        ? encryptSecret(payload.data.openaiApiKey.trim())
        : null,
      anthropicApiKeyEnc: payload.data.anthropicApiKey
        ? encryptSecret(payload.data.anthropicApiKey.trim())
        : null,
      googleApiKeyEnc: payload.data.googleApiKey
        ? encryptSecret(payload.data.googleApiKey.trim())
        : null,
    },
    update: {
      provider: nextProvider,
      model: nextModel,
      openaiApiKeyEnc: payload.data.clearOpenaiApiKey
        ? null
        : payload.data.openaiApiKey
          ? encryptSecret(payload.data.openaiApiKey.trim())
          : undefined,
      anthropicApiKeyEnc: payload.data.clearAnthropicApiKey
        ? null
        : payload.data.anthropicApiKey
          ? encryptSecret(payload.data.anthropicApiKey.trim())
          : undefined,
      googleApiKeyEnc: payload.data.clearGoogleApiKey
        ? null
        : payload.data.googleApiKey
          ? encryptSecret(payload.data.googleApiKey.trim())
          : undefined,
    },
    select: {
      provider: true,
      model: true,
      openaiApiKeyEnc: true,
      anthropicApiKeyEnc: true,
      googleApiKeyEnc: true,
    },
  });

  return NextResponse.json(publicResponse(updated));
}
