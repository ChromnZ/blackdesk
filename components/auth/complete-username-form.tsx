"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const USERNAME_HINT = "3-24 chars, lowercase letters and numbers only.";

export function CompleteUsernameForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/auth/complete-username", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
      }),
    });

    setIsLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Unable to save username.");
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <section className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-glow">
      <h1 className="font-display text-2xl font-semibold">Choose your username</h1>
      <p className="mt-1 text-sm text-textMuted">
        Pick your permanent BlackDesk username. It cannot be changed later.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username" className="mb-1 block text-sm text-textMuted">
            Username
          </label>
          <input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9]+"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="blackdeskuser"
          />
          <p className="mt-1 text-xs text-textMuted">{USERNAME_HINT}</p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Saving..." : "Continue"}
        </button>
      </form>
    </section>
  );
}
