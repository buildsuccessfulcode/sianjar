import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";

import { AttendanceForm } from "@/components/domain/attendance-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listStudentsInClass } from "@/data-access/master";
import { getJournalById } from "@/data-access/journals";
import { getJournalFormContext } from "@/data-access/schedules";
import { formatDateId, todayInJakarta } from "@/lib/date";
import { requirePagePermission } from "@/lib/dal";
import { isAdmin } from "@/lib/permissions";
import { classLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Isi Jurnal" };
export const dynamic = "force-dynamic";

export default async function JournalFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ scheduleId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requirePagePermission("create:jurnal_own");
  const { scheduleId } = await params;
  const query = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "")
    ? (query.date as string)
    : todayInJakarta();

  let context;
  try {
    context = await getJournalFormContext(scheduleId, date);
  } catch {
    notFound();
  }

  if (!context) notFound();

  const { schedule, journal } = context;
  if (!isAdmin(user.roles) && schedule.teacherId !== user.id) {
    redirect("/dashboard");
  }

  const [students, detail] = await Promise.all([
    listStudentsInClass(schedule.classId, schedule.academicYearId),
    journal ? getJournalById(journal.id) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Jurnal — ${schedule.subjectName}`}
        description={`${classLabel({
          gradeLevel: schedule.gradeLevel,
          section: schedule.section,
          departmentCode: schedule.departmentCode,
        })} · ${formatDateId(date)} · Jam ${schedule.periodStart}–${schedule.periodEnd}`}
        actions={
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        }
      />

      {journal ? (
        <Alert variant="info" title="Mode edit">
          Jurnal untuk pertemuan ini sudah ada. Perubahan akan mengganti isi
          jurnal dan absensi.
        </Alert>
      ) : (
        <Alert variant="info">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Semua siswa dianggap hadir kecuali kamu mengubah statusnya.
          </span>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge variant="primary">{schedule.teacherName}</Badge>
        <Badge variant="neutral">
          {schedule.semesterName} {schedule.academicYearName}
        </Badge>
        {schedule.room ? (
          <Badge variant="neutral">{schedule.room}</Badge>
        ) : null}
      </div>

      <Card>
        <CardContent className="pt-5">
          <AttendanceForm
            scheduleId={schedule.id}
            date={date}
            material={journal?.material}
            activity={journal?.activity}
            notes={journal?.notes ?? undefined}
            students={students}
            initialAttendance={detail?.attendance ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
