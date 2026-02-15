"use client";

import { UserMenu } from "@/components/nav/UserMenu";
import { Menu } from "lucide-react";
import { type ReactNode } from "react";

type TopbarProps = {
  user: {
    firstName: string;
    lastName: string;
    email?: string;
    image?: string | null;
  };
  onMenuClick: () => void;
  title?: string | null;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

export function Topbar({
  user,
  onMenuClick,
  title = null,
  leftSlot,
  rightSlot,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#070708]/95 backdrop-blur-md">
      <div className="flex h-14 items-center px-4 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-900 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>

          {leftSlot}
          {!leftSlot && title && (
            <p className="truncate text-sm font-semibold tracking-tight text-zinc-100">
              {title}
            </p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {rightSlot}
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
