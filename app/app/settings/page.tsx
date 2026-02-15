import { LogoutButton } from "@/components/logout-button";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const username = session?.user?.username ?? "user";
  const email = session?.user?.email ?? "No email connected";

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-textMuted">Profile and account actions.</p>
      </header>

      <div className="rounded-lg border border-border bg-panel p-5 shadow-glow">
        <h2 className="font-display text-lg">Profile</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-textMuted">Username</dt>
            <dd className="mt-1 text-textMain">{username}</dd>
          </div>
          <div>
            <dt className="text-textMuted">Email</dt>
            <dd className="mt-1 text-textMain">{email}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-panel p-5 shadow-glow">
        <h2 className="font-display text-lg">Session</h2>
        <p className="mt-1 text-sm text-textMuted">Sign out of your current session.</p>
        <div className="mt-4">
          <LogoutButton className="rounded-md border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90" />
        </div>
      </div>
    </section>
  );
}

