export const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PER_PAGE = 20;

export type SortDirection = "asc" | "desc";
export type SearchParamsRecord = Record<
  string,
  string | string[] | undefined
>;

export type Paginated<T> = {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  from: number;
  to: number;
};

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePage(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export function parsePerPage(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value));
  return (PER_PAGE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PER_PAGE;
}

export function resolveSort<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const candidate = firstParam(value);
  return candidate && (allowed as readonly string[]).includes(candidate)
    ? (candidate as T)
    : fallback;
}

export function resolveDirection(
  value: string | string[] | undefined,
  fallback: SortDirection = "desc",
): SortDirection {
  return firstParam(value) === "asc"
    ? "asc"
    : firstParam(value) === "desc"
      ? "desc"
      : fallback;
}

export function normalizePagination(
  total: number,
  page: number,
  perPage: number,
) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  const offset = (current - 1) * perPage;
  return {
    page: current,
    totalPages,
    offset,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(current * perPage, total),
  };
}

export function paginated<T>(
  rows: T[],
  total: number,
  page: number,
  perPage: number,
): Paginated<T> {
  const meta = normalizePagination(total, page, perPage);
  return {
    rows,
    total,
    page: meta.page,
    perPage,
    totalPages: meta.totalPages,
    from: meta.from,
    to: meta.to,
  };
}

export function escapeLike(value: string) {
  return value.trim().replace(/[\\%_]/g, "\\$&");
}

export function likePattern(value: string) {
  return `%${escapeLike(value)}%`;
}

export function buildListHref(
  basePath: string,
  current: SearchParamsRecord,
  overrides: Record<string, string | number | undefined | null> = {},
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(current)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== "") params.append(key, item);
      }
    } else {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
