"use client";

import { Modal } from "@/components/console/Modal";
import { cn } from "@/lib/utils";
import { Bot, Globe, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

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

function providerPatchPayload(provider: ProviderId, value: string) {
  if (provider === "openai") {
    return { openaiApiKey: value };
  }

  if (provider === "anthropic") {
    return { anthropicApiKey: value };
  }

  return { googleApiKey: value };
}

function providerClearPayload(provider: ProviderId) {
  if (provider === "openai") {
    return { clearOpenaiApiKey: true };
  }

  if (provider === "anthropic") {
    return { clearAnthropicApiKey: true };
  }

  return { clearGoogleApiKey: true };
}

function providerById(provider: ProviderId) {
  return PROVIDERS.find((item) => item.id === provider) ?? PROVIDERS[0];
}

export function LlmSettings() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [activeProvider, setActiveProvider] = useState<ProviderId>("openai");
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [changeProvider, setChangeProvider] = useState<ProviderId | null>(null);
  const [changeApiKeyValue, setChangeApiKeyValue] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [deleteProvider, setDeleteProvider] = useState<ProviderId | null>(null);

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

  function applyPayload(payload: SettingsResponse) {
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

        applyPayload(payload);
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

      applyPayload(payload);
      setSuccess("AI settings updated.");
    } catch {
      setError("Unable to save AI settings.");
    } finally {
      setSaving(false);
    }
  }

  async function clearKey(target: ProviderId) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/agent/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(providerClearPayload(target)),
      });

      const payload = (await response.json()) as SettingsResponse;

      if (!response.ok) {
        setError(payload.error || "Unable to delete API key.");
        setSaving(false);
        return false;
      }

      applyPayload(payload);
      setSuccess("API key deleted.");
      return true;
    } catch {
      setError("Unable to delete API key.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeKeySubmit() {
    if (!changeProvider) {
      return;
    }

    const trimmedKey = changeApiKeyValue.trim();
    if (trimmedKey.length < 10) {
      setChangeError("API key must be at least 10 characters.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    setChangeError(null);

    try {
      const response = await fetch("/api/agent/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(providerPatchPayload(changeProvider, trimmedKey)),
      });

      const payload = (await response.json()) as SettingsResponse;

      if (!response.ok) {
        const nextError = payload.error || "Unable to change API key.";
        setChangeError(nextError);
        setError(nextError);
        return;
      }

      applyPayload(payload);
      setSuccess(`${providerById(changeProvider).label} API key updated.`);
      setChangeProvider(null);
      setChangeApiKeyValue("");
      setChangeError(null);
    } catch {
      setChangeError("Unable to change API key.");
      setError("Unable to change API key.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey() {
    if (!deleteProvider) {
      return;
    }

    const deleted = await clearKey(deleteProvider);
    if (deleted) {
      setDeleteProvider(null);
    }
  }

  const activeProviderConfig = providerById(activeProvider);
  const activeProviderStatus = getProviderStatus(activeProviderConfig.id);
  const hasPendingChanges =
    form.openaiApiKey.trim().length > 0 ||
    form.anthropicApiKey.trim().length > 0 ||
    form.googleApiKey.trim().length > 0;

  const changeProviderConfig = changeProvider ? providerById(changeProvider) : null;
  const deleteProviderConfig = deleteProvider ? providerById(deleteProvider) : null;

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
                      onClick={() => {
                        setChangeProvider(activeProviderConfig.id);
                        setChangeApiKeyValue("");
                        setChangeError(null);
                      }}
                      disabled={isSaving}
                      className="rounded-md border border-border bg-panel px-2 py-1 text-xs text-textMuted transition hover:text-textMain disabled:opacity-60"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteProvider(activeProviderConfig.id)}
                      disabled={isSaving}
                      className="rounded-md border border-red-700/50 bg-red-900/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-900/35 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {activeProviderStatus.hasKey ? (
              <input
                id={`${activeProviderConfig.id}-key`}
                value={activeProviderStatus.mask ?? "******"}
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

      <Modal
        title={changeProviderConfig ? `Change ${changeProviderConfig.label} API key` : "Change API key"}
        open={Boolean(changeProvider)}
        onClose={() => {
          if (isSaving) {
            return;
          }
          setChangeProvider(null);
          setChangeApiKeyValue("");
          setChangeError(null);
        }}
      >
        <div className="space-y-3">
          <p className="text-sm text-textMuted">
            Enter a new key for this provider.
          </p>
          <input
            type="password"
            value={changeApiKeyValue}
            onChange={(event) => setChangeApiKeyValue(event.target.value)}
            placeholder={changeProviderConfig?.placeholder ?? "API key"}
            className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-textMain"
          />
          {changeError && (
            <p className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              {changeError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setChangeProvider(null);
                setChangeApiKeyValue("");
                setChangeError(null);
              }}
              disabled={isSaving}
              className="rounded-md border border-border bg-panelSoft px-3 py-1.5 text-sm text-textMain transition hover:bg-panel disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleChangeKeySubmit()}
              disabled={isSaving}
              className="rounded-md border border-accent/25 bg-accent px-3 py-1.5 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save change"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        title={deleteProviderConfig ? `Delete ${deleteProviderConfig.label} API key` : "Delete API key"}
        open={Boolean(deleteProvider)}
        onClose={() => {
          if (isSaving) {
            return;
          }
          setDeleteProvider(null);
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-textMuted">
            This will remove the saved API key for this provider. Are you sure you want to continue?
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setDeleteProvider(null)}
              disabled={isSaving}
              className="rounded-md border border-border bg-panelSoft px-3 py-1.5 text-sm text-textMain transition hover:bg-panel disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteKey()}
              disabled={isSaving}
              className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-900/35 disabled:opacity-60"
            >
              {isSaving ? "Deleting..." : "Delete key"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
