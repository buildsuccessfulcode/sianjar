import type { Metadata } from "next";
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
import { Checkbox, Field, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
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
  listPromotionBatches,
} from "@/data-access/promotions";
import {
  PROMOTION_ACTION_LABELS,
  type PromotionAction,
} from "@/db/schema/enums";
import { formatDateTimeId } from "@/lib/date";
import { requirePagePermission } from "@/lib/dal";
import { hasPermission } from "@/lib/permissions";
import { BATCH_VARIANTS } from "@/lib/status";
import { errorMessage } from "@/lib/errors";
import { cancelBatch, runPromotion } from "./actions";

export const metadata: Metadata = { title: "Naik Kelas" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  batch?: string;
}>;

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
  const [years, activeYear, history] = await Promise.all([
    listAcademicYears(),
    getActiveAcademicYear(),
    listPromotionBatches(),
  ]);

  const defaultFrom = activeYear ?? years[1] ?? years[0] ?? null;
  const defaultFromIndex = defaultFrom
    ? years.findIndex((year) => year.id === defaultFrom.id)
    : -1;
  const defaultTo =
    defaultFromIndex > 0 ? years[defaultFromIndex - 1] : years[0] ?? null;

  const fromId = params.from ?? defaultFrom?.id ?? "";
  const toId = params.to ?? defaultTo?.id ?? "";

  const preview =
    fromId && toId && fromId !== toId
      ? await getPromotionPreview(fromId, toId).catch((error) => ({
          error: errorMessage(error),
        }))
      : null;

  const batch = params.batch ? await getPromotionBatch(params.batch) : null;
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

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Riwayat Batch
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transisi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ringkasan</TableHead>
              <TableHead>Waktu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.fromYearName} → {row.toYearName}
                </TableCell>
                <TableCell>
                  <Badge variant={BATCH_VARIANTS[row.status]}>
                    {row.status}
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
              </TableRow>
            ))}
            {history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Belum ada batch promosi.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
