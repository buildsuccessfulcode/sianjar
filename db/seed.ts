import "@/scripts/load-env";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";

import {
  academicYears,
  attendanceRecords,
  classes,
  departments,
  journals,
  schedules,
  semesters,
  studentEnrollments,
  students,
  subjects,
  teacherProfiles,
  teacherSubjects,
  timeSlots,
  userRoles,
  users,
} from "@/db/schema";
import {
  ACADEMIC_YEAR,
  CLASSES,
  DEPARTMENTS,
  HOMEROOM_STAFF,
  SCHEDULES,
  SEMESTER,
  SUBJECTS,
  TEACHERS,
  TIME_SLOTS,
} from "@/db/seed-data/jadwal-2026-2027";
import { getDbPool } from "@/lib/db";

const DEFAULT_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@sekolah.sch.id";
const WAKA_EMAIL = "waka@sekolah.sch.id";

const STUDENT_SEEDS: { name: string; gender: "L" | "P" }[] = [
  { name: "Ahmad Fauzi", gender: "L" },
  { name: "Budi Santoso", gender: "L" },
  { name: "Citra Dewi", gender: "P" },
  { name: "Dewi Lestari", gender: "P" },
  { name: "Eko Saputra", gender: "L" },
  { name: "Fitri Handayani", gender: "P" },
  { name: "Gilang Ramadhan", gender: "L" },
  { name: "Hana Permata", gender: "P" },
  { name: "Indra Gunawan", gender: "L" },
  { name: "Jihan Aulia", gender: "P" },
  { name: "Kevin Pratama", gender: "L" },
  { name: "Lina Marlina", gender: "P" },
  { name: "Muhammad Rizky", gender: "L" },
  { name: "Nabila Putri", gender: "P" },
  { name: "Oscar Mahendra", gender: "L" },
  { name: "Putri Anjani", gender: "P" },
  { name: "Qori Ramadhan", gender: "L" },
  { name: "Rina Wulandari", gender: "P" },
  { name: "Sinta Dewi", gender: "P" },
  { name: "Taufik Hidayat", gender: "L" },
  { name: "Umar Faruq", gender: "L" },
  { name: "Vina Oktaviani", gender: "P" },
  { name: "Wahyu Setiawan", gender: "L" },
  { name: "Xena Amelia", gender: "P" },
  { name: "Yogi Pratama", gender: "L" },
  { name: "Zahra Nabila", gender: "P" },
  { name: "Arif Budiman", gender: "L" },
  { name: "Bunga Citra", gender: "P" },
  { name: "Candra Wijaya", gender: "L" },
  { name: "Dina Ayu", gender: "P" },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const db = getDbPool();

  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) {
      console.log(
        "Seed dilewati: database sudah memiliki data pengguna. Gunakan database kosong untuk menerapkan seed ini.",
      );
      return;
    }

    const [year] = await tx
      .insert(academicYears)
      .values({
        name: ACADEMIC_YEAR.name,
        startDate: ACADEMIC_YEAR.startDate,
        endDate: ACADEMIC_YEAR.endDate,
        isActive: true,
      })
      .returning();

    const [semester] = await tx
      .insert(semesters)
      .values({
        academicYearId: year.id,
        name: SEMESTER.name,
        startDate: SEMESTER.startDate,
        endDate: SEMESTER.endDate,
        isActive: true,
      })
      .returning();

    const departmentRows = await tx
      .insert(departments)
      .values(DEPARTMENTS)
      .returning();
    const departmentByCode = new Map(
      departmentRows.map((row) => [row.code, row]),
    );

    const subjectRows = await tx.insert(subjects).values(SUBJECTS).returning();
    const subjectByCode = new Map(subjectRows.map((row) => [row.code, row]));

    const [admin] = await tx
      .insert(users)
      .values({
        name: "Admin Sekolah",
        email: ADMIN_EMAIL,
        passwordHash,
      })
      .returning();

    const [waka] = await tx
      .insert(users)
      .values({
        name: "Waka Kurikulum",
        email: WAKA_EMAIL,
        passwordHash,
      })
      .returning();

    const teacherAccounts = [...TEACHERS, ...HOMEROOM_STAFF];
    const teacherRows = await tx
      .insert(users)
      .values(
        teacherAccounts.map((teacher) => ({
          name: teacher.name,
          email: teacher.email,
          passwordHash,
        })),
      )
      .returning();
    const userByEmail = new Map(teacherRows.map((row) => [row.email, row]));
    const teacherByKey = new Map(
      teacherAccounts.map((teacher) => [
        teacher.key,
        userByEmail.get(teacher.email)!,
      ]),
    );

    await tx.insert(userRoles).values([
      { userId: admin.id, role: "ADMIN" },
      { userId: waka.id, role: "WAKA_KURIKULUM" },
      { userId: waka.id, role: "GURU" },
      ...teacherRows.map((row) => ({ userId: row.id, role: "GURU" as const })),
    ]);

    await tx.insert(teacherProfiles).values([
      { userId: waka.id },
      ...teacherRows.map((row) => ({ userId: row.id })),
    ]);

    const teacherSubjectValues = TEACHERS.flatMap((teacher) =>
      teacher.subjects.map((subjectCode) => ({
        teacherId: teacherByKey.get(teacher.key)!.id,
        subjectId: subjectByCode.get(subjectCode)!.id,
      })),
    );
    await tx.insert(teacherSubjects).values(teacherSubjectValues);

    const classRows = await tx
      .insert(classes)
      .values(
        CLASSES.map((item) => ({
          academicYearId: year.id,
          departmentId: departmentByCode.get(item.departmentCode)!.id,
          gradeLevel: item.gradeLevel,
          section: item.section,
          homeroomTeacherId: item.homeroomTeacherKey
            ? teacherByKey.get(item.homeroomTeacherKey)!.id
            : null,
        })),
      )
      .returning();
    const classBySlot = new Map(
      classRows.map((row) => [
        `${row.departmentId}|${row.gradeLevel}|${row.section}`,
        row,
      ]),
    );
    const classByKey = new Map(
      CLASSES.map((item) => [
        item.key,
        classBySlot.get(
          `${departmentByCode.get(item.departmentCode)!.id}|${item.gradeLevel}|${item.section}`,
        )!,
      ]),
    );

    await tx.insert(timeSlots).values(
      TIME_SLOTS.map((slot) => ({
        semesterId: semester.id,
        label: slot.label,
        kind: slot.kind,
        periodNumber: slot.kind === "LESSON" ? slot.periodNumber : null,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    );

    const studentRows = await tx
      .insert(students)
      .values(
        STUDENT_SEEDS.map((student, index) => ({
          nisn: `00610000${String(index + 1).padStart(2, "0")}`,
          name: student.name,
          gender: student.gender,
        })),
      )
      .returning();
    const studentByNisn = new Map(studentRows.map((row) => [row.nisn, row]));

    const enrollmentValues = CLASSES.flatMap((item, classIndex) =>
      STUDENT_SEEDS.slice(classIndex * 5, classIndex * 5 + 5).map(
        (student, studentIndex) => {
          const nisn = `00610000${String(classIndex * 5 + studentIndex + 1).padStart(2, "0")}`;
          return {
            studentId: studentByNisn.get(nisn)!.id,
            classId: classByKey.get(item.key)!.id,
            academicYearId: year.id,
          };
        },
      ),
    );
    await tx.insert(studentEnrollments).values(enrollmentValues);

    const scheduleValues = SCHEDULES.map((item) => ({
      semesterId: semester.id,
      teacherId: teacherByKey.get(item.teacherKey)!.id,
      subjectId: subjectByCode.get(item.subjectCode)!.id,
      classId: classByKey.get(item.classKey)!.id,
      dayOfWeek: item.dayOfWeek,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
    }));
    await tx.insert(schedules).values(scheduleValues);

    const firstSchedule = SCHEDULES[0];
    const [sampleSchedule] = await tx
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.semesterId, semester.id),
          eq(schedules.classId, classByKey.get(firstSchedule.classKey)!.id),
          eq(schedules.dayOfWeek, firstSchedule.dayOfWeek),
          eq(schedules.periodStart, firstSchedule.periodStart),
        ),
      )
      .limit(1);

    const [journal] = await tx
      .insert(journals)
      .values({
        scheduleId: sampleSchedule.id,
        date: SEMESTER.startDate,
        teacherId: sampleSchedule.teacherId,
        material: "Orientasi dan kontrak belajar",
        activity: "Pengenalan materi dan kesepakatan kelas",
        notes: "Contoh jurnal dari seed.",
        createdBy: sampleSchedule.teacherId,
      })
      .returning();

    await tx.insert(attendanceRecords).values({
      journalId: journal.id,
      studentId: studentByNisn.get("0061000001")!.id,
      status: "IZIN",
      note: "Contoh ketidakhadiran.",
    });

    console.log("Seed selesai.");
    console.log(`Admin: ${ADMIN_EMAIL} / ${DEFAULT_PASSWORD}`);
    console.log(`Waka: ${WAKA_EMAIL} / ${DEFAULT_PASSWORD}`);
    console.log(
      `Guru: ${TEACHERS.length} akun mengajar + ${HOMEROOM_STAFF.length} wali kelas @sekolah.sch.id / ${DEFAULT_PASSWORD}`,
    );
    console.log(
      `Jadwal: ${ACADEMIC_YEAR.name} ${SEMESTER.name}, ${CLASSES.length} kelas, ${SCHEDULES.length} blok.`,
    );
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
