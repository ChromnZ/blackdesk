"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useRef, useState } from "react";

const MAX_AVATAR_FILE_BYTES = 1_500_000;

export function RegisterForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      setImage(reader.result);
    };
    reader.onerror = () => {
      setError("Unable to read image file.");
    };
    reader.readAsDataURL(selectedFile);
    event.target.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        image: image ?? undefined,
        password,
        confirmPassword,
      }),
    });

    setIsLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to register account.");
      return;
    }

    router.push("/auth/login?registered=1");
    router.refresh();
  }

  return (
    <section className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-glow">
      <h1 className="font-display text-2xl font-semibold">Create account</h1>
      <p className="mt-1 text-sm text-textMuted">Set up credentials to use BlackDesk.</p>

      {error && (
        <p className="mt-4 rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first-name" className="mb-1 block text-sm text-textMuted">
              First name
            </label>
            <input
              id="first-name"
              name="first-name"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
              placeholder="John"
            />
          </div>
          <div>
            <label htmlFor="last-name" className="mb-1 block text-sm text-textMuted">
              Last name
            </label>
            <input
              id="last-name"
              name="last-name"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
              placeholder="Doe"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-textMuted">
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
            className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="you@example.com"
          />
        </div>

        <div className="rounded-md border border-border bg-panelSoft/70 p-3">
          <label className="mb-2 block text-sm text-textMuted">Profile picture (optional)</label>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border bg-panel text-sm font-semibold text-textMain">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                [firstName.slice(0, 1), lastName.slice(0, 1)]
                  .join("")
                  .toUpperCase() || "?"
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
                className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-textMain transition hover:bg-panelSoft"
              >
                Upload image
              </button>
              {image && (
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-900/35"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-textMuted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm text-textMuted">
            Confirm password
          </label>
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="Re-enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Creating..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-textMuted">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-textMain underline underline-offset-4">
          Login
        </Link>
      </p>
    </section>
  );
}

