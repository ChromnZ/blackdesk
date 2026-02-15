"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

function mapAuthError(error: string | null) {
  if (!error) {
    return null;
  }

  if (error === "CredentialsSignin") {
    return "Invalid username or password.";
  }

  if (error === "OAuthAccountNotLinked") {
    return "This email is already linked to a credentials account.";
  }

  return "Unable to authenticate right now. Try again.";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const oauthError = searchParams.get("error");
  const wasRegistered = searchParams.get("registered") === "1";

  useEffect(() => {
    setError(mapAuthError(oauthError));
  }, [oauthError]);

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await signIn("credentials", {
      username: username.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl: "/app",
    });

    setIsLoading(false);

    if (!result || result.error) {
      setError("Invalid username or password.");
      return;
    }

    router.push(result.url ?? "/app");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setError(null);
    setIsLoading(true);
    await signIn("google", { callbackUrl: "/app" });
  }

  return (
    <section className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-glow">
      <h1 className="font-display text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-textMuted">Use your BlackDesk account to continue.</p>

      {wasRegistered && (
        <p className="mt-4 rounded-md border border-emerald-700/50 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-300">
          Account created. You can log in now.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <form className="mt-5 space-y-4" onSubmit={handleCredentialsSubmit}>
        <div>
          <label htmlFor="username" className="mb-1 block text-sm text-textMuted">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="demo"
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain placeholder:text-textMuted"
            placeholder="********"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>

      <div className="my-4 h-px bg-border" />

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full rounded-md border border-border bg-panelSoft px-4 py-2 text-sm font-semibold text-textMain transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
      >
        Continue with Google
      </button>

      <p className="mt-5 text-center text-sm text-textMuted">
        New here?{" "}
        <Link href="/auth/register" className="text-textMain underline underline-offset-4">
          Create account
        </Link>
      </p>
    </section>
  );
}

