import { AppShell } from "@/components/app-shell";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  return (
    <AppShell
      user={{
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email ?? undefined,
        image: session.user.image ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}

