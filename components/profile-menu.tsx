"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

type ProfileMenuProps = {
  user: {
    username: string;
    email?: string;
    image?: string | null;
  };
};

type ThemeOption = {
  value: "system" | "light" | "dark";
  label: string;
  icon: ReactNode;
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25M12 18.75V21M4.5 12H2.25M21.75 12H19.5M5.636 5.636 4.044 4.044M19.956 19.956l-1.592-1.592M5.636 18.364l-1.592 1.592M19.956 4.044l-1.592 1.592" />
        <circle cx="12" cy="12" r="4.25" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25h15A1.5 1.5 0 0 1 21 6.75v9A1.5 1.5 0 0 1 19.5 17.25h-15A1.5 1.5 0 0 1 3 15.75v-9A1.5 1.5 0 0 1 4.5 5.25Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20.25h6M12 17.25v3" />
      </svg>
    ),
  },
];

const DROPDOWN_ITEMS = [
  {
    href: "/app/policies",
    label: "Terms & policies",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5h9A1.5 1.5 0 0 1 18 6v13.5l-3-1.5-3 1.5-3-1.5-3 1.5V6A1.5 1.5 0 0 1 7.5 4.5Z" />
      </svg>
    ),
  },
  {
    href: "/app/help",
    label: "Help",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9a2.25 2.25 0 1 1 4.5 0c0 1.5-2.25 1.875-2.25 3.75M12 16.5h.008v.008H12Z" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0 1.724 1.724 0 0 0 2.573 1.066 1.724 1.724 0 0 1 2.494 2.494 1.724 1.724 0 0 0 1.066 2.573 1.724 1.724 0 0 1 0 3.35 1.724 1.724 0 0 0-1.066 2.573 1.724 1.724 0 0 1-2.494 2.494 1.724 1.724 0 0 0-2.573 1.066 1.724 1.724 0 0 1-3.35 0 1.724 1.724 0 0 0-2.573-1.066 1.724 1.724 0 0 1-2.494-2.494 1.724 1.724 0 0 0-1.066-2.573 1.724 1.724 0 0 1 0-3.35 1.724 1.724 0 0 0 1.066-2.573 1.724 1.724 0 0 1 2.494-2.494 1.724 1.724 0 0 0 2.573-1.066Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
      </svg>
    ),
  },
];

function UserAvatar({
  user,
  className,
}: {
  user: ProfileMenuProps["user"];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-panelSoft text-xs font-semibold text-textMain",
        className,
      )}
    >
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt={`${user.username} profile picture`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        user.username.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

export function ProfileMenu({ user }: ProfileMenuProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const node = menuRef.current;
      if (!node) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !node.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleLogout() {
    setIsSigningOut(true);
    await signOut({ callbackUrl: "/auth/login" });
    setIsSigningOut(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open profile menu"
        className="rounded-full border border-border bg-panel p-0.5 transition hover:bg-panelSoft"
      >
        <UserAvatar user={user} />
      </button>

      <div
        className={cn(
          "absolute right-0 top-[calc(100%+10px)] z-50 w-72 origin-top-right overflow-hidden rounded-xl border border-border bg-panel shadow-glow transition",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0",
        )}
      >
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} className="h-10 w-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-textMain">{user.username}</p>
              <p className="truncate text-xs text-textMuted">{user.email ?? "No email"}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-panelSoft p-1">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-label={option.label}
                title={option.label}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md border text-textMuted transition",
                  theme === option.value
                    ? "border-accent/20 bg-accent/10 text-textMain"
                    : "border-transparent hover:border-border hover:bg-panel hover:text-textMain",
                )}
              >
                {option.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="p-1.5">
          {DROPDOWN_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm text-textMuted transition hover:border-border hover:bg-panelSoft hover:text-textMain"
            >
              <span className="text-textMuted">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isSigningOut}
            className="mt-1 flex w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-left text-sm text-textMuted transition hover:border-border hover:bg-panelSoft hover:text-textMain disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-7.5a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 6 21h7.5a2.25 2.25 0 0 0 2.25-2.25V15" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h11.25m0 0-2.625-2.625M20.25 12l-2.625 2.625" />
              </svg>
            </span>
            <span>{isSigningOut ? "Signing out..." : "Log out"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
