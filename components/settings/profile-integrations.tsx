"use client";

import { initialsFromName } from "@/lib/name-utils";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ProfileSettingsPayload = {
  firstName: string;
  lastName: string;
  email: string | null;
  image: string | null;
  googleLinked: boolean;
};

const MAX_AVATAR_FILE_BYTES = 1_500_000;

export function ProfileIntegrations() {
  const searchParams = useSearchParams();
  const linkedParam = searchParams.get("linked");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(
    null,
  );
  const [removeImage, setRemoveImage] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
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

        if (!response.ok || !("firstName" in payload)) {
          setError(("error" in payload && payload.error) || "Unable to load profile settings.");
          setLoading(false);
          return;
        }

        setFirstName(payload.firstName);
        setLastName(payload.lastName);
        setEmail(payload.email ?? "");
        setImage(payload.image ?? null);
        setPendingImageDataUrl(null);
        setRemoveImage(false);
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
      setSuccess("Google account linked. Profile synced from Google.");
    }
  }, [linkedFromReturn]);

  function handleSelectAvatar() {
    fileInputRef.current?.click();
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (selectedFile.size > MAX_AVATAR_FILE_BYTES) {
      setError("Image is too large. Use an image smaller than 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Unable to read image file.");
        return;
      }

      setError(null);
      setSuccess(null);
      setPendingImageDataUrl(reader.result);
      setRemoveImage(false);
      setImage(reader.result);
    };
    reader.onerror = () => {
      setError("Unable to read image file.");
    };
    reader.readAsDataURL(selectedFile);
    event.target.value = "";
  }

  function handleRemoveAvatar() {
    setPendingImageDataUrl(null);
    setRemoveImage(true);
    setImage(null);
    setError(null);
    setSuccess(null);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingProfile(true);

    try {
      const body: {
        firstName?: string;
        lastName?: string;
        email?: string;
        image?: string;
        removeImage?: boolean;
      } = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      };

      if (pendingImageDataUrl) {
        body.image = pendingImageDataUrl;
      }
      if (removeImage) {
        body.removeImage = true;
      }

      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as
        | ProfileSettingsPayload
        | { error?: string };

      if (!response.ok || !("firstName" in payload)) {
        setError(("error" in payload && payload.error) || "Unable to update profile.");
        setSavingProfile(false);
        return;
      }

      setFirstName(payload.firstName);
      setLastName(payload.lastName);
      setEmail(payload.email ?? "");
      setImage(payload.image ?? null);
      setPendingImageDataUrl(null);
      setRemoveImage(false);
      setGoogleLinked(payload.googleLinked);
      setSuccess("Profile updated.");
    } catch {
      setError("Unable to update profile.");
    } finally {
      setSavingProfile(false);
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
          Use your real name and email. Google linking keeps these synced.
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

      <div className="rounded-md border border-border bg-panelSoft/80 p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-textMuted">
          Profile Picture
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-panelSoft text-xl font-semibold text-textMain">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={`${firstName} ${lastName} profile picture`}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              initialsFromName(firstName, lastName, email)
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={handleSelectAvatar}
              className="rounded-md border border-border bg-panelSoft px-3 py-1.5 text-sm text-textMain transition hover:bg-panelSoft"
            >
              Upload photo
            </button>
            {image && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-900/35"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <form className="space-y-3" onSubmit={handleSaveProfile}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="first-name" className="block text-sm text-textMuted">
              First name
            </label>
            <input
              id="first-name"
              name="first-name"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
              placeholder="First name"
            />
          </div>
          <div>
            <label htmlFor="last-name" className="block text-sm text-textMuted">
              Last name
            </label>
            <input
              id="last-name"
              name="last-name"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
              placeholder="Last name"
            />
          </div>
        </div>

        <div>
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
            className="mt-1 w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingProfile ? "Saving..." : "Save profile changes"}
        </button>
      </form>

      <div className="h-px bg-border" />

      <div>
        <h3 className="font-display text-base">Integrations</h3>
        <div className="mt-3 rounded-md border border-border bg-panelSoft/80 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-textMain">Google</p>
              <p className="mt-1 text-xs text-textMuted">
                {googleLinked
                  ? "Connected (name, email, and photo sync from Google on login/link)"
                  : "Not connected"}
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
                className="rounded-md border border-border bg-panelSoft px-3 py-1.5 text-sm text-textMain transition hover:bg-panelSoft disabled:cursor-not-allowed disabled:opacity-60"
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
