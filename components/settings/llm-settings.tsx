"use client";

import { Bot, Globe, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type SettingsResponse = {
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
  openaiApiKeyMask?: string | null;
  anthropicApiKeyMask?: string | null;
  googleApiKeyMask?: string | null;
  error?: string;
};

type ProviderId = "openai" | "anthropic" | "google";

type FormState = {
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
  hasOpenaiApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasGoogleApiKey: boolean;
  openaiApiKeyMask: string | null;
  anthropicApiKeyMask: string | null;
  googleApiKeyMask: string | null;
};

function initialFormState(): FormState {
  return {
    openaiApiKey: "",
    anthropicApiKey: "",
    googleApiKey: "",
    hasOpenaiApiKey: false,
    hasAnthropicApiKey: false,
    hasGoogleApiKey: false,
    openaiApiKeyMask: null,
    anthropicApiKeyMask: null,
    googleApiKeyMask: null,
  };
}

const PROVIDERS: Array<{
  id: ProviderId;
  label: string;
  icon: typeof Bot;
  placeholder: string;
}> = [
  { id: "openai", label: "OpenAI", icon: Bot, placeholder: "sk-..." },
  { id: "anthropic", label: "Claude", icon: Sparkles, placeholder: "sk-ant-..." },
  { id: "google", label: "Google", icon: Globe, placeholder: "AIza..." },
];

export function LlmSettings() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [activeProvider, setActiveProvider] = useState<ProviderId>("openai");
  const [editingKey, setEditingKey] = useState<Record<ProviderId, boolean>>({
    openai: false,
    anthropic: false,
    google: false,
  });
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function getProviderStatus(providerId: ProviderId) {
    if (providerId === "openai") {
      return {
        hasKey: form.hasOpenaiApiKey,
        value: form.openaiApiKey,
        mask: form.openaiApiKeyMask,
      };
    }

    if (providerId === "anthropic") {
      return {
        hasKey: form.hasAnthropicApiKey,
        value: form.anthropicApiKey,
        mask: form.anthropicApiKeyMask,
      };
    }

    return {
      hasKey: form.hasGoogleApiKey,
      value: form.googleApiKey,
      mask: form.googleApiKeyMask,
    };
  }

  function setProviderValue(providerId: ProviderId, value: string) {
    if (providerId === "openai") {
      setForm((current) => ({ ...current, openaiApiKey: value }));
      return;
    }

    if (providerId === "anthropic") {
      setForm((current) => ({ ...current, anthropicApiKey: value }));
      return;
    }

    setForm((current) => ({ ...current, googleApiKey: value }));
  }

  function clearProviderValue(providerId: ProviderId) {
    if (providerId === "openai") {
      setForm((current) => ({
        ...current,
        openaiApiKey: "",
        hasOpenaiApiKey: false,
        openaiApiKeyMask: null,
      }));
      return;
    }

    if (providerId === "anthropic") {
      setForm((current) => ({
        ...current,
        anthropicApiKey: "",
        hasAnthropicApiKey: false,
        anthropicApiKeyMask: null,
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      googleApiKey: "",
      hasGoogleApiKey: false,
      googleApiKeyMask: null,
    }));
  }

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
          openaiApiKeyMask: payload.openaiApiKeyMask ?? null,
          anthropicApiKeyMask: payload.anthropicApiKeyMask ?? null,
          googleApiKeyMask: payload.googleApiKeyMask ?? null,
        });
        setEditingKey({ openai: false, anthropic: false, google: false });
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
        openaiApiKeyMask: payload.openaiApiKeyMask ?? null,
        anthropicApiKeyMask: payload.anthropicApiKeyMask ?? null,
        googleApiKeyMask: payload.googleApiKeyMask ?? null,
      }));
      setEditingKey({ openai: false, anthropic: false, google: false });
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

      clearProviderValue(target);
      setForm((current) => ({
        ...current,
        hasOpenaiApiKey: payload.hasOpenaiApiKey,
        hasAnthropicApiKey: payload.hasAnthropicApiKey,
        hasGoogleApiKey: payload.hasGoogleApiKey,
        openaiApiKeyMask: payload.openaiApiKeyMask ?? null,
        anthropicApiKeyMask: payload.anthropicApiKeyMask ?? null,
        googleApiKeyMask: payload.googleApiKeyMask ?? null,
      }));
      setEditingKey((current) => ({ ...current, [target]: false }));
      setSuccess("API key removed.");
    } catch {
      setError("Unable to clear API key.");
    } finally {
      setSaving(false);
    }
  }

  const activeProviderConfig =
    PROVIDERS.find((provider) => provider.id === activeProvider) ?? PROVIDERS[0];
  const activeProviderStatus = getProviderStatus(activeProviderConfig.id);
  const showMaskedValue =
    activeProviderStatus.hasKey &&
    !editingKey[activeProviderConfig.id] &&
    activeProviderStatus.value.trim().length === 0;
  const hasPendingChanges =
    form.openaiApiKey.trim().length > 0 ||
    form.anthropicApiKey.trim().length > 0 ||
    form.googleApiKey.trim().length > 0;

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

          <div className="grid gap-2 sm:grid-cols-3">
            {PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              const providerStatus = getProviderStatus(provider.id);

              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setActiveProvider(provider.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition",
                    activeProvider === provider.id
                      ? "border-accent/35 bg-accent/10"
                      : "border-border bg-panelSoft hover:bg-panel",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-md border",
                      activeProvider === provider.id
                        ? "border-accent/40 bg-accent/15 text-accentText"
                        : "border-border bg-panel text-textMuted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-textMain">
                      {provider.label}
                    </span>
                    <span className="block text-xs text-textMuted">
                      {providerStatus.hasKey ? "Configured" : "Not set"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 rounded-md border border-border bg-panelSoft p-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`${activeProviderConfig.id}-key`}
                className="text-sm text-textMuted"
              >
                {activeProviderConfig.label} API Key
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-textMuted">
                  {activeProviderStatus.hasKey ? "Configured" : "Not set"}
                </span>
                {activeProviderStatus.hasKey && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingKey((current) => ({
                          ...current,
                          [activeProviderConfig.id]: true,
                        }))
                      }
                      disabled={isSaving}
                      className="rounded-md border border-border bg-panel px-2 py-1 text-xs text-textMuted transition hover:text-textMain disabled:opacity-60"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => void clearKey(activeProviderConfig.id)}
                      disabled={isSaving}
                      className="rounded-md border border-red-700/50 bg-red-900/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-900/35 disabled:opacity-60"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {showMaskedValue ? (
              <input
                id={`${activeProviderConfig.id}-key`}
                value={activeProviderStatus.mask ?? ""}
                readOnly
                aria-readonly="true"
                className="w-full rounded-md border border-border bg-panel px-3 py-2 font-mono text-sm tracking-[0.08em] text-textMain"
              />
            ) : (
              <input
                id={`${activeProviderConfig.id}-key`}
                type="password"
                value={activeProviderStatus.value}
                onChange={(event) =>
                  setProviderValue(activeProviderConfig.id, event.target.value)
                }
                placeholder={activeProviderConfig.placeholder}
                className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-textMain"
              />
            )}

            {showMaskedValue && (
              <p className="text-xs text-textMuted">
                Stored key is masked by length. Click Replace to enter a new key.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={isSaving || !hasPendingChanges}
            className="rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save AI settings"}
          </button>
        </div>
      )}
    </div>
  );
}
