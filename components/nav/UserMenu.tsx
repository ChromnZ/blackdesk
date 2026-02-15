"use client";

import { cn } from "@/lib/utils";
import { formatDisplayName, initialsFromName } from "@/lib/name-utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  LayoutGrid,
  LogOut,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type UserMenuProps = {
  user: {
    firstName: string;
    lastName: string;
    email?: string;
    image?: string | null;
  };
};

type ThemeValue = "light" | "dark";

const THEME_OPTIONS: Array<{
  value: ThemeValue;
  label: string;
  icon: ReactNode;
}> = [
  { value: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
];

function ItemRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-zinc-200 outline-none transition hover:bg-zinc-900/70 focus:bg-zinc-900/70"
      >
        <span className="text-zinc-400">{icon}</span>
        <span>{label}</span>
      </Link>
    </DropdownMenu.Item>
  );
}

export function UserMenu({ user }: UserMenuProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = useMemo(
    () => formatDisplayName(user.firstName, user.lastName, user.email ?? null),
    [user.email, user.firstName, user.lastName],
  );
  const activeTheme: ThemeValue = mounted
    ? theme === "light" || theme === "dark"
      ? theme
      : resolvedTheme === "light"
        ? "light"
        : "dark"
    : "dark";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Open user menu"
          className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-800/90 bg-zinc-900/70 text-xs font-semibold text-zinc-100 outline-none transition hover:border-zinc-700 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-500"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={`${displayName} profile picture`}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            initialsFromName(user.firstName, user.lastName, user.email ?? null)
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="z-[80] w-[300px] rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-2.5 text-zinc-100 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-zinc-100">{displayName}</p>
            <p className="truncate text-sm text-zinc-400">{user.email ?? "No email"}</p>
          </div>

          <div className="my-2 h-px bg-zinc-800/70" />

          <div className="space-y-1">
            <ItemRow
              href="/app"
              icon={<LayoutGrid className="h-4 w-4" />}
              label="Dashboard"
            />
            <ItemRow
              href="/app/settings"
              icon={<Settings className="h-4 w-4" />}
              label="Account Settings"
            />
          </div>

          <div className="my-2 h-px bg-zinc-800/70" />

          <div className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="text-sm text-zinc-300">Theme</span>
            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/70 p-1">
              {THEME_OPTIONS.map((option) => {
                const isActive = activeTheme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={`Set theme to ${option.label}`}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full border text-zinc-400 transition",
                      isActive
                        ? "border-zinc-700 bg-zinc-800 text-zinc-100"
                        : "border-transparent hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-zinc-200",
                    )}
                  >
                    {option.icon}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="my-2 h-px bg-zinc-800/70" />

          <DropdownMenu.Item
            onSelect={() => void signOut({ callbackUrl: "/" })}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-zinc-200 outline-none transition hover:bg-zinc-900/70 focus:bg-zinc-900/70"
          >
            <span className="text-zinc-400">
              <LogOut className="h-4 w-4" />
            </span>
            <span>Log Out</span>
          </DropdownMenu.Item>

          <div className="my-2 h-px bg-zinc-800/70" />

          <DropdownMenu.Item asChild>
            <Link
              href="/app/upgrade"
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-950 outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              Upgrade to Pro
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
