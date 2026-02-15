import { RegisterForm } from "@/components/auth/register-form";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/app/calendar");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <RegisterForm />
    </main>
  );
}

