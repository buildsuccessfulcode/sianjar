import type { Metadata } from "next";
import Link from "next/link";
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
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
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
import { listJournals } from "@/data-access/journals";
import { listDaySchedulesForMonitoring } from "@/data-access/schedules";
import { formatDateId, formatShortDateId, monthRange, todayInJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/dal";
import { hasPermission } from "@/lib/permissions";
import { classLabel, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Jurnal" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  semesterId?: string;
  teacherId?: string;
  classId?: string;
  subjectId?: string;
  dateFrom?: string;
  dateTo?: string;
}>;

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
    teacherId: canReadAll ? params.teacherId : user.id,
    classId: params.classId,
    subjectId: params.subjectId,
    dateFrom: params.dateFrom || first,
    dateTo: params.dateTo || today,
  };

  const journals = await listJournals({
    ...filters,
    limit: 200,
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
          <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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
            <div className="flex items-end xl:col-span-6">
              <button
                type="submit"
                className="h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Terapkan Filter
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {journals.length === 0 ? (
        <EmptyState
          title="Belum ada jurnal"
          description="Jurnal yang sudah diisi akan tampil di sini."
          icon={<ClipboardList className="h-8 w-8" />}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Mapel / Kelas</TableHead>
              {canReadAll ? <TableHead>Guru</TableHead> : null}
              <TableHead>Materi</TableHead>
              <TableHead>Absen</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {journals.map((journal) => (
              <TableRow key={journal.id}>
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
                  <p className="truncate text-slate-700">{journal.material}</p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={journal.absentCount > 0 ? "warning" : "success"}
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
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
