import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black">
      <Link
        href="/auth/login"
        className="rounded-md border border-white/20 bg-white px-8 py-3 font-display text-base font-semibold text-black transition hover:bg-white/90"
      >
        Login
      </Link>
    </main>
  );
}

