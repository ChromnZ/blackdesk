import { LoginForm } from "@/components/auth/login-form";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    if (!session.user.usernameSetupComplete) {
      redirect("/auth/complete-username");
    }
    redirect("/app");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <LoginForm />
    </main>
  );
}

