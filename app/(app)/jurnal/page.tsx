import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ClipboardList, Eye, Filter } from "lucide-react";

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
import {
  getActiveSemester,
  listClasses,
  listSemesters,
  listSubjects,
  listTeacherOptions,
} from "@/data-access/master";
import { listJournalsPaged } from "@/data-access/journals";
import { listDaySchedulesForMonitoring } from "@/data-access/schedules";
import { formatDateId, formatShortDateId, monthRange, todayInJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/dal";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { hasPermission } from "@/lib/permissions";
import { classLabel, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Jurnal" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const sortOptions = ["date", "subject", "teacher", "absent"] as const;
const BASE_PATH = "/jurnal";

export default async function JournalListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const today = todayInJakarta();
  const { first } = monthRange(today);
  const canReadAll = hasPermission(user.roles, "read:jurnal_all");
  const q = typeof params.q === "string" ? params.q : undefined;
  const sort = resolveSort(params.sort, sortOptions, "date");
  const dir = resolveDirection(params.dir, "desc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const dateFromParam =
    typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateToParam =
    typeof params.dateTo === "string" ? params.dateTo : undefined;
  const classIdParam =
    typeof params.classId === "string" ? params.classId : undefined;
  const subjectIdParam =
    typeof params.subjectId === "string" ? params.subjectId : undefined;
  const teacherIdParam =
    typeof params.teacherId === "string" ? params.teacherId : undefined;

  const [semesters, activeSemester, subjects, teachers] = await Promise.all([
    listSemesters(),
    getActiveSemester(),
    listSubjects(),
    canReadAll ? listTeacherOptions() : Promise.resolve([]),
  ]);

  const selectedSemester =
    semesters.find((row) => row.id === params.semesterId) ??
    semesters.find((row) => row.id === activeSemester?.id) ??
    semesters[0] ??
    null;

  const classes = selectedSemester
    ? await listClasses(selectedSemester.academicYearId)
    : [];

  const filters = {
    semesterId: selectedSemester?.id,
    teacherId: canReadAll ? teacherIdParam : user.id,
    classId: classIdParam,
    subjectId: subjectIdParam,
    dateFrom: dateFromParam || first,
    dateTo: dateToParam || today,
    q,
  };

  const result = await listJournalsPaged({
    ...filters,
    sort,
    dir,
    page,
    perPage,
  });

  const monitoringRows =
    canReadAll && selectedSemester
      ? await listDaySchedulesForMonitoring(
          selectedSemester.id,
          filters.dateTo,
          {
            classId: filters.classId,
            subjectId: filters.subjectId,
            teacherId: filters.teacherId,
          },
        )
      : [];
  const unfilled = monitoringRows.filter((row) => !row.journalId);
  const filled = monitoringRows.length - unfilled.length;
  const coverage =
    monitoringRows.length > 0
      ? Math.round((filled / monitoringRows.length) * 100)
      : 0;

  const weekStartDate = new Date(`${today}T00:00:00Z`);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 6);
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const presets = [
    { label: "Hari ini", from: today, to: today },
    { label: "7 hari", from: weekStart, to: today },
    { label: "Bulan ini", from: first, to: today },
    ...(selectedSemester
      ? [
          {
            label: "Semester",
            from: selectedSemester.startDate,
            to: selectedSemester.endDate,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurnal Mengajar"
        description={
          canReadAll
            ? "Lihat jurnal seluruh guru dan pantau slot yang belum diisi."
            : "Riwayat jurnal mengajar milikmu."
        }
      />

      {canReadAll && selectedSemester ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <ClipboardList className="h-4 w-4" />
              Monitoring · {formatDateId(filters.dateTo)}
            </h2>
            <Badge variant="primary">
              {selectedSemester.name} {selectedSemester.academicYearName}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Slot" value={monitoringRows.length} />
            <StatCard label="Sudah diisi" value={filled} tone="success" />
            <StatCard label="Belum diisi" value={unfilled.length} tone="danger" />
            <StatCard label="Coverage" value={`${coverage}%`} tone="primary" />
          </div>
          {unfilled.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Belum diisi</CardTitle>
                <CardDescription>
                  {unfilled.length} slot pada tanggal monitoring.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-slate-100">
                  {unfilled.slice(0, 6).map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{row.teacherName}</span> —{" "}
                        {row.subjectName} ·{" "}
                        {classLabel({
                          gradeLevel: row.gradeLevel,
                          section: row.section,
                          departmentCode: row.departmentCode,
                        })}{" "}
                        (Jam {row.periodStart})
                      </span>
                      <Badge variant="danger">Belum</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filter Riwayat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
            <SearchField
              defaultValue={q}
              placeholder="Cari materi, aktivitas, guru, mapel..."
            />
            <Field label="Semester" htmlFor="semesterId">
              <Select
                id="semesterId"
                name="semesterId"
                defaultValue={selectedSemester?.id ?? ""}
              >
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name} — {semester.academicYearName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dari" htmlFor="dateFrom">
              <Input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={filters.dateFrom}
              />
            </Field>
            <Field label="Sampai" htmlFor="dateTo">
              <Input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={filters.dateTo}
              />
            </Field>
            {canReadAll ? (
              <Field label="Guru" htmlFor="teacherId">
                <Select
                  id="teacherId"
                  name="teacherId"
                  defaultValue={params.teacherId ?? ""}
                >
                  <option value="">Semua guru</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Kelas" htmlFor="classId">
              <Select
                id="classId"
                name="classId"
                defaultValue={params.classId ?? ""}
              >
                <option value="">Semua kelas</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>
                    {classLabel(row)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mapel" htmlFor="subjectId">
              <Select
                id="subjectId"
                name="subjectId"
                defaultValue={params.subjectId ?? ""}
              >
                <option value="">Semua mapel</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end xl:col-span-full">
              <button
                type="submit"
                className="h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Terapkan Filter
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
                  filters.dateFrom === preset.from &&
                    filters.dateTo === preset.to &&
                    "bg-indigo-50 text-indigo-700",
                )}
              >
                {preset.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <ClipboardList className="h-4 w-4" />
          Riwayat Jurnal
          <Badge variant="neutral">{result.total} data</Badge>
        </h2>
        {result.rows.length === 0 ? (
          <EmptyState
            title="Belum ada jurnal"
            description="Jurnal yang sudah diisi akan tampil di sini."
            icon={<ClipboardList className="h-8 w-8" />}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Tanggal"
                    column="date"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <SortableHead
                    label="Mapel / Kelas"
                    column="subject"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  {canReadAll ? (
                    <SortableHead
                      label="Guru"
                      column="teacher"
                      currentSort={sort}
                      currentDir={dir}
                      basePath={BASE_PATH}
                      searchParams={params}
                    />
                  ) : null}
                  <TableHead>Materi</TableHead>
                  <SortableHead
                    label="Absen"
                    column="absent"
                    currentSort={sort}
                    currentDir={dir}
                    basePath={BASE_PATH}
                    searchParams={params}
                  />
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((journal, index) => {
                  const previous = result.rows[index - 1];
                  const showGroup =
                    sort === "date" && (!previous || previous.date !== journal.date);
                  return (
                    <Fragment key={journal.id}>
                      {showGroup ? (
                        <TableGroupRow colSpan={canReadAll ? 6 : 5}>
                          {formatDateId(journal.date)}
                        </TableGroupRow>
                      ) : null}
                      <TableRow>
                        <TableCell className="whitespace-nowrap">
                          <p className="font-medium text-slate-900">
                            {formatShortDateId(journal.date)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Jam {journal.periodStart}–{journal.periodEnd}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-slate-800">
                            {journal.subjectName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {classLabel({
                              gradeLevel: journal.gradeLevel,
                              section: journal.section,
                              departmentCode: journal.departmentCode,
                            })}
                          </p>
                        </TableCell>
                        {canReadAll ? (
                          <TableCell>{journal.teacherName}</TableCell>
                        ) : null}
                        <TableCell className="max-w-xs">
                          <p className="truncate text-slate-700">
                            {journal.material}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              journal.absentCount > 0 ? "warning" : "success"
                            }
                          >
                            {journal.absentCount} siswa
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Link
                              href={`/jurnal/${journal.id}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" }),
                              )}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Detail
                            </Link>
                          </div>
                        </TableCell>
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
    </div>
  );
}
