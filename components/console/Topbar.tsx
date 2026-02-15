"use client";

import { ProfileMenu } from "@/components/profile-menu";
import { Menu } from "lucide-react";
import Link from "next/link";

type ConsoleTopbarProps = {
  onMenuClick: () => void;
  user: {
    firstName: string;
    lastName: string;
    email?: string;
    image?: string | null;
  };
};

export function ConsoleTopbar({ onMenuClick, user }: ConsoleTopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-900/80 bg-[#070708]/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-5">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-200 md:hidden"
          aria-label="Open console sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-100">BlackDesk Console</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/app/help"
            className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
          >
            Docs
          </Link>
          <Link
            href="/app/agent"
            className="rounded-md border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-white"
          >
            Start building
          </Link>
          <ProfileMenu user={user} />
        </div>
      </div>
    </header>
  );
}
