"use client";

import { initialsFromName } from "@/lib/name-utils";
import {
  MAX_PROFILE_IMAGE_DIMENSION,
  MAX_PROFILE_IMAGE_FILE_BYTES,
  validateProfileImageDataUrl,
  validateProfileImageDimensions,
} from "@/lib/profile-image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ProfileSettingsPayload = {
  firstName: string;
  lastName: string;
  email: string | null;
  location: string | null;
  timezone: string | null;
  image: string | null;
  googleLinked: boolean;
  hasPassword: boolean;
};

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function ProfileIntegrations() {
  const searchParams = useSearchParams();
  const linkedParam = searchParams.get("linked");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(
    null,
  );
  const [removeImage, setRemoveImage] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [disconnectPassword, setDisconnectPassword] = useState("");
  const [disconnectConfirmPassword, setDisconnectConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const linkedFromReturn = useMemo(() => linkedParam === "google", [linkedParam]);
  const timezoneOptions = useMemo(() => {
    const supportedValuesOf = Intl.supportedValuesOf as
      | ((key: "timeZone") => string[])
      | undefined;

    if (typeof supportedValuesOf === "function") {
      return supportedValuesOf("timeZone");
    }

    return FALLBACK_TIMEZONES;
  }, []);

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
        setLocation(payload.location ?? "");
        setTimezone(
          payload.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
        );
        setImage(payload.image ?? null);
        setPendingImageDataUrl(null);
        setRemoveImage(false);
        setGoogleLinked(payload.googleLinked);
        setHasPassword(payload.hasPassword);
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

    if (selectedFile.size > MAX_PROFILE_IMAGE_FILE_BYTES) {
      setError("Image is too large. Use an image smaller than 750KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") {
        setError("Unable to read image file.");
        return;
      }

      const dimensionError = await validateProfileImageDimensions(reader.result);
      if (dimensionError) {
        setError(dimensionError);
        return;
      }

      const imageError = validateProfileImageDataUrl(reader.result);
      if (imageError) {
        setError(imageError);
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
        location?: string;
        timezone?: string;
        image?: string;
        removeImage?: boolean;
      } = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        location: location.trim(),
        timezone: timezone.trim(),
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
      setLocation(payload.location ?? "");
      setTimezone(payload.timezone ?? "");
      setImage(payload.image ?? null);
      setPendingImageDataUrl(null);
      setRemoveImage(false);
      setGoogleLinked(payload.googleLinked);
      setHasPassword(payload.hasPassword);
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

  async function handleDisconnectGoogle() {
    if (!googleLinked || disconnectingGoogle) {
      return;
    }

    setError(null);
    setSuccess(null);

    if (!hasPassword) {
      if (!disconnectPassword || disconnectPassword.length < 8) {
        setError("Set a password (minimum 8 characters) to disconnect Google.");
        return;
      }

      if (disconnectPassword !== disconnectConfirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setDisconnectingGoogle(true);

    try {
      const response = await fetch("/api/settings/integrations/google", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          hasPassword
            ? {}
            : {
                password: disconnectPassword,
                confirmPassword: disconnectConfirmPassword,
              },
        ),
      });

      const payload = (await response.json().catch(() => null)) as
        | { googleLinked?: boolean; hasPassword?: boolean; message?: string; error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to disconnect Google.");
        setDisconnectingGoogle(false);
        return;
      }

      setGoogleLinked(Boolean(payload?.googleLinked));
      setHasPassword(Boolean(payload?.hasPassword));
      setDisconnectPassword("");
      setDisconnectConfirmPassword("");
      setSuccess(payload?.message ?? "Google integration disconnected.");
    } catch {
      setError("Unable to disconnect Google.");
    } finally {
      setDisconnectingGoogle(false);
    }
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
          Use your real name, location, and timezone so BlackDesk can personalize planning.
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
        <p className="mt-2 text-xs text-textMuted">
          Max 750KB upload, max {MAX_PROFILE_IMAGE_DIMENSION}x{MAX_PROFILE_IMAGE_DIMENSION}px.
        </p>
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

        <div>
          <label htmlFor="location" className="block text-sm text-textMuted">
            Location
          </label>
          <input
            id="location"
            name="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="City, Country"
          />
        </div>

        <div>
          <label htmlFor="timezone" className="block text-sm text-textMuted">
            Timezone
          </label>
          <input
            id="timezone"
            name="timezone"
            list="timezone-options"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="e.g. Asia/Colombo"
          />
          <datalist id="timezone-options">
            {timezoneOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
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

          {googleLinked && (
            <div className="mt-3 space-y-3 rounded-md border border-border bg-panel/60 p-3">
              {!hasPassword && (
                <>
                  <p className="text-xs text-textMuted">
                    Add a password before disconnecting Google. You will use email + password to sign in.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="disconnect-password" className="block text-xs text-textMuted">
                        New password
                      </label>
                      <input
                        id="disconnect-password"
                        type="password"
                        minLength={8}
                        value={disconnectPassword}
                        onChange={(event) => setDisconnectPassword(event.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div>
                      <label htmlFor="disconnect-confirm-password" className="block text-xs text-textMuted">
                        Confirm password
                      </label>
                      <input
                        id="disconnect-confirm-password"
                        type="password"
                        minLength={8}
                        value={disconnectConfirmPassword}
                        onChange={(event) => setDisconnectConfirmPassword(event.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
                        placeholder="Re-enter password"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => void handleDisconnectGoogle()}
                disabled={disconnectingGoogle}
                className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-900/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {disconnectingGoogle ? "Disconnecting..." : "Disconnect Google"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
