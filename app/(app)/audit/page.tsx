import type { Metadata } from "next";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { Field, Input, Select } from "@/components/ui/form";
import { ListQueryHidden } from "@/components/ui/list-query-hidden";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import { SortableHead } from "@/components/ui/sortable-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listAuditFilterOptions,
  listAuditLogsPaged,
} from "@/data-access/audit";
import { formatDateTimeId } from "@/lib/date";
import { requirePagePermission } from "@/lib/dal";
import {
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const sortOptions = ["createdAt", "actor", "action", "entityType"] as const;
const BASE_PATH = "/audit";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("read:audit_log");
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : undefined;
  const action = typeof params.action === "string" ? params.action : undefined;
  const entityType =
    typeof params.entityType === "string" ? params.entityType : undefined;
  const dateFrom =
    typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;
  const sort = resolveSort(params.sort, sortOptions, "createdAt");
  const dir = resolveDirection(params.dir, "desc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const [result, options] = await Promise.all([
    listAuditLogsPaged({
      q,
      action,
      entityType,
      dateFrom,
      dateTo,
      sort,
      dir,
      page,
      perPage,
    }),
    listAuditFilterOptions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Catatan aksi kritis: jadwal, promosi, dan aktivasi tahun ajaran/semester."
      />

      <FilterBar
        resetHref={BASE_PATH}
        description="Cari aktor/aksi/entitas dan saring berdasarkan rentang tanggal."
        formClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
        <SearchField
          defaultValue={q}
          placeholder="Cari aktor, aksi, entitas..."
        />
        <Field label="Aksi" htmlFor="action">
          <Select id="action" name="action" defaultValue={action ?? ""}>
            <option value="">Semua aksi</option>
            {options.actions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Entitas" htmlFor="entityType">
          <Select
            id="entityType"
            name="entityType"
            defaultValue={entityType ?? ""}
          >
            <option value="">Semua entitas</option>
            {options.entityTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dari" htmlFor="dateFrom">
          <Input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={dateFrom}
          />
        </Field>
        <Field label="Sampai" htmlFor="dateTo">
          <Input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={dateTo}
          />
        </Field>
      </FilterBar>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <History className="h-4 w-4" />
          Riwayat Audit
          <Badge variant="neutral">{result.total} data</Badge>
        </h2>
        {result.rows.length === 0 ? (
          <EmptyState
            title="Belum ada audit log"
            description="Aksi kritis akan tercatat otomatis di sini."
            icon={<History className="h-8 w-8" />}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Waktu"
                    column="createdAt"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <SortableHead
                    label="Aktor"
                    column="actor"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <SortableHead
                    label="Aksi"
                    column="action"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <SortableHead
                    label="Entitas"
                    column="entityType"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <TableHead>Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTimeId(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {log.actorName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.action}</TableCell>
                    <TableCell className="text-xs">
                      {log.entityType}
                      {log.entityId ? (
                        <span className="block truncate font-mono text-[11px] text-slate-400">
                          {log.entityId}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                        {log.payload ? JSON.stringify(log.payload, null, 2) : "—"}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              basePath={BASE_PATH}
              searchParams={params}
              page={result.page}
              perPage={result.perPage}
              total={result.total}
              totalPages={result.totalPages}
              from={result.from}
              to={result.to}
            />
          </>
        )}
      </div>
    </div>
  );
}
