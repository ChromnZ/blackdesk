import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-panelSoft px-3 text-sm text-textMain placeholder:text-textMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };
