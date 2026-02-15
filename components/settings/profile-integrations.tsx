"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ProfileSettingsPayload = {
  username: string;
  email: string | null;
  googleLinked: boolean;
};

export function ProfileIntegrations() {
  const searchParams = useSearchParams();
  const linkedParam = searchParams.get("linked");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [googleLinked, setGoogleLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const linkedFromReturn = useMemo(() => linkedParam === "google", [linkedParam]);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/settings/profile", {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | ProfileSettingsPayload
          | { error?: string };

        if (!response.ok || !("username" in payload)) {
          setError(("error" in payload && payload.error) || "Unable to load profile settings.");
          setLoading(false);
          return;
        }

        setUsername(payload.username);
        setEmail(payload.email ?? "");
        setGoogleLinked(payload.googleLinked);
      } catch {
        setError("Unable to load profile settings.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  useEffect(() => {
    if (linkedFromReturn) {
      setSuccess("Google account linked.");
    }
  }, [linkedFromReturn]);

  async function handleSaveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingEmail(true);

    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const payload = (await response.json()) as
        | ProfileSettingsPayload
        | { error?: string };

      if (!response.ok || !("username" in payload)) {
        setError(("error" in payload && payload.error) || "Unable to update email.");
        setSavingEmail(false);
        return;
      }

      setUsername(payload.username);
      setEmail(payload.email ?? "");
      setGoogleLinked(payload.googleLinked);
      setSuccess("Email updated.");
    } catch {
      setError("Unable to update email.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleLinkGoogle() {
    setError(null);
    setSuccess(null);
    setLinkingGoogle(true);
    await signIn("google", { callbackUrl: "/app/settings?linked=google" });
    setLinkingGoogle(false);
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-panel p-5 shadow-glow">
        <h2 className="font-display text-lg">Profile & Integrations</h2>
        <p className="mt-2 text-sm text-textMuted">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-panel p-5 shadow-glow">
      <div>
        <h2 className="font-display text-lg">Profile</h2>
        <p className="mt-1 text-sm text-textMuted">
          Username is permanent. Email can be updated anytime.
        </p>
      </div>

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

      <div className="rounded-md border border-border bg-black/30 px-3 py-2">
        <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Username</p>
        <p className="mt-1 text-sm text-textMain">{username}</p>
        <p className="mt-1 text-xs text-textMuted">Lowercase letters and numbers only, cannot be changed.</p>
      </div>

      <form className="space-y-2" onSubmit={handleSaveEmail}>
        <label htmlFor="email" className="block text-sm text-textMuted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={savingEmail}
          className="rounded-md border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingEmail ? "Saving..." : "Save email"}
        </button>
      </form>

      <div className="h-px bg-border" />

      <div>
        <h3 className="font-display text-base">Integrations</h3>
        <div className="mt-3 rounded-md border border-border bg-black/30 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-textMain">Google</p>
              <p className="mt-1 text-xs text-textMuted">
                {googleLinked ? "Connected" : "Not connected"}
              </p>
            </div>
            {googleLinked ? (
              <span className="rounded-md border border-emerald-700/50 bg-emerald-900/20 px-2.5 py-1 text-xs text-emerald-300">
                Linked
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void handleLinkGoogle()}
                disabled={linkingGoogle}
                className="rounded-md border border-border bg-black px-3 py-1.5 text-sm text-textMain transition hover:bg-panelSoft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linkingGoogle ? "Redirecting..." : "Link Google"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
