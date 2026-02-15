import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
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
      <Card className="rounded-2xl">
        <CardHeader>
        <p className="text-xs uppercase tracking-[0.28em] text-textMuted">Home</p>
          <CardTitle className="mt-2 text-3xl">Dashboard</CardTitle>
          <CardDescription className="mt-2 max-w-2xl">
          Everything starts here. Use AI Agent for quick capture, then manage your
          timeline and execution in Calendar and Tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
        <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="primary">
              <Link href="/app/agent">Open AI Agent</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/tasks">View Tasks</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/calendar">View Calendar</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/news">View News</Link>
            </Button>
        </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Open Tasks</p>
          <p className="mt-2 font-display text-3xl font-semibold">{openTasks}</p>
          <p className="mt-2 text-sm text-textMuted">Tasks still in todo or doing.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-textMuted">
            Upcoming Events
          </p>
          <p className="mt-2 font-display text-3xl font-semibold">{upcomingEvents}</p>
          <p className="mt-2 text-sm text-textMuted">Scheduled for the next 7 days.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Recently Updated Tasks</h2>
          <Link
            href="/app/tasks"
            className="text-xs uppercase tracking-[0.18em] text-textMuted transition hover:text-textMain"
          >
            Open Tasks
          </Link>
        </div>
          <Separator className="mt-3" />

        {recentTasks.length === 0 ? (
          <p className="mt-4 rounded-md border border-border bg-panelSoft/80 px-3 py-4 text-sm text-textMuted">
            No tasks yet. Ask AI Agent to create your first one.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {recentTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between rounded-md border border-border bg-panelSoft/80 px-3 py-2 text-sm"
              >
                <span className="truncate pr-4">{task.title}</span>
                <span className="rounded border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-textMuted">
                  {task.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        </CardContent>
      </Card>
    </section>
  );
}
