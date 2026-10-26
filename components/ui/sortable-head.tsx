import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import {
  buildListHref,
  type SearchParamsRecord,
  type SortDirection,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";

export function SortableHead({
  label,
  column,
  currentSort,
  currentDir,
  basePath,
  searchParams,
  className,
  sortKey = "sort",
  dirKey = "dir",
  pageKey = "page",
}: {
  label: string;
  column: string;
  currentSort: string;
  currentDir: SortDirection;
  basePath: string;
  searchParams: SearchParamsRecord;
  className?: string;
  sortKey?: string;
  dirKey?: string;
  pageKey?: string;
}) {
  const active = currentSort === column;
  const nextDir: SortDirection = active && currentDir === "asc" ? "desc" : "asc";
  const href = buildListHref(basePath, searchParams, {
    [sortKey]: column,
    [dirKey]: nextDir,
    [pageKey]: 1,
  });
  const Icon = active ? (currentDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead
      aria-sort={active ? (currentDir === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1.5 hover:text-slate-900",
          active && "text-slate-900",
        )}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", active ? "text-indigo-600" : "text-slate-400")} />
      </Link>
    </TableHead>
  );
}
