import { auth } from "@/lib/auth";
import { getAttendanceRecapAnalytics } from "@/data-access/journals";
import {
  listTeacherScheduleClassIds,
  listTeacherScheduleSubjectIds,
} from "@/data-access/schedules";
import { monthRange, todayInJakarta } from "@/lib/date";
import { buildAttendanceRecapWorkbook } from "@/lib/excel/attendance-recap";
import { hasPermission } from "@/lib/permissions";
import { classLabel } from "@/lib/utils";
import type { Role } from "@/db/schema/enums";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const q = url.searchParams.get("q") || undefined;

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

  const analytics = await getAttendanceRecapAnalytics({
    dateFrom,
    dateTo,
    classId,
    subjectId,
    classIds,
    q,
  });

  const classFilter = classId
    ? analytics.byClass[0]
      ? classLabel(analytics.byClass[0])
      : classId
    : "Semua kelas";
  const subjectFilter = subjectId
    ? analytics.bySubject.find((row) => row.subjectId === subjectId)
        ?.subjectName ?? subjectId
    : "Semua mapel";

  const file = await buildAttendanceRecapWorkbook(analytics, {
    dateFrom,
    dateTo,
    classFilter,
    subjectFilter,
    search: q,
    generatedAt: new Date(),
  });

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekap-absensi-${dateFrom}-${dateTo}.xlsx"`,
      "Content-Length": String(file.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
