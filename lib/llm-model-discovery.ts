import { createHash } from "crypto";
import {
  LLM_MODELS,
  filterModernModels,
  type AvailableLlmModels,
  type LlmProvider,
} from "@/lib/llm-config";

const MODEL_DISCOVERY_TIMEOUT_MS = 5000;
const MODEL_DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;

type ModelDiscoveryCacheEntry = {
  models: string[];
  expiresAt: number;
};

const modelDiscoveryCache = new Map<string, ModelDiscoveryCacheEntry>();

class ModelDiscoveryHttpError extends Error {
  readonly status: number;

  constructor(status: number, provider: LlmProvider) {
    super(`Model discovery request failed for ${provider} with status ${status}.`);
    this.name = "ModelDiscoveryHttpError";
    this.status = status;
  }
}

type OpenAiModelListResponse = {
  data?: Array<{ id?: string }>;
};

type AnthropicModelListResponse = {
  data?: Array<{ id?: string }>;
};

type GoogleModelListResponse = {
  models?: Array<{
    name?: string;
    baseModelId?: string;
    supportedGenerationMethods?: string[];
  }>;
};

function modelCacheKey(provider: LlmProvider, apiKey: string) {
  const digest = createHash("sha256").update(`${provider}:${apiKey}`).digest("hex");
  return `${provider}:${digest}`;
}

function getCachedModels(provider: LlmProvider, apiKey: string) {
  const cacheKey = modelCacheKey(provider, apiKey);
  const cached = modelDiscoveryCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    return null;
  }

  return cached.models;
}

function getStaleCachedModels(provider: LlmProvider, apiKey: string) {
  return modelDiscoveryCache.get(modelCacheKey(provider, apiKey))?.models ?? null;
}

function setCachedModels(provider: LlmProvider, apiKey: string, models: string[]) {
  modelDiscoveryCache.set(modelCacheKey(provider, apiKey), {
    models,
    expiresAt: Date.now() + MODEL_DISCOVERY_CACHE_TTL_MS,
  });
}

function uniqueModels(models: string[]) {
  return Array.from(new Set(models));
}

function sortModels(models: string[]) {
  return [...models].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function sortOpenAiModels(models: string[]) {
  return [...models].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function isOpenAiTextModel(modelId: string) {
  const value = modelId.toLowerCase();
  if (!value || value.startsWith("ft:")) {
    return false;
  }

  const blockedTokens = [
    "audio",
    "transcribe",
    "tts",
    "realtime",
    "moderation",
    "embedding",
    "image",
    "dall-e",
    "whisper",
  ];
  if (blockedTokens.some((token) => value.includes(token))) {
    return false;
  }

  return value.startsWith("gpt-") || /^o\d/.test(value);
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, provider: LlmProvider) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, MODEL_DISCOVERY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ModelDiscoveryHttpError(response.status, provider);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function listOpenAiModels(apiKey: string) {
  const payload = await fetchJsonWithTimeout<OpenAiModelListResponse>(
    "https://api.openai.com/v1/models",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
    "openai",
  );

  const candidateModels = (payload.data ?? [])
    .map((item) => item.id?.trim() ?? "")
    .filter((value): value is string => Boolean(value))
    .filter(isOpenAiTextModel);

  return filterModernModels(
    "openai",
    sortOpenAiModels(uniqueModels(candidateModels)),
  );
}

async function listAnthropicModels(apiKey: string) {
  const payload = await fetchJsonWithTimeout<AnthropicModelListResponse>(
    "https://api.anthropic.com/v1/models",
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    },
    "anthropic",
  );

  const candidateModels = (payload.data ?? [])
    .map((item) => item.id?.trim() ?? "")
    .filter((value): value is string => value.startsWith("claude-"));

  return filterModernModels(
    "anthropic",
    sortModels(uniqueModels(candidateModels)),
  );
}

async function listGoogleModels(apiKey: string) {
  const payload = await fetchJsonWithTimeout<GoogleModelListResponse>(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    {
      method: "GET",
    },
    "google",
  );

  const candidateModels = (payload.models ?? [])
    .filter((model) =>
      (model.supportedGenerationMethods ?? []).includes("generateContent"),
    )
    .map((model) => {
      if (model.baseModelId) {
        return model.baseModelId.trim();
      }
      return model.name?.replace(/^models\//, "").trim() ?? "";
    })
    .filter((value): value is string => Boolean(value) && value.startsWith("gemini"));

  return filterModernModels("google", sortModels(uniqueModels(candidateModels)));
}

async function discoverModelsForProvider(provider: LlmProvider, apiKey: string | null) {
  if (!apiKey) {
    return [];
  }

  const cachedModels = getCachedModels(provider, apiKey);
  if (cachedModels) {
    return cachedModels;
  }

  const staleModels = getStaleCachedModels(provider, apiKey);

  try {
    const discoveredModels =
      provider === "openai"
        ? await listOpenAiModels(apiKey)
        : provider === "anthropic"
          ? await listAnthropicModels(apiKey)
          : await listGoogleModels(apiKey);

    setCachedModels(provider, apiKey, discoveredModels);
    return discoveredModels;
  } catch (error) {
    const fallbackModels = filterModernModels(
      provider,
      error instanceof ModelDiscoveryHttpError &&
      (error.status === 401 || error.status === 403)
        ? []
        : staleModels ?? [...LLM_MODELS[provider]],
    );

    setCachedModels(provider, apiKey, fallbackModels);
    return fallbackModels;
  }
}

export async function discoverAvailableModels(args: {
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  googleApiKey: string | null;
}): Promise<AvailableLlmModels> {
  const [openai, anthropic, google] = await Promise.all([
    discoverModelsForProvider("openai", args.openaiApiKey),
    discoverModelsForProvider("anthropic", args.anthropicApiKey),
    discoverModelsForProvider("google", args.googleApiKey),
  ]);

  return { openai, anthropic, google };
}
