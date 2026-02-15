"use client";

import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { useState } from "react";

type LogoutButtonProps = {
  className?: string;
  label?: string;
};

export function LogoutButton({ className, label = "Logout" }: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    await signOut({ callbackUrl: "/auth/login" });
    setIsLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className={cn(
        "rounded-md border border-accent/25 bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {isLoading ? "Signing out..." : label}
    </button>
  );
}

