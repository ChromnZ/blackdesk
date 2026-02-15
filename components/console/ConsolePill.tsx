import { cn } from "@/lib/utils";

type ConsolePillProps = {
  label: string;
  onClick?: () => void;
  className?: string;
};

export function ConsolePill({ label, onClick, className }: ConsolePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900/70 hover:text-zinc-100",
        className,
      )}
    >
      {label}
    </button>
  );
}
