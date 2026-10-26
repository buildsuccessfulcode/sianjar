import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck2,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  GraduationCap,
  NotebookPen,
  Plus,
  Users,
} from "lucide-react";

import { ScheduleCard } from "@/components/domain/schedule-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatDateId, todayInJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/dal";
import {
  getActiveAcademicYear,
  getActiveSemester,
  listClasses,
} from "@/data-access/master";
import {
  getTodaySchedulesForTeacher,
  listDaySchedulesForMonitoring,
} from "@/data-access/schedules";
import { hasPermission, hasRole } from "@/lib/permissions";
import { classLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const today = todayInJakarta();
  const activeYear = await getActiveAcademicYear();
  const activeSemester = await getActiveSemester();

  const isTeacher = hasRole(user.roles, "GURU");
  const isMonitor = hasPermission(user.roles, "read:jurnal_all");

  const teacherData =
    isTeacher && activeSemester
      ? await getTodaySchedulesForTeacher(user.id, today)
      : null;

  const monitoringRows =
    isMonitor && activeSemester
      ? await listDaySchedulesForMonitoring(activeSemester.id, today)
      : [];

  const filled = monitoringRows.filter((row) => row.journalId).length;
  const unfilled = monitoringRows.filter((row) => !row.journalId);
  const coverage =
    monitoringRows.length > 0
      ? Math.round((filled / monitoringRows.length) * 100)
      : 0;

  const canManageMaster = hasPermission(user.roles, "manage:master_data");
  const classes =
    isMonitor && activeYear ? await listClasses(activeYear.id) : [];
  const totalStudents = classes.reduce(
    (total, row) => total + row.studentCount,
    0,
  );

  const firstName = user.name?.split(" ")[0] ?? "Pengguna";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Halo, ${firstName}`}
        description={formatDateId(today)}
        actions={
          isTeacher ? (
            <>
              <Link
                href="/jadwal"
                className={buttonVariants({ variant: "secondary" })}
              >
                <CalendarDays className="h-4 w-4" />
                Kalender Mingguan
              </Link>
              <Link
                href="/jurnal"
                className={buttonVariants({ variant: "secondary" })}
              >
                <NotebookPen className="h-4 w-4" />
                Riwayat Jurnal
              </Link>
            </>
          ) : (
            <Link
              href="/jurnal"
              className={buttonVariants({ variant: "secondary" })}
            >
              <ClipboardList className="h-4 w-4" />
              Monitoring Jurnal
            </Link>
          )
        }
      />

      {!activeSemester ? (
        <Alert variant="warning" title="Belum ada semester aktif">
          {hasPermission(user.roles, "manage:master_data") ? (
            <span>
              Aktifkan tahun ajaran dan semester terlebih dahulu di{" "}
              <Link
                href="/admin/tahun-ajaran"
                className="font-semibold underline"
              >
                menu Tahun Ajaran
              </Link>
              .
            </span>
          ) : (
            "Hubungi Admin untuk mengaktifkan semester."
          )}
        </Alert>
      ) : null}

      {isMonitor ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Monitoring Jurnal Hari Ini
            </h2>
            <Badge variant="primary">
              {activeSemester
                ? `${activeSemester.name} ${activeSemester.academicYearName}`
                : "Semester belum aktif"}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Slot"
              value={monitoringRows.length}
              icon={<CalendarCheck2 className="h-5 w-5" />}
            />
            <StatCard
              label="Sudah Diisi"
              value={filled}
              tone="success"
              icon={<CircleCheck className="h-5 w-5" />}
            />
            <StatCard
              label="Belum Diisi"
              value={unfilled.length}
              tone="danger"
              icon={<CircleAlert className="h-5 w-5" />}
            />
            <StatCard
              label="Coverage"
              value={`${coverage}%`}
              tone="primary"
              icon={<ClipboardList className="h-5 w-5" />}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Slot belum diisi</CardTitle>
                <CardDescription>
                  Tindak lanjuti guru yang belum mengisi jurnal.
                </CardDescription>
              </div>
              <Link
                href="/jurnal"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Lihat semua
              </Link>
            </CardHeader>
            <CardContent>
              {unfilled.length === 0 ? (
                <Alert variant="success">
                  Semua slot hari ini sudah diisi. Kerja bagus.
                </Alert>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {unfilled.slice(0, 8).map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {row.teacherName} — {row.subjectName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {classLabel({
                            gradeLevel: row.gradeLevel,
                            section: row.section,
                            departmentCode: row.departmentCode,
                          })}{" "}
                          · Jam {row.periodStart}–{row.periodEnd}
                        </p>
                      </div>
                      <Badge variant="danger">Belum diisi</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {isTeacher ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Jadwal Mengajar Hari Ini
            </h2>
            {teacherData?.semester ? (
              <Badge variant="primary">
                {teacherData.semester.name} {teacherData.semester.academicYearName}
              </Badge>
            ) : null}
          </div>

          {!activeSemester ? null : teacherData &&
            teacherData.schedules.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {teacherData.schedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  scheduleId={schedule.id}
                  date={today}
                  subjectName={schedule.subjectName}
                  className={classLabel({
                    gradeLevel: schedule.gradeLevel,
                    section: schedule.section,
                    departmentCode: schedule.departmentCode,
                  })}
                  periodStart={schedule.periodStart}
                  periodEnd={schedule.periodEnd}
                  room={schedule.room}
                  journalId={schedule.journalId}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Belum ada jadwal hari ini"
              description="Selamat beristirahat. Jadwal mengajar akan tampil di sini."
              icon={<CalendarCheck2 className="h-8 w-8" />}
            />
          )}
        </section>
      ) : null}

      {activeYear && isMonitor ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Ringkasan Sekolah · {activeYear.name}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Kelas"
              value={classes.length}
              icon={<GraduationCap className="h-5 w-5" />}
            />
            <StatCard
              label="Siswa Terdaftar"
              value={totalStudents}
              icon={<Users className="h-5 w-5" />}
            />
            {canManageMaster ? (
              <Link
                href="/admin/siswa"
                className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Kelola data siswa
                </span>
                <span className="mt-1 block text-xs font-normal text-indigo-600/80">
                  Tambah siswa dan atur enrollment kelas.
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
