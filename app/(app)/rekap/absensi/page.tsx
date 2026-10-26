import type { Metadata } from "next";
import { Download, Filter, Users } from "lucide-react";

import { Alert } from "@/components/ui/alert";
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
import { listClasses, listSubjects } from "@/data-access/master";
import {
  getAttendanceRecap,
  getJournalRecapByTeacher,
} from "@/data-access/journals";
import {
  listTeacherScheduleClassIds,
  listTeacherScheduleSubjectIds,
} from "@/data-access/schedules";
import { formatDateId, monthRange, todayInJakarta } from "@/lib/date";
import { requirePagePermission } from "@/lib/dal";
import { hasPermission } from "@/lib/permissions";
import { classLabel, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Rekap Absensi" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  dateFrom?: string;
  dateTo?: string;
  classId?: string;
  subjectId?: string;
}>;

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
    params.classId &&
    (canReadAll || allowedClassIds.has(params.classId))
      ? params.classId
      : undefined;
  const effectiveSubjectId =
    params.subjectId &&
    (canReadAll || allowedSubjectIds.has(params.subjectId))
      ? params.subjectId
      : undefined;

  const dateFrom = params.dateFrom || first;
  const dateTo = params.dateTo || today;

  const rows = await getAttendanceRecap({
    dateFrom,
    dateTo,
    classId: effectiveClassId,
    subjectId: effectiveSubjectId,
    classIds: canReadAll ? undefined : teacherClassIds,
  });

  const journalRecap = canReadAll
    ? await getJournalRecapByTeacher({ dateFrom, dateTo })
    : [];

  const totals = rows.reduce(
    (acc, row) => ({
      sakit: acc.sakit + row.sakit,
      izin: acc.izin + row.izin,
      alpa: acc.alpa + row.alpa,
      dispensasi: acc.dispensasi + row.dispensasi,
      total: acc.total + row.total,
    }),
    { sakit: 0, izin: 0, alpa: 0, dispensasi: 0, total: 0 },
  );

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
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Absensi"
        description={`Periode ${formatDateId(dateFrom)} – ${formatDateId(dateTo)}`}
        actions={
          <a
            href={`/rekap/absensi/export?${query.toString()}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <Download className="h-4 w-4" />
            Export CSV
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
          <form method="get" className="grid gap-3 md:grid-cols-5">
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
            <div className="flex items-end">
              <button
                type="submit"
                className="h-11 w-full rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Terapkan
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Sakit" value={totals.sakit} tone="warning" />
        <StatCard label="Izin" value={totals.izin} tone="primary" />
        <StatCard label="Alpa" value={totals.alpa} tone="danger" />
        <StatCard label="Dispensasi" value={totals.dispensasi} />
        <StatCard
          label="Siswa dengan catatan"
          value={rows.length}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Tidak ada ketidakhadiran"
          description="Tidak ada siswa dengan catatan sakit, izin, alpa, atau dispensasi pada filter ini."
          icon={<Users className="h-8 w-8" />}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Siswa</TableHead>
              <TableHead>NISN</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Sakit</TableHead>
              <TableHead>Izin</TableHead>
              <TableHead>Alpa</TableHead>
              <TableHead>Dispensasi</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.studentId}>
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
            ))}
          </TableBody>
        </Table>
      )}

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
