import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "primary";
}) {
  const toneClass = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-600",
    danger: "bg-red-50 text-red-600",
    warning: "bg-amber-50 text-amber-600",
    primary: "bg-indigo-50 text-indigo-600",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>
        </div>
        {icon ? (
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              toneClass,
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
