import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const variants = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900",
} as const;

export function Alert({
  variant = "info",
  title,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof variants;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
    </div>
  );
}
