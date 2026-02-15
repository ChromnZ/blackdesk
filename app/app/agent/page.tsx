import { AgentConsoleHome } from "@/components/agent/agent-console-home";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function AgentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  return (
    <ConsoleShell
      activeNavKey="agent-builder"
      user={{
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email ?? undefined,
        image: session.user.image ?? null,
      }}
    >
      <AgentConsoleHome />
    </ConsoleShell>
  );
}
