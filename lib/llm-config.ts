export const LLM_MODELS = {
  openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
  google: ["gemini-1.5-flash", "gemini-1.5-pro"],
} as const;

export type LlmProvider = keyof typeof LLM_MODELS;
export type AvailableLlmModels = Record<LlmProvider, string[]>;

const MODERN_MODEL_PATTERNS: Record<LlmProvider, RegExp[]> = {
  openai: [/^gpt-5(?:$|[-.])/, /^o[34](?:$|[-.])/],
  anthropic: [/^claude-(?:sonnet|opus|haiku)-4(?:$|[-.])/, /^claude-4(?:$|[-.])/],
  google: [/^gemini-2(?:$|[-.])/],
};

const LEGACY_MODEL_PATTERNS: Record<LlmProvider, RegExp[]> = {
  openai: [/^gpt-3\.5(?:$|[-.])/, /^gpt-4(?:$|[-.])/, /^gpt-4o(?:$|[-.])/],
  anthropic: [/^claude-2(?:$|[-.])/, /^claude-3(?:$|[-.])/, /^claude-instant(?:$|[-.])/],
  google: [/^gemini-1(?:$|[-.])/],
};

function uniqueAndTrimmed(models: string[]) {
  return Array.from(
    new Set(
      models
        .map((model) => model.trim())
        .filter((model): model is string => model.length > 0),
    ),
  );
}

function matchesAnyPattern(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function filterModernModels(provider: LlmProvider, models: string[]) {
  const normalizedModels = uniqueAndTrimmed(models);
  if (normalizedModels.length === 0) {
    return [];
  }

  const modernModels = normalizedModels.filter((model) =>
    matchesAnyPattern(model.toLowerCase(), MODERN_MODEL_PATTERNS[provider]),
  );
  if (modernModels.length > 0) {
    return modernModels;
  }

  return normalizedModels.filter(
    (model) =>
      !matchesAnyPattern(model.toLowerCase(), LEGACY_MODEL_PATTERNS[provider]),
  );
}

export function isLlmProvider(value: string): value is LlmProvider {
  return Object.prototype.hasOwnProperty.call(LLM_MODELS, value);
}

export function defaultModelForProvider(provider: LlmProvider) {
  return LLM_MODELS[provider][0];
}

export function isValidModelForProvider(provider: LlmProvider, model: string) {
  return (LLM_MODELS[provider] as readonly string[]).includes(model);
}

export function buildAvailableModels(args: {
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
}): AvailableLlmModels {
  return {
    openai: args.hasOpenaiApiKey
      ? filterModernModels("openai", [...LLM_MODELS.openai])
      : [],
    anthropic: args.hasAnthropicApiKey
      ? filterModernModels("anthropic", [...LLM_MODELS.anthropic])
      : [],
    google: args.hasGoogleApiKey
      ? filterModernModels("google", [...LLM_MODELS.google])
      : [],
  };
}

export function getLinkedProviders(availableModels: AvailableLlmModels) {
  return (Object.keys(availableModels) as LlmProvider[]).filter(
    (provider) => availableModels[provider].length > 0,
  );
}
