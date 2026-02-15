import {
  LLM_MODELS,
  defaultModelForProvider,
  getLinkedProviders,
  isLlmProvider,
  type AvailableLlmModels,
  type LlmProvider,
} from "@/lib/llm-config";
import { discoverAvailableModels } from "@/lib/llm-model-discovery";
import { prisma } from "@/lib/prisma";
import { canEncryptSecrets, decryptSecret, encryptSecret } from "@/lib/secret";
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

function maskSecret(encrypted: string | null) {
  if (!encrypted) {
    return null;
  }

  const decrypted = decryptSecret(encrypted);
  if (!decrypted) {
    return "******";
  }

  const maskLength = Math.min(12, Math.max(6, decrypted.length));
  return "*".repeat(maskLength);
}

function toPublicResponse(args: {
  settings: {
    provider: string;
    model: string;
    openaiApiKeyEnc: string | null;
    anthropicApiKeyEnc: string | null;
    googleApiKeyEnc: string | null;
  };
  availableModels: AvailableLlmModels;
}) {
  const { settings, availableModels } = args;
  const linkedProviders = getLinkedProviders(availableModels);
  const provider =
    isLlmProvider(settings.provider) && linkedProviders.includes(settings.provider)
      ? settings.provider
      : linkedProviders[0] ?? "openai";
  const availableModelsForProvider = linkedProviders.includes(provider)
    ? availableModels[provider]
    : [];
  const model = availableModelsForProvider.includes(settings.model)
    ? settings.model
    : availableModelsForProvider[0] ?? "";
  const hasOpenaiApiKey = Boolean(settings.openaiApiKeyEnc);
  const hasAnthropicApiKey = Boolean(settings.anthropicApiKeyEnc);
  const hasGoogleApiKey = Boolean(settings.googleApiKeyEnc);

  return {
    provider,
    model,
    hasOpenaiApiKey,
    hasAnthropicApiKey,
    hasGoogleApiKey,
    openaiApiKeyMask: maskSecret(settings.openaiApiKeyEnc),
    anthropicApiKeyMask: maskSecret(settings.anthropicApiKeyEnc),
    googleApiKeyMask: maskSecret(settings.googleApiKeyEnc),
    availableModels,
  };
}

async function publicResponse(settings: {
  provider: string;
  model: string;
  openaiApiKeyEnc: string | null;
  anthropicApiKeyEnc: string | null;
  googleApiKeyEnc: string | null;
}) {
  const availableModels = await discoverAvailableModels({
    openaiApiKey: decryptSecret(settings.openaiApiKeyEnc),
    anthropicApiKey: decryptSecret(settings.anthropicApiKeyEnc),
    googleApiKey: decryptSecret(settings.googleApiKeyEnc),
  });

  return toPublicResponse({ settings, availableModels });
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
      await publicResponse({
        provider: "openai",
        model: "",
        openaiApiKeyEnc: null,
        anthropicApiKeyEnc: null,
        googleApiKeyEnc: null,
      }),
    );
  }

  return NextResponse.json(await publicResponse(settings));
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
        openaiApiKeyEnc: true,
        anthropicApiKeyEnc: true,
        googleApiKeyEnc: true,
      },
    })) ?? {
      provider: "openai",
      model: defaultModelForProvider("openai"),
      openaiApiKeyEnc: null,
      anthropicApiKeyEnc: null,
      googleApiKeyEnc: null,
    };

  const hasOpenaiApiKey = payload.data.clearOpenaiApiKey
    ? false
    : payload.data.openaiApiKey
      ? true
      : Boolean(current.openaiApiKeyEnc);
  const hasAnthropicApiKey = payload.data.clearAnthropicApiKey
    ? false
    : payload.data.anthropicApiKey
      ? true
      : Boolean(current.anthropicApiKeyEnc);
  const hasGoogleApiKey = payload.data.clearGoogleApiKey
    ? false
    : payload.data.googleApiKey
      ? true
      : Boolean(current.googleApiKeyEnc);

  const nextOpenaiApiKey = hasOpenaiApiKey
    ? payload.data.openaiApiKey?.trim() || decryptSecret(current.openaiApiKeyEnc)
    : null;
  const nextAnthropicApiKey = hasAnthropicApiKey
    ? payload.data.anthropicApiKey?.trim() || decryptSecret(current.anthropicApiKeyEnc)
    : null;
  const nextGoogleApiKey = hasGoogleApiKey
    ? payload.data.googleApiKey?.trim() || decryptSecret(current.googleApiKeyEnc)
    : null;

  const availableModels = await discoverAvailableModels({
    openaiApiKey: nextOpenaiApiKey,
    anthropicApiKey: nextAnthropicApiKey,
    googleApiKey: nextGoogleApiKey,
  });
  const linkedProviders = getLinkedProviders(availableModels);

  const currentProvider = isLlmProvider(current.provider)
    ? current.provider
    : "openai";
  const requestedProvider = payload.data.provider ?? currentProvider;
  const nextProvider =
    linkedProviders.length === 0
      ? requestedProvider
      : linkedProviders.includes(requestedProvider)
        ? requestedProvider
        : linkedProviders[0];

  const requestedModel =
    payload.data.model ??
    (nextProvider === currentProvider ? current.model : defaultModelForProvider(nextProvider));
  const nextProviderModels = linkedProviders.includes(nextProvider)
    ? availableModels[nextProvider]
    : [];
  const nextModel = nextProviderModels.includes(requestedModel)
    ? requestedModel
    : nextProviderModels[0] ?? "";

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

  return NextResponse.json(
    toPublicResponse({
      settings: updated,
      availableModels,
    }),
  );
}
