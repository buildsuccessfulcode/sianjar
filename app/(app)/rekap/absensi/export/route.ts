import { auth } from "@/lib/auth";
import { getAttendanceRecap } from "@/data-access/journals";
import {
  listTeacherScheduleClassIds,
  listTeacherScheduleSubjectIds,
} from "@/data-access/schedules";
import { monthRange, todayInJakarta } from "@/lib/date";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@/db/schema/enums";

export const dynamic = "force-dynamic";

function csvCell(value: string | number) {
  const raw = String(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const roles = (session.user.roles ?? []) as Role[];
  if (!hasPermission(roles, "read:rekap_absensi")) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const today = todayInJakarta();
  const { first } = monthRange(today);
  const dateFrom = url.searchParams.get("dateFrom") || first;
  const dateTo = url.searchParams.get("dateTo") || today;
  const classId = url.searchParams.get("classId") || undefined;
  const subjectId = url.searchParams.get("subjectId") || undefined;

  let classIds: string[] | undefined;
  if (!hasPermission(roles, "read:jurnal_all")) {
    const [teacherClassIds, teacherSubjectIds] = await Promise.all([
      listTeacherScheduleClassIds(session.user.id),
      listTeacherScheduleSubjectIds(session.user.id),
    ]);
    if (classId && !teacherClassIds.includes(classId)) {
      return new Response("Forbidden", { status: 403 });
    }
    if (subjectId && !teacherSubjectIds.includes(subjectId)) {
      return new Response("Forbidden", { status: 403 });
    }
    classIds = teacherClassIds;
  }

  const rows = await getAttendanceRecap({
    dateFrom,
    dateTo,
    classId,
    subjectId,
    classIds,
  });

  const header = [
    "Nama Siswa",
    "NISN",
    "Kelas",
    "Sakit",
    "Izin",
    "Alpa",
    "Dispensasi",
    "Total Tidak Hadir",
  ];

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.studentName,
        row.nisn,
        `${row.gradeLevel} ${row.departmentCode} ${row.section}`,
        row.sakit,
        row.izin,
        row.alpa,
        row.dispensasi,
        row.total,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  const csv = `\uFEFF${lines.join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-absensi-${dateFrom}-${dateTo}.csv"`,
    },
  });
}
