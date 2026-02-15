"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function RegisterForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
        username,
        email,
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
            placeholder="yourusername"
          />
          <p className="mt-1 text-xs text-textMuted">
            Use only lowercase letters and numbers.
          </p>
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
            className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="you@example.com"
          />
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
            className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
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
            className="w-full rounded-md border border-border bg-black px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="Re-enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Creating..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-textMuted">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-white underline underline-offset-4">
          Login
        </Link>
      </p>
    </section>
  );
}

