import { CompleteUsernameForm } from "@/components/auth/complete-username-form";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function CompleteUsernamePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  if (session.user.usernameSetupComplete) {
    redirect("/app");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <CompleteUsernameForm />
    </main>
  );
}
