import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

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
import { listStudentsInClass } from "@/data-access/master";
import { getJournalById } from "@/data-access/journals";
import type { AttendanceStatus } from "@/db/schema/enums";
import { formatDateId, formatDateTimeId } from "@/lib/date";
import { getCurrentUser } from "@/lib/dal";
import { hasPermission, isAdmin } from "@/lib/permissions";
import { ATTENDANCE_UI_LABELS, attendanceVariant } from "@/lib/status";
import { classLabel, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Detail Jurnal" };
export const dynamic = "force-dynamic";

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const detail = await getJournalById(id);
  if (!detail) notFound();

  const { journal, attendance } = detail;
  const canReadAll = hasPermission(user.roles, "read:jurnal_all");
  if (!canReadAll && journal.teacherId !== user.id) {
    redirect("/dashboard");
  }

  const students = await listStudentsInClass(
    journal.classId,
    journal.academicYearId,
  );
  const attendanceMap = new Map(
    attendance.map((row) => [row.studentId, row]),
  );

  const counts: Record<"HADIR" | AttendanceStatus, number> = {
    HADIR: 0,
    SAKIT: 0,
    IZIN: 0,
    ALPA: 0,
    DISPENSASI: 0,
  };
  for (const student of students) {
    const status = attendanceMap.get(student.id)?.status ?? "HADIR";
    counts[status] += 1;
  }

  const canEdit =
    hasPermission(user.roles, "create:jurnal_own") &&
    (isAdmin(user.roles) || journal.teacherId === user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${journal.subjectName} — ${classLabel({
          gradeLevel: journal.gradeLevel,
          section: journal.section,
          departmentCode: journal.departmentCode,
        })}`}
        description={`${formatDateId(journal.date)} · Jam ${journal.periodStart}–${journal.periodEnd} · ${journal.teacherName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/jurnal"
              className={buttonVariants({ variant: "secondary" })}
            >
              <ArrowLeft className="h-4 w-4" />
              Riwayat
            </Link>
            {canEdit ? (
              <Link
                href={`/jurnal/isi/${journal.scheduleId}?date=${journal.date}`}
                className={buttonVariants({ variant: "primary" })}
              >
                <Pencil className="h-4 w-4" />
                Edit Jurnal
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="primary">
          {journal.semesterName} {journal.academicYearName}
        </Badge>
        <Badge variant="neutral">{journal.teacherName}</Badge>
        <Badge variant="neutral">
          Diperbarui {formatDateTimeId(journal.updatedAt)}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Hadir" value={counts.HADIR} tone="success" />
        <StatCard label="Sakit" value={counts.SAKIT} tone="warning" />
        <StatCard label="Izin" value={counts.IZIN} tone="primary" />
        <StatCard label="Alpa" value={counts.ALPA} tone="danger" />
        <StatCard label="Dispensasi" value={counts.DISPENSASI} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {journal.material}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktivitas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {journal.activity}
            </p>
          </CardContent>
        </Card>
      </div>

      {journal.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catatan</CardTitle>
            <CardDescription>Catatan tambahan dari guru.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {journal.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Kehadiran ({students.length} siswa)
        </h2>
        {students.length === 0 ? (
          <Alert variant="warning">
            Tidak ada siswa aktif pada kelas ini saat jurnal dibuat.
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>NISN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student, index) => {
                const record = attendanceMap.get(student.id);
                const status = record?.status ?? "HADIR";
                return (
                  <TableRow
                    key={student.id}
                    className={cn(
                      status !== "HADIR" && "bg-slate-50/60",
                    )}
                  >
                    <TableCell className="text-slate-400">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {student.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {student.nisn}
                    </TableCell>
                    <TableCell>
                      <Badge variant={attendanceVariant(status)}>
                        {ATTENDANCE_UI_LABELS[status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {record?.note ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
