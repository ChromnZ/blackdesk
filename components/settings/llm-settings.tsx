"use client";

import { useEffect, useState } from "react";

type SettingsResponse = {
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
  error?: string;
};

type FormState = {
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
};

function initialFormState(): FormState {
  return {
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

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/agent/settings", { cache: "no-store" });
        const payload = (await response.json()) as SettingsResponse;

        if (!response.ok) {
          setError(payload.error ?? "Unable to load AI settings.");
          setLoading(false);
          return;
        }

        setForm({
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
          openaiApiKey: form.openaiApiKey.trim() || undefined,
          anthropicApiKey: form.anthropicApiKey.trim() || undefined,
          googleApiKey: form.googleApiKey.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as SettingsResponse;

      if (!response.ok) {
        setError(payload.error || "Unable to save AI settings.");
        setSaving(false);
        return;
      }

      setForm((current) => ({
        ...current,
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

      const payload = (await response.json()) as SettingsResponse;

      if (!response.ok) {
        setError(payload.error || "Unable to clear API key.");
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
        Add and manage provider API keys. Provider/model selection is handled in AI Agent.
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

          <div className="space-y-3 rounded-md border border-border bg-panelSoft p-3">
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

          <div className="space-y-3 rounded-md border border-border bg-panelSoft p-3">
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

          <div className="space-y-3 rounded-md border border-border bg-panelSoft p-3">
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
            className="rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save AI settings"}
          </button>
        </div>
      )}
    </div>
  );
}
