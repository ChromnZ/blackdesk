"use client";

import { useTheme } from "@/components/theme-provider";

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={compact ? "w-full" : "max-w-xs"}>
      <label
        htmlFor={compact ? "theme-select-compact" : "theme-select"}
        className="mb-1 block text-xs uppercase tracking-[0.12em] text-textMuted"
      >
        Theme
      </label>
      <select
        id={compact ? "theme-select-compact" : "theme-select"}
        value={theme}
        onChange={(event) =>
          setTheme(event.target.value as "light" | "dark" | "system")
        }
        className="w-full rounded-md border border-border bg-panelSoft px-2.5 py-2 text-sm text-textMain"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
