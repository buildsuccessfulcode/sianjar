import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Download, Filter, Users } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/form";
import { ListQueryHidden } from "@/components/ui/list-query-hidden";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import { SortableHead } from "@/components/ui/sortable-head";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableGroupRow,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listClasses, listSubjects } from "@/data-access/master";
import {
  getAttendanceRecapByClass,
  getAttendanceRecapPaged,
  getAttendanceRecapTotals,
  getJournalRecapByTeacher,
} from "@/data-access/journals";
import {
  listTeacherScheduleClassIds,
  listTeacherScheduleSubjectIds,
} from "@/data-access/schedules";
import { formatDateId, monthRange, todayInJakarta } from "@/lib/date";
import { requirePagePermission } from "@/lib/dal";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { hasPermission } from "@/lib/permissions";
import { classLabel, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Rekap Absensi" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const sortOptions = [
  "total",
  "name",
  "class",
  "sakit",
  "izin",
  "alpa",
  "dispensasi",
] as const;
const BASE_PATH = "/rekap/absensi";

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("read:rekap_absensi");
  const params = await searchParams;
  const today = todayInJakarta();
  const { first } = monthRange(today);
  const canReadAll = hasPermission(user.roles, "read:jurnal_all");

  const q = typeof params.q === "string" ? params.q : undefined;
  const dateFrom =
    typeof params.dateFrom === "string" ? params.dateFrom : first;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : today;
  const classIdParam =
    typeof params.classId === "string" ? params.classId : undefined;
  const subjectIdParam =
    typeof params.subjectId === "string" ? params.subjectId : undefined;
  const sort = resolveSort(params.sort, sortOptions, "total");
  const dir = resolveDirection(params.dir, "desc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const [classes, subjects, teacherClassIds, teacherSubjectIds] =
    await Promise.all([
      listClasses(),
      listSubjects(),
      canReadAll
        ? Promise.resolve<string[]>([])
        : listTeacherScheduleClassIds(user.id),
      canReadAll
        ? Promise.resolve<string[]>([])
        : listTeacherScheduleSubjectIds(user.id),
    ]);

  const allowedClassIds = new Set(teacherClassIds);
  const allowedSubjectIds = new Set(teacherSubjectIds);

  const effectiveClassId =
    classIdParam && (canReadAll || allowedClassIds.has(classIdParam))
      ? classIdParam
      : undefined;
  const effectiveSubjectId =
    subjectIdParam && (canReadAll || allowedSubjectIds.has(subjectIdParam))
      ? subjectIdParam
      : undefined;

  const filters = {
    dateFrom,
    dateTo,
    classId: effectiveClassId,
    subjectId: effectiveSubjectId,
    classIds: canReadAll ? undefined : teacherClassIds,
    q,
  };

  const [result, totals, classRecap] = await Promise.all([
    getAttendanceRecapPaged({
      ...filters,
      sort,
      dir,
      page,
      perPage,
    }),
    getAttendanceRecapTotals(filters),
    getAttendanceRecapByClass(filters),
  ]);

  const journalRecap = canReadAll
    ? await getJournalRecapByTeacher({ dateFrom, dateTo })
    : [];

  const filteredClasses = canReadAll
    ? classes
    : classes.filter((row) => allowedClassIds.has(row.id));
  const filteredSubjects = canReadAll
    ? subjects
    : subjects.filter((row) => allowedSubjectIds.has(row.id));

  const query = new URLSearchParams({
    dateFrom,
    dateTo,
    ...(effectiveClassId ? { classId: effectiveClassId } : {}),
    ...(effectiveSubjectId ? { subjectId: effectiveSubjectId } : {}),
    ...(q ? { q } : {}),
  });

  const weekStartDate = new Date(`${today}T00:00:00Z`);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 6);
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const presets = [
    { label: "Hari ini", from: today, to: today },
    { label: "7 hari", from: weekStart, to: today },
    { label: "Bulan ini", from: first, to: today },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Absensi"
        description={`Periode ${formatDateId(dateFrom)} – ${formatDateId(dateTo)}`}
        actions={
          <a
            href={`/rekap/absensi/export?${query.toString()}`}
            title="Unduh laporan Excel: ringkasan, per kelas, per mapel, dan detail siswa"
            className={buttonVariants({ variant: "secondary" })}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </a>
        }
      />

      {!canReadAll && teacherClassIds.length === 0 ? (
        <Alert variant="warning">
          Kamu belum memiliki jadwal mengajar, sehingga belum ada kelas yang
          dapat direkap.
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filter
          </CardTitle>
          <CardDescription>
            Rekap menghitung siswa yang memiliki catatan tidak hadir pada
            periode ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
            <SearchField
              defaultValue={q}
              placeholder="Cari nama atau NISN siswa..."
            />
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
            <Field label="Kelas" htmlFor="classId">
              <Select
                id="classId"
                name="classId"
                defaultValue={effectiveClassId ?? ""}
              >
                <option value="">Semua kelas</option>
                {filteredClasses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {classLabel(row)} — {row.academicYearName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mapel" htmlFor="subjectId">
              <Select
                id="subjectId"
                name="subjectId"
                defaultValue={effectiveSubjectId ?? ""}
              >
                <option value="">Semua mapel</option>
                {filteredSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end md:col-span-full">
              <button
                type="submit"
                className="h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Terapkan
              </button>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Rentang cepat:</span>
            {presets.map((preset) => (
              <Link
                key={preset.label}
                href={buildListHref(BASE_PATH, params, {
                  dateFrom: preset.from,
                  dateTo: preset.to,
                  page: 1,
                })}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  dateFrom === preset.from &&
                    dateTo === preset.to &&
                    "bg-indigo-50 text-indigo-700",
                )}
              >
                {preset.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Sakit" value={totals.sakit} tone="warning" />
        <StatCard label="Izin" value={totals.izin} tone="primary" />
        <StatCard label="Alpa" value={totals.alpa} tone="danger" />
        <StatCard label="Dispensasi" value={totals.dispensasi} />
        <StatCard
          label="Siswa dengan catatan"
          value={totals.students}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {classRecap.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rekap per Kelas</CardTitle>
            <CardDescription>
              Kelas dengan ketidakhadiran terbanyak ditampilkan lebih dahulu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Kelas</th>
                    <th className="px-3 py-2 text-right">Siswa</th>
                    <th className="px-3 py-2 text-right">Sakit</th>
                    <th className="px-3 py-2 text-right">Izin</th>
                    <th className="px-3 py-2 text-right">Alpa</th>
                    <th className="px-3 py-2 text-right">Dispensasi</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classRecap.map((row) => (
                    <tr key={row.classId}>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {row.gradeLevel} {row.departmentCode} {row.section}
                      </td>
                      <td className="px-3 py-2 text-right">{row.students}</td>
                      <td className="px-3 py-2 text-right">{row.sakit}</td>
                      <td className="px-3 py-2 text-right">{row.izin}</td>
                      <td className="px-3 py-2 text-right">{row.alpa}</td>
                      <td className="px-3 py-2 text-right">{row.dispensasi}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Users className="h-4 w-4" />
          Daftar Ketidakhadiran
          <Badge variant="neutral">{result.total} siswa</Badge>
        </h2>
        {result.rows.length === 0 ? (
          <EmptyState
            title="Tidak ada ketidakhadiran"
            description="Tidak ada siswa dengan catatan sakit, izin, alpa, atau dispensasi pada filter ini."
            icon={<Users className="h-8 w-8" />}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Nama Siswa"
                    column="name"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <TableHead>NISN</TableHead>
                  <SortableHead
                    label="Kelas"
                    column="class"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <SortableHead
                    label="Sakit"
                    column="sakit"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <SortableHead
                    label="Izin"
                    column="izin"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <SortableHead
                    label="Alpa"
                    column="alpa"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <SortableHead
                    label="Dispensasi"
                    column="dispensasi"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <SortableHead
                    label="Total"
                    column="total"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, index) => {
                  const previous = result.rows[index - 1];
                  const previousClass = previous
                    ? `${previous.gradeLevel}-${previous.departmentCode}-${previous.section}`
                    : null;
                  const currentClass = `${row.gradeLevel}-${row.departmentCode}-${row.section}`;
                  const showGroup = sort === "class" && previousClass !== currentClass;
                  return (
                    <Fragment key={row.studentId}>
                      {showGroup ? (
                        <TableGroupRow colSpan={8}>
                          {row.gradeLevel} {row.departmentCode} {row.section}
                        </TableGroupRow>
                      ) : null}
                      <TableRow>
                        <TableCell className="font-medium text-slate-900">
                          {row.studentName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.nisn}</TableCell>
                        <TableCell>
                          {row.gradeLevel} {row.departmentCode} {row.section}
                        </TableCell>
                        <TableCell>{row.sakit}</TableCell>
                        <TableCell>{row.izin}</TableCell>
                        <TableCell>{row.alpa}</TableCell>
                        <TableCell>{row.dispensasi}</TableCell>
                        <TableCell className="font-semibold">{row.total}</TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
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

      {canReadAll ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rekap Jurnal per Guru</CardTitle>
            <CardDescription>
              Jumlah jurnal yang diisi pada periode ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {journalRecap.length === 0 ? (
              <p className="text-sm text-slate-500">
                Belum ada jurnal pada periode ini.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {journalRecap.map((row) => (
                  <li
                    key={row.teacherId}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span>{row.teacherName}</span>
                    <span className="font-semibold text-slate-900">
                      {row.totalJournals} jurnal
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      <p className={cn("text-xs text-slate-400")}>
        Rekap hanya menampilkan siswa yang memiliki minimal satu catatan tidak
        hadir. Siswa yang selalu hadir tidak muncul pada tabel.
      </p>
    </div>
  );
}
