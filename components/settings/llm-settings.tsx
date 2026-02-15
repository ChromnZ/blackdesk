"use client";

import {
  LLM_MODELS,
  defaultModelForProvider,
  isLlmProvider,
  isValidModelForProvider,
  type LlmProvider,
} from "@/lib/llm-config";
import { useEffect, useMemo, useState } from "react";

type SettingsResponse = {
  provider: string;
  model: string;
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
  availableModels: typeof LLM_MODELS;
};

type FormState = {
  provider: LlmProvider;
  model: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
};

function initialFormState(): FormState {
  return {
    provider: "openai",
    model: defaultModelForProvider("openai"),
    openaiApiKey: "",
    anthropicApiKey: "",
    googleApiKey: "",
    hasOpenaiApiKey: false,
    hasAnthropicApiKey: false,
    hasGoogleApiKey: false,
  };
}

export function LlmSettings() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const modelOptions = useMemo(() => LLM_MODELS[form.provider], [form.provider]);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/agent/settings", { cache: "no-store" });
        const payload = (await response.json()) as SettingsResponse | { error?: string };

        if (!response.ok || !("provider" in payload) || !isLlmProvider(payload.provider)) {
          setError("Unable to load AI settings.");
          setLoading(false);
          return;
        }

        const provider = payload.provider;
        const model = isValidModelForProvider(provider, payload.model)
          ? payload.model
          : defaultModelForProvider(provider);

        setForm({
          provider,
          model,
          openaiApiKey: "",
          anthropicApiKey: "",
          googleApiKey: "",
          hasOpenaiApiKey: payload.hasOpenaiApiKey,
          hasAnthropicApiKey: payload.hasAnthropicApiKey,
          hasGoogleApiKey: payload.hasGoogleApiKey,
        });
      } catch {
        setError("Unable to load AI settings.");
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/agent/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: form.provider,
          model: form.model,
          openaiApiKey: form.openaiApiKey.trim() || undefined,
          anthropicApiKey: form.anthropicApiKey.trim() || undefined,
          googleApiKey: form.googleApiKey.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as SettingsResponse | { error?: string };

      if (!response.ok || !("provider" in payload) || !isLlmProvider(payload.provider)) {
        setError(("error" in payload && payload.error) || "Unable to save AI settings.");
        setSaving(false);
        return;
      }

      setForm((current) => ({
        ...current,
        provider: payload.provider as LlmProvider,
        model: payload.model,
        openaiApiKey: "",
        anthropicApiKey: "",
        googleApiKey: "",
        hasOpenaiApiKey: payload.hasOpenaiApiKey,
        hasAnthropicApiKey: payload.hasAnthropicApiKey,
        hasGoogleApiKey: payload.hasGoogleApiKey,
      }));
      setSuccess("AI settings updated.");
    } catch {
      setError("Unable to save AI settings.");
    } finally {
      setSaving(false);
    }
  }

  async function clearKey(target: "openai" | "anthropic" | "google") {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const body =
      target === "openai"
        ? { clearOpenaiApiKey: true }
        : target === "anthropic"
          ? { clearAnthropicApiKey: true }
          : { clearGoogleApiKey: true };

    try {
      const response = await fetch("/api/agent/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as SettingsResponse | { error?: string };

      if (!response.ok || !("provider" in payload) || !isLlmProvider(payload.provider)) {
        setError(("error" in payload && payload.error) || "Unable to clear API key.");
        setSaving(false);
        return;
      }

      setForm((current) => ({
        ...current,
        hasOpenaiApiKey: payload.hasOpenaiApiKey,
        hasAnthropicApiKey: payload.hasAnthropicApiKey,
        hasGoogleApiKey: payload.hasGoogleApiKey,
      }));
      setSuccess("API key removed.");
    } catch {
      setError("Unable to clear API key.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-5 shadow-glow">
      <h2 className="font-display text-lg">AI Settings</h2>
      <p className="mt-1 text-sm text-textMuted">
        Choose your provider/model and store your own API keys for agent actions.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-textMuted">Loading AI settings...</p>
      ) : (
        <div className="mt-4 space-y-4">
          {error && (
            <p className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-md border border-emerald-700/50 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-300">
              {success}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="provider" className="mb-1 block text-sm text-textMuted">
                Provider
              </label>
              <select
                id="provider"
                value={form.provider}
                onChange={(event) => {
                  const nextProvider = event.target.value;
                  if (!isLlmProvider(nextProvider)) {
                    return;
                  }

                  const nextModel = isValidModelForProvider(nextProvider, form.model)
                    ? form.model
                    : defaultModelForProvider(nextProvider);

                  setForm((current) => ({
                    ...current,
                    provider: nextProvider,
                    model: nextModel,
                  }));
                }}
                className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="google">Google (Gemini)</option>
              </select>
            </div>

            <div>
              <label htmlFor="model" className="mb-1 block text-sm text-textMuted">
                Model
              </label>
              <select
                id="model"
                value={form.model}
                onChange={(event) =>
                  setForm((current) => ({ ...current, model: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain"
              >
                {modelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border bg-black p-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="openai-key" className="text-sm text-textMuted">
                OpenAI API Key
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-textMuted">
                  {form.hasOpenaiApiKey ? "Configured" : "Not set"}
                </span>
                {form.hasOpenaiApiKey && (
                  <button
                    type="button"
                    onClick={() => void clearKey("openai")}
                    disabled={isSaving}
                    className="rounded-md border border-red-700/50 bg-red-900/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-900/35 disabled:opacity-60"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <input
              id="openai-key"
              type="password"
              value={form.openaiApiKey}
              onChange={(event) =>
                setForm((current) => ({ ...current, openaiApiKey: event.target.value }))
              }
              placeholder="sk-..."
              className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-textMain"
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-black p-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="anthropic-key" className="text-sm text-textMuted">
                Anthropic API Key
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-textMuted">
                  {form.hasAnthropicApiKey ? "Configured" : "Not set"}
                </span>
                {form.hasAnthropicApiKey && (
                  <button
                    type="button"
                    onClick={() => void clearKey("anthropic")}
                    disabled={isSaving}
                    className="rounded-md border border-red-700/50 bg-red-900/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-900/35 disabled:opacity-60"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <input
              id="anthropic-key"
              type="password"
              value={form.anthropicApiKey}
              onChange={(event) =>
                setForm((current) => ({ ...current, anthropicApiKey: event.target.value }))
              }
              placeholder="sk-ant-..."
              className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-textMain"
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-black p-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="google-key" className="text-sm text-textMuted">
                Google API Key
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-textMuted">
                  {form.hasGoogleApiKey ? "Configured" : "Not set"}
                </span>
                {form.hasGoogleApiKey && (
                  <button
                    type="button"
                    onClick={() => void clearKey("google")}
                    disabled={isSaving}
                    className="rounded-md border border-red-700/50 bg-red-900/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-900/35 disabled:opacity-60"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <input
              id="google-key"
              type="password"
              value={form.googleApiKey}
              onChange={(event) =>
                setForm((current) => ({ ...current, googleApiKey: event.target.value }))
              }
              placeholder="AIza..."
              className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-textMain"
            />
          </div>

          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={isSaving}
            className="rounded-md border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save AI settings"}
          </button>
        </div>
      )}
    </div>
  );
}
