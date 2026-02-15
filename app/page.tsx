import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <Link
        href="/auth/login"
        className="rounded-md border border-accent/25 bg-accent px-8 py-3 font-display text-base font-semibold text-accentText transition hover:bg-accent/90"
      >
        Login
      </Link>
    </main>
  );
}

