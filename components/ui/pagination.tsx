import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  buildListHref,
  PER_PAGE_OPTIONS,
  type SearchParamsRecord,
} from "@/lib/pagination";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function pageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items: (number | "ellipsis")[] = [1];
  if (current > 3) items.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let page = start; page <= end; page += 1) items.push(page);

  if (current < total - 2) items.push("ellipsis");
  items.push(total);
  return items;
}

export function Pagination({
  basePath,
  searchParams,
  page,
  perPage,
  total,
  totalPages,
  from,
  to,
  pageKey = "page",
  perPageKey = "perPage",
}: {
  basePath: string;
  searchParams: SearchParamsRecord;
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  pageKey?: string;
  perPageKey?: string;
}) {
  const items = pageItems(page, totalPages);
  const pageHref = (target: number) =>
    buildListHref(basePath, searchParams, { [pageKey]: target });
  const perPageHref = (size: number) =>
    buildListHref(basePath, searchParams, {
      [perPageKey]: size,
      [pageKey]: 1,
    });

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>
          Menampilkan{" "}
          <span className="font-medium text-slate-700">
            {from === 0 ? 0 : from}–{to}
          </span>{" "}
          dari <span className="font-medium text-slate-700">{total}</span> data
        </span>
        <span className="inline-flex items-center gap-1">
          Baris:
          {PER_PAGE_OPTIONS.map((size) => (
            <Link
              key={size}
              href={perPageHref(size)}
              className={cn(
                "rounded px-1.5 py-0.5 hover:bg-slate-100",
                size === perPage
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : "text-slate-500",
              )}
            >
              {size}
            </Link>
          ))}
        </span>
      </div>

      {totalPages > 1 ? (
        <nav
          aria-label="Navigasi halaman"
          className="flex flex-wrap items-center gap-1"
        >
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page === 1}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "px-2",
              page === 1 && "pointer-events-none opacity-40",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </Link>

          {items.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1.5 text-sm text-slate-400"
              >
                …
              </span>
            ) : (
              <Link
                key={item}
                href={pageHref(item)}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors",
                  item === page
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {item}
              </Link>
            ),
          )}

          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page === totalPages}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "px-2",
              page === totalPages && "pointer-events-none opacity-40",
            )}
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
