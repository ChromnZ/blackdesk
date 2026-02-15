import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [openTasks, upcomingEvents, recentTasks] = await Promise.all([
    prisma.task.count({
      where: {
        userId: session.user.id,
        status: {
          not: "done",
        },
      },
    }),
    prisma.event.count({
      where: {
        userId: session.user.id,
        startAt: {
          gte: now,
          lte: nextWeek,
        },
      },
    }),
    prisma.task.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        title: true,
        status: true,
      },
    }),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <header className="rounded-xl border border-border bg-panel p-6 shadow-glow">
        <p className="text-xs uppercase tracking-[0.28em] text-textMuted">Home</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-textMuted">
          Everything starts here. Use AI Agent for quick capture, then manage your
          timeline and execution in Calendar and Tasks.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/app/agent"
            className="rounded-md border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Open AI Agent
          </Link>
          <Link
            href="/app/tasks"
            className="rounded-md border border-border bg-black px-4 py-2 text-sm text-textMain transition hover:bg-panelSoft"
          >
            View Tasks
          </Link>
          <Link
            href="/app/calendar"
            className="rounded-md border border-border bg-black px-4 py-2 text-sm text-textMain transition hover:bg-panelSoft"
          >
            View Calendar
          </Link>
          <Link
            href="/app/news"
            className="rounded-md border border-border bg-black px-4 py-2 text-sm text-textMain transition hover:bg-panelSoft"
          >
            View News
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-panel p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Open Tasks</p>
          <p className="mt-2 font-display text-3xl font-semibold">{openTasks}</p>
          <p className="mt-2 text-sm text-textMuted">Tasks still in todo or doing.</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-textMuted">
            Upcoming Events
          </p>
          <p className="mt-2 font-display text-3xl font-semibold">{upcomingEvents}</p>
          <p className="mt-2 text-sm text-textMuted">Scheduled for the next 7 days.</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Recently Updated Tasks</h2>
          <Link
            href="/app/tasks"
            className="text-xs uppercase tracking-[0.18em] text-textMuted transition hover:text-textMain"
          >
            Open Tasks
          </Link>
        </div>

        {recentTasks.length === 0 ? (
          <p className="mt-4 rounded-md border border-border bg-black/30 px-3 py-4 text-sm text-textMuted">
            No tasks yet. Ask AI Agent to create your first one.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {recentTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between rounded-md border border-border bg-black/30 px-3 py-2 text-sm"
              >
                <span className="truncate pr-4">{task.title}</span>
                <span className="rounded border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-textMuted">
                  {task.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
