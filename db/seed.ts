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
  timeSlots,
  teacherSubjects,
  userRoles,
  users,
} from "@/db/schema";
import { getDbPool } from "@/lib/db";
import { DEFAULT_TIME_SLOTS } from "@/lib/default-time-slots";
import { dayOfWeekFromDate, todayInJakarta } from "@/lib/date";

const DEFAULT_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@sekolah.sch.id";

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const today = todayInJakarta();
  const dayOfWeek = dayOfWeekFromDate(today);

  const db = getDbPool();

  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) {
      console.log("Seed dilewati: database sudah memiliki data pengguna.");
      return;
    }

    const [year2025] = await tx
      .insert(academicYears)
      .values({
        name: "2025/2026",
        startDate: "2025-07-14",
        endDate: "2026-06-30",
        isActive: false,
      })
      .returning();

    const [year2026] = await tx
      .insert(academicYears)
      .values({
        name: "2026/2027",
        startDate: "2026-07-13",
        endDate: "2027-06-30",
        isActive: true,
      })
      .returning();

    const [year2027] = await tx
      .insert(academicYears)
      .values({
        name: "2027/2028",
        startDate: "2027-07-12",
        endDate: "2028-06-30",
        isActive: false,
      })
      .returning();

    await tx.insert(semesters).values([
      {
        academicYearId: year2025.id,
        name: "GANJIL",
        startDate: "2025-07-14",
        endDate: "2025-12-31",
        isActive: false,
      },
      {
        academicYearId: year2025.id,
        name: "GENAP",
        startDate: "2026-01-05",
        endDate: "2026-06-30",
        isActive: false,
      },
      {
        academicYearId: year2026.id,
        name: "GANJIL",
        startDate: "2026-07-13",
        endDate: "2026-12-31",
        isActive: true,
      },
      {
        academicYearId: year2026.id,
        name: "GENAP",
        startDate: "2027-01-04",
        endDate: "2027-06-30",
        isActive: false,
      },
      {
        academicYearId: year2027.id,
        name: "GANJIL",
        startDate: "2027-07-12",
        endDate: "2027-12-31",
        isActive: false,
      },
    ]);

    const [activeSemester] = await tx
      .select()
      .from(semesters)
      .where(
        and(
          eq(semesters.academicYearId, year2026.id),
          eq(semesters.name, "GANJIL"),
        ),
      )
      .limit(1);

    await tx.insert(timeSlots).values(
      DEFAULT_TIME_SLOTS.map((slot) => ({
        ...slot,
        semesterId: activeSemester.id,
        periodNumber: slot.kind === "LESSON" ? slot.periodNumber : null,
      })),
    );

    const [ipa] = await tx
      .insert(departments)
      .values({ code: "IPA", name: "Ilmu Pengetahuan Alam" })
      .returning();
    const [ips] = await tx
      .insert(departments)
      .values({ code: "IPS", name: "Ilmu Pengetahuan Sosial" })
      .returning();

    const [mtk] = await tx
      .insert(subjects)
      .values({ code: "MTK", name: "Matematika" })
      .returning();
    const [fis] = await tx
      .insert(subjects)
      .values({ code: "FIS", name: "Fisika" })
      .returning();
    const [bin] = await tx
      .insert(subjects)
      .values({ code: "BIN", name: "Bahasa Indonesia" })
      .returning();
    const [bio] = await tx
      .insert(subjects)
      .values({ code: "BIO", name: "Biologi" })
      .returning();

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
        name: "Rina Waka Kurikulum",
        email: "waka@sekolah.sch.id",
        passwordHash,
      })
      .returning();
    const [sari] = await tx
      .insert(users)
      .values({
        name: "Sari Wulandari",
        email: "sari@sekolah.sch.id",
        passwordHash,
      })
      .returning();
    const [andi] = await tx
      .insert(users)
      .values({
        name: "Andi Pratama",
        email: "andi@sekolah.sch.id",
        passwordHash,
      })
      .returning();

    await tx.insert(userRoles).values([
      { userId: admin.id, role: "ADMIN" },
      { userId: waka.id, role: "WAKA_KURIKULUM" },
      { userId: waka.id, role: "GURU" },
      { userId: sari.id, role: "GURU" },
      { userId: andi.id, role: "GURU" },
    ]);

    await tx.insert(teacherProfiles).values([
      { userId: waka.id, nip: "198001012005012001" },
      { userId: sari.id, nip: "198702022010012002" },
      { userId: andi.id, nip: "199003032015011003" },
    ]);

    await tx.insert(teacherSubjects).values([
      { teacherId: waka.id, subjectId: mtk.id },
      { teacherId: sari.id, subjectId: mtk.id },
      { teacherId: sari.id, subjectId: bin.id },
      { teacherId: andi.id, subjectId: fis.id },
      { teacherId: andi.id, subjectId: bio.id },
    ]);

    const activeClasses = await tx
      .insert(classes)
      .values([
        {
          academicYearId: year2026.id,
          departmentId: ipa.id,
          gradeLevel: 10,
          section: "1",
          homeroomTeacherId: sari.id,
        },
        {
          academicYearId: year2026.id,
          departmentId: ips.id,
          gradeLevel: 10,
          section: "1",
          homeroomTeacherId: andi.id,
        },
        {
          academicYearId: year2026.id,
          departmentId: ipa.id,
          gradeLevel: 11,
          section: "1",
          homeroomTeacherId: waka.id,
        },
        {
          academicYearId: year2026.id,
          departmentId: ipa.id,
          gradeLevel: 12,
          section: "1",
        },
      ])
      .returning();

    const nextClasses = await tx
      .insert(classes)
      .values([
        {
          academicYearId: year2027.id,
          departmentId: ipa.id,
          gradeLevel: 11,
          section: "1",
        },
        {
          academicYearId: year2027.id,
          departmentId: ips.id,
          gradeLevel: 11,
          section: "1",
        },
        {
          academicYearId: year2027.id,
          departmentId: ipa.id,
          gradeLevel: 12,
          section: "1",
        },
      ])
      .returning();

    void nextClasses;

    const class10Ipa = activeClasses[0];
    const class10Ips = activeClasses[1];
    const class11Ipa = activeClasses[2];
    const class12Ipa = activeClasses[3];

    const studentRows = await tx
      .insert(students)
      .values([
        { nisn: "0051000001", name: "Ahmad Fauzi", gender: "L", birthDate: "2009-01-12" },
        { nisn: "0051000002", name: "Budi Santoso", gender: "L", birthDate: "2009-03-04" },
        { nisn: "0051000003", name: "Citra Dewi", gender: "P", birthDate: "2009-05-21" },
        { nisn: "0051000004", name: "Dewi Lestari", gender: "P", birthDate: "2009-08-09" },
        { nisn: "0051000005", name: "Eko Saputra", gender: "L", birthDate: "2008-11-30" },
        { nisn: "0051000006", name: "Fitri Handayani", gender: "P", birthDate: "2008-02-14" },
        { nisn: "0051000007", name: "Gilang Ramadhan", gender: "L", birthDate: "2007-07-07" },
        { nisn: "0051000008", name: "Hana Permata", gender: "P", birthDate: "2007-12-01" },
      ])
      .returning();

    await tx.insert(studentEnrollments).values([
      { studentId: studentRows[0].id, classId: class10Ipa.id, academicYearId: year2026.id },
      { studentId: studentRows[1].id, classId: class10Ipa.id, academicYearId: year2026.id },
      { studentId: studentRows[2].id, classId: class10Ipa.id, academicYearId: year2026.id },
      { studentId: studentRows[3].id, classId: class10Ips.id, academicYearId: year2026.id },
      { studentId: studentRows[4].id, classId: class10Ips.id, academicYearId: year2026.id },
      { studentId: studentRows[5].id, classId: class11Ipa.id, academicYearId: year2026.id },
      { studentId: studentRows[6].id, classId: class11Ipa.id, academicYearId: year2026.id },
      { studentId: studentRows[7].id, classId: class12Ipa.id, academicYearId: year2026.id },
    ]);

    const scheduleRows = await tx
      .insert(schedules)
      .values([
        {
          semesterId: activeSemester.id,
          teacherId: sari.id,
          subjectId: mtk.id,
          classId: class10Ipa.id,
          dayOfWeek,
          periodStart: 1,
          periodEnd: 2,
          room: "Ruang 10 IPA 1",
        },
        {
          semesterId: activeSemester.id,
          teacherId: andi.id,
          subjectId: fis.id,
          classId: class11Ipa.id,
          dayOfWeek: (dayOfWeek % 7) + 1,
          periodStart: 3,
          periodEnd: 4,
          room: "Lab Fisika",
        },
        {
          semesterId: activeSemester.id,
          teacherId: waka.id,
          subjectId: mtk.id,
          classId: class12Ipa.id,
          dayOfWeek: ((dayOfWeek + 1) % 7) + 1,
          periodStart: 1,
          periodEnd: 2,
          room: "Ruang 12 IPA 1",
        },
        {
          semesterId: activeSemester.id,
          teacherId: sari.id,
          subjectId: bin.id,
          classId: class10Ips.id,
          dayOfWeek: ((dayOfWeek + 2) % 7) + 1,
          periodStart: 6,
          periodEnd: 7,
          room: "Ruang 10 IPS 1",
        },
      ])
      .returning();

    const [journal] = await tx
      .insert(journals)
      .values({
        scheduleId: scheduleRows[0].id,
        date: today,
        teacherId: sari.id,
        material: "Persamaan linear dua variabel",
        activity: "Diskusi kelompok dan latihan soal",
        notes: "Kelas kondusif.",
        createdBy: sari.id,
      })
      .returning();

    await tx.insert(attendanceRecords).values({
      journalId: journal.id,
      studentId: studentRows[1].id,
      status: "IZIN",
      note: "Mengikuti lomba olimpiade.",
    });

    console.log("Seed selesai.");
    console.log(`Admin: ${ADMIN_EMAIL} / ${DEFAULT_PASSWORD}`);
    console.log("Waka: waka@sekolah.sch.id / password yang sama");
    console.log("Guru: sari@sekolah.sch.id, andi@sekolah.sch.id / password yang sama");
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

