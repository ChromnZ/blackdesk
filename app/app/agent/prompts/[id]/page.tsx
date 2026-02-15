import { AgentPromptEditor } from "@/components/agent/agent-prompt-editor";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

export default async function AgentPromptEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const prompt = await prisma.agentPrompt.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    select: {
      id: true,
      title: true,
      description: true,
      prompt: true,
      updatedAt: true,
    },
  });

  if (!prompt) {
    notFound();
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
      <AgentPromptEditor
        prompt={{
          id: prompt.id,
          title: prompt.title,
          description: prompt.description,
          prompt: prompt.prompt,
          updatedAt: prompt.updatedAt.toISOString(),
        }}
      />
    </ConsoleShell>
  );
}
