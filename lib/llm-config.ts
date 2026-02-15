export const LLM_MODELS = {
  openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
  google: ["gemini-1.5-flash", "gemini-1.5-pro"],
} as const;

export type LlmProvider = keyof typeof LLM_MODELS;
export type AvailableLlmModels = Record<LlmProvider, string[]>;

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
    openai: args.hasOpenaiApiKey ? [...LLM_MODELS.openai] : [],
    anthropic: args.hasAnthropicApiKey ? [...LLM_MODELS.anthropic] : [],
    google: args.hasGoogleApiKey ? [...LLM_MODELS.google] : [],
  };
}

export function getLinkedProviders(availableModels: AvailableLlmModels) {
  return (Object.keys(availableModels) as LlmProvider[]).filter(
    (provider) => availableModels[provider].length > 0,
  );
}
