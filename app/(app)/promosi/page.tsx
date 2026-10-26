import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Shuffle,
} from "lucide-react";

import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { FilterBar } from "@/components/ui/filter-bar";
import { Checkbox, Field, Select } from "@/components/ui/form";
import { HiddenParams } from "@/components/ui/hidden-params";
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
  getActiveAcademicYear,
  listAcademicYears,
} from "@/data-access/master";
import {
  getPromotionBatch,
  getPromotionPreview,
  listPromotionBatchesPaged,
} from "@/data-access/promotions";
import {
  PROMOTION_ACTION_LABELS,
  type PromotionAction,
  type PromotionBatchStatus,
} from "@/db/schema/enums";
import { formatDateTimeId } from "@/lib/date";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { requirePagePermission } from "@/lib/dal";
import { hasPermission } from "@/lib/permissions";
import { BATCH_VARIANTS } from "@/lib/status";
import { errorMessage } from "@/lib/errors";
import { cancelBatch, runPromotion } from "./actions";

export const metadata: Metadata = { title: "Naik Kelas" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const BATCH_STATUS_LABELS: Record<PromotionBatchStatus, string> = {
  DRAFT: "Draf",
  COMMITTED: "Selesai",
  CANCELLED: "Dibatalkan",
};
const batchStatusOptions = [
  "DRAFT",
  "COMMITTED",
  "CANCELLED",
] as const;
const sortOptions = ["createdAt", "status", "transition"] as const;
const BASE_PATH = "/promosi";

function summaryValue(summary: unknown, key: string) {
  if (summary && typeof summary === "object" && key in summary) {
    const value = (summary as Record<string, unknown>)[key];
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

export default async function PromotionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("manage:promotion_rules");
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : undefined;
  const batchStatus: PromotionBatchStatus | undefined =
    typeof params.status === "string" &&
    batchStatusOptions.includes(params.status as PromotionBatchStatus)
      ? (params.status as PromotionBatchStatus)
      : undefined;
  const sort = resolveSort(params.sort, sortOptions, "createdAt");
  const dir = resolveDirection(params.dir, "desc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const fromParam = typeof params.from === "string" ? params.from : undefined;
  const toParam = typeof params.to === "string" ? params.to : undefined;
  const batchId = typeof params.batch === "string" ? params.batch : undefined;
  const returnTo = buildListHref(BASE_PATH, params);

  const [years, activeYear, historyResult] = await Promise.all([
    listAcademicYears(),
    getActiveAcademicYear(),
    listPromotionBatchesPaged({
      q,
      status: batchStatus,
      sort,
      dir,
      page,
      perPage,
    }),
  ]);

  const defaultFrom = activeYear ?? years[1] ?? years[0] ?? null;
  const defaultFromIndex = defaultFrom
    ? years.findIndex((year) => year.id === defaultFrom.id)
    : -1;
  const defaultTo =
    defaultFromIndex > 0 ? years[defaultFromIndex - 1] : years[0] ?? null;

  const fromId = fromParam ?? defaultFrom?.id ?? "";
  const toId = toParam ?? defaultTo?.id ?? "";

  const preview =
    fromId && toId && fromId !== toId
      ? await getPromotionPreview(fromId, toId).catch((error) => ({
          error: errorMessage(error),
        }))
      : null;

  const batch = batchId ? await getPromotionBatch(batchId) : null;
  const canExecute = hasPermission(user.roles, "execute:promotion");
  const canCancel = hasPermission(user.roles, "cancel:promotion_batch");

  const previewData =
    preview && !("error" in preview) ? preview : null;
  const previewError =
    preview && "error" in preview ? String(preview.error) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Naik Kelas"
        description="Pratinjau pemetaan kelas, lalu commit secara atomik. Hanya Admin yang dapat commit dan membatalkan batch."
      />

      {batch ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Hasil Batch Promosi
            </CardTitle>
            <CardDescription>
              {batch.fromYearName} <ArrowRight className="inline h-3 w-3" />{" "}
              {batch.toYearName}
              {batch.committedAt
                ? ` · ${formatDateTimeId(batch.committedAt)}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={BATCH_VARIANTS[batch.status]}>
                {batch.status}
              </Badge>
              <span className="text-sm text-slate-600">
                {summaryValue(batch.summary, "promote")} naik ·{" "}
                {summaryValue(batch.summary, "retain")} tinggal ·{" "}
                {summaryValue(batch.summary, "graduate")} lulus
              </span>
            </div>
            {canCancel &&
            batch.status === "COMMITTED" &&
            !batch.toYearActive ? (
              <form action={cancelBatch}>
                <input type="hidden" name="id" value={batch.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmSubmit
                  variant="danger"
                  message="Batalkan batch ini? Enrollment baru akan dihapus dan enrollment asal dikembalikan ke ACTIVE."
                >
                  Batalkan Batch
                </ConfirmSubmit>
              </form>
            ) : null}
            {batch.toYearActive ? (
              <Alert variant="warning">
                Tahun ajaran tujuan sudah aktif. Batch tidak dapat dibatalkan.
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shuffle className="h-4 w-4" />
            Pilih Tahun Ajaran
          </CardTitle>
          <CardDescription>
            Tahun tujuan tidak boleh sedang aktif.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-3">
            <HiddenParams
              params={{
                q,
                status: batchStatus,
                sort,
                dir,
                page,
                perPage,
              }}
            />
            <Field label="Dari" htmlFor="from">
              <Select id="from" name="from" defaultValue={fromId}>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ke" htmlFor="to">
              <Select id="to" name="to" defaultValue={toId}>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-11 w-full rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Tampilkan Pratinjau
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {previewError ? <Alert variant="danger">{previewError}</Alert> : null}

      {previewData ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
              <p className="text-sm text-slate-500">Total siswa aktif</p>
              <p className="mt-1 text-2xl font-semibold">
                {previewData.totalStudents}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
              <p className="text-sm text-slate-500">Naik kelas</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">
                {previewData.summary.promote}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
              <p className="text-sm text-slate-500">Lulus</p>
              <p className="mt-1 text-2xl font-semibold text-indigo-700">
                {previewData.summary.graduate}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
              <p className="text-sm text-slate-500">Konflik</p>
              <p className="mt-1 text-2xl font-semibold text-red-600">
                {previewData.conflictCount}
              </p>
            </div>
          </div>

          {previewData.conflictCount > 0 || previewData.conflicts.length > 0 ? (
            <Alert variant="warning" title="Perlu diperiksa">
              <ul className="list-inside list-disc space-y-1">
                {previewData.conflicts.map((conflict) => (
                  <li key={conflict}>{conflict}</li>
                ))}
                {previewData.rows
                  .filter((row) => row.alreadyEnrolledCount > 0)
                  .map((row) => (
                    <li key={row.fromClassId}>
                      {row.alreadyEnrolledCount} siswa dari {row.fromLabel}{" "}
                      sudah memiliki enrollment di tahun tujuan.
                    </li>
                  ))}
              </ul>
            </Alert>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kelas Asal</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Kelas Tujuan</TableHead>
                <TableHead>Siswa</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.rows.map((row) => (
                <TableRow key={row.fromClassId}>
                  <TableCell className="font-medium text-slate-900">
                    {row.fromLabel}
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary">
                      {PROMOTION_ACTION_LABELS[
                        row.action as PromotionAction
                      ]}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.toLabel ?? "—"}</TableCell>
                  <TableCell>{row.studentCount}</TableCell>
                  <TableCell>
                    {row.alreadyEnrolledCount > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {row.alreadyEnrolledCount} sudah terdaftar
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Siap
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {canExecute ? (
            previewData.conflictCount > 0 ? (
              <Alert variant="warning">
                Commit dinonaktifkan sampai seluruh konflik pada pratinjau
                diselesaikan.
              </Alert>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-4 w-4" />
                    Commit Promosi
                  </CardTitle>
                  <CardDescription>
                    Aksi ini membuat enrollment tahun ajaran tujuan dan tidak
                    menghapus enrollment asal.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ActionForm
                    action={runPromotion}
                    submitLabel="Commit Promosi"
                    pendingText="Memproses siswa..."
                  >
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input
                      type="hidden"
                      name="fromAcademicYearId"
                      value={fromId}
                    />
                    <input
                      type="hidden"
                      name="toAcademicYearId"
                      value={toId}
                    />
                    <Checkbox
                      id="confirm"
                      name="confirm"
                      label="Saya sudah memeriksa pratinjau dan memahami aksi ini."
                      required
                    />
                  </ActionForm>
                </CardContent>
              </Card>
            )
          ) : (
            <Alert variant="info">
              Waka Kurikulum dapat melihat pratinjau. Eksekusi promosi hanya
              dapat dilakukan Admin.
            </Alert>
          )}
        </div>
      ) : null}

      <FilterBar
        title="Filter Riwayat Batch"
        resetHref={BASE_PATH}
        description="Cari transisi tahun ajaran dan saring status batch."
        formClassName="sm:grid-cols-2 lg:grid-cols-4"
      >
        <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
        <HiddenParams params={{ from: fromId, to: toId, batch: batchId }} />
        <SearchField
          defaultValue={q}
          placeholder="Cari tahun ajaran asal/tujuan..."
        />
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={batchStatus ?? ""}>
            <option value="">Semua status</option>
            {batchStatusOptions.map((value) => (
              <option key={value} value={value}>
                {BATCH_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Riwayat Batch
          <Badge variant="neutral">{historyResult.total} data</Badge>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Transisi"
                column="transition"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Status"
                column="status"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <TableHead>Ringkasan</TableHead>
              <SortableHead
                label="Waktu"
                column="createdAt"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historyResult.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.fromYearName} → {row.toYearName}
                </TableCell>
                <TableCell>
                  <Badge variant={BATCH_VARIANTS[row.status]}>
                    {BATCH_STATUS_LABELS[row.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {summaryValue(row.summary, "promote")} naik ·{" "}
                  {summaryValue(row.summary, "retain")} tinggal ·{" "}
                  {summaryValue(row.summary, "graduate")} lulus
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {row.committedAt
                    ? formatDateTimeId(row.committedAt)
                    : row.cancelledAt
                      ? `Dibatalkan ${formatDateTimeId(row.cancelledAt)}`
                      : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={buildListHref(BASE_PATH, params, {
                      batch: row.id,
                    })}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Lihat
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {historyResult.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Tidak ada batch promosi pada filter ini.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <Pagination
          basePath={BASE_PATH}
          searchParams={params}
          page={historyResult.page}
          perPage={historyResult.perPage}
          total={historyResult.total}
          totalPages={historyResult.totalPages}
          from={historyResult.from}
          to={historyResult.to}
        />
      </div>
    </div>
  );
}
