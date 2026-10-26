import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  buildListHref,
  type SearchParamsRecord,
  type SortDirection,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";

export function SortLinks({
  items,
  currentSort,
  currentDir,
  basePath,
  searchParams,
}: {
  items: { label: string; column: string }[];
  currentSort: string;
  currentDir: SortDirection;
  basePath: string;
  searchParams: SearchParamsRecord;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      <span className="font-medium">Urutkan:</span>
      {items.map((item) => {
        const active = currentSort === item.column;
        const nextDir: SortDirection =
          active && currentDir === "asc" ? "desc" : "asc";
        const href = buildListHref(basePath, searchParams, {
          sort: item.column,
          dir: nextDir,
          page: 1,
        });
        const Icon = active
          ? currentDir === "asc"
            ? ArrowUp
            : ArrowDown
          : ArrowUpDown;
        return (
          <Link
            key={item.column}
            href={href}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-100",
              active && "bg-indigo-50 font-medium text-indigo-700",
            )}
          >
            {item.label}
            <Icon className="h-3 w-3" />
          </Link>
        );
      })}
    </div>
  );
}
