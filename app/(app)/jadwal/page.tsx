import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  Pencil,
  Plus,
  Settings2,
} from "lucide-react";

import { TeachingCalendar } from "@/components/domain/teaching-calendar";
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
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/form";
import { ModalForm } from "@/components/ui/modal-form";
import { PageHeader } from "@/components/ui/page-header";
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
import { listSchedules } from "@/data-access/schedules";
import { listTimeSlots } from "@/data-access/time-slots";
import { DAY_NAMES } from "@/db/schema/enums";
import { requirePagePermission } from "@/lib/dal";
import { hasPermission } from "@/lib/permissions";
import { dayOfWeekFromDate, todayInJakarta } from "@/lib/date";
import { classLabel, cn } from "@/lib/utils";
import { removeSchedule, saveSchedule } from "./actions";

export const metadata: Metadata = { title: "Jadwal Mengajar" };
export const dynamic = "force-dynamic";

type ScheduleRow = Awaited<ReturnType<typeof listSchedules>>[number];
type ClassRow = Awaited<ReturnType<typeof listClasses>>[number];
type TeacherRow = Awaited<ReturnType<typeof listTeacherOptions>>[number];
type SubjectRow = Awaited<ReturnType<typeof listSubjects>>[number];

function ScheduleFields({
  row,
  semesterId,
  teachers,
  subjects,
  classes,
}: {
  row?: ScheduleRow;
  semesterId: string;
  teachers: TeacherRow[];
  subjects: SubjectRow[];
  classes: ClassRow[];
}) {
  return (
    <>
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <input type="hidden" name="semesterId" value={semesterId} />
      <Field label="Guru" htmlFor="scheduleTeacherId" name="teacherId" required>
        <Select
          id="scheduleTeacherId"
          name="teacherId"
          defaultValue={row?.teacherId ?? ""}
          required
        >
          <option value="" disabled>
            Pilih guru
          </option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Mapel" htmlFor="scheduleSubjectId" name="subjectId" required>
        <Select
          id="scheduleSubjectId"
          name="subjectId"
          defaultValue={row?.subjectId ?? ""}
          required
        >
          <option value="" disabled>
            Pilih mapel
          </option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code} — {subject.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Kelas" htmlFor="scheduleClassId" name="classId" required>
        <Select
          id="scheduleClassId"
          name="classId"
          defaultValue={row?.classId ?? ""}
          required
        >
          <option value="" disabled>
            Pilih kelas
          </option>
          {classes.map((kelas) => (
            <option key={kelas.id} value={kelas.id}>
              {classLabel(kelas)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Hari" htmlFor="scheduleDayOfWeek" name="dayOfWeek" required>
          <Select
            id="scheduleDayOfWeek"
            name="dayOfWeek"
            defaultValue={String(row?.dayOfWeek ?? 1)}
            required
          >
            {DAY_NAMES.map((day, index) => (
              <option key={day} value={index + 1}>
                {day}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jam Mulai" htmlFor="periodStart" required>
          <Input
            id="periodStart"
            name="periodStart"
            type="number"
            min={1}
            max={20}
            defaultValue={row?.periodStart ?? 1}
            required
          />
        </Field>
        <Field label="Jam Selesai" htmlFor="periodEnd" required>
          <Input
            id="periodEnd"
            name="periodEnd"
            type="number"
            min={1}
            max={20}
            defaultValue={row?.periodEnd ?? 2}
            required
          />
        </Field>
      </div>
      <Field label="Ruang" htmlFor="room">
        <Input
          id="room"
          name="room"
          placeholder="Ruang 10A"
          defaultValue={row?.room ?? ""}
        />
      </Field>
    </>
  );
}

type SearchParams = Promise<{
  semesterId?: string;
  teacherId?: string;
  classId?: string;
  dayOfWeek?: string;
}>;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("read:jadwal_own");
  const canManage = hasPermission(user.roles, "manage:jadwal");
  const params = await searchParams;

  const [semesters, activeSemester, teachers, subjects] = await Promise.all([
    listSemesters(),
    getActiveSemester(),
    canManage ? listTeacherOptions() : Promise.resolve([]),
    canManage ? listSubjects() : Promise.resolve([]),
  ]);

  const selectedSemester =
    semesters.find((row) => row.id === params.semesterId) ??
    semesters.find((row) => row.id === activeSemester?.id) ??
    semesters[0] ??
    null;

  const classes =
    canManage && selectedSemester
      ? await listClasses(selectedSemester.academicYearId)
      : [];

  const schedules = selectedSemester
    ? await listSchedules({
        semesterId: selectedSemester.id,
        teacherId: canManage ? params.teacherId : user.id,
        classId: canManage ? params.classId : undefined,
        dayOfWeek:
          canManage && params.dayOfWeek
            ? Number(params.dayOfWeek)
            : undefined,
      })
    : [];

  const timeSlots = selectedSemester
    ? await listTimeSlots(selectedSemester.id)
    : [];

  const calendarSchedules = schedules.map((row) => ({
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    subjectName: row.subjectName,
    className: classLabel({
      gradeLevel: row.gradeLevel,
      section: row.section,
      departmentCode: row.departmentCode,
    }),
    teacherName: row.teacherName,
    room: row.room,
  }));

  const todayDay = dayOfWeekFromDate(todayInJakarta());

  const manageHref = selectedSemester
    ? `/jadwal/jam?semesterId=${selectedSemester.id}`
    : "/jadwal/jam";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jadwal Mengajar"
        description={
          canManage
            ? "Lihat jadwal dalam tampilan kalender, atur jam istirahat dan sholat, lalu kelola slot mengajar per semester."
            : "Jadwal mingguan Anda dalam tampilan kalender. Waktu istirahat dan sholat mengikuti pengaturan sekolah."
        }
        actions={
          canManage ? (
            <>
              {selectedSemester ? (
                <ModalForm
                  action={saveSchedule}
                  triggerLabel="Tambah Jadwal"
                  triggerIcon={<Plus className="h-4 w-4" />}
                  title="Tambah Jadwal"
                  description="Guru harus sudah dipetakan ke mapel yang dipilih. Nomor jam mengikuti susunan jam pelajaran."
                  submitLabel="Tambah Jadwal"
                >
                  <ScheduleFields
                    semesterId={selectedSemester.id}
                    teachers={teachers}
                    subjects={subjects}
                    classes={classes}
                  />
                </ModalForm>
              ) : null}
              <Link
                href={manageHref}
                className={buttonVariants({ variant: "secondary" })}
              >
                <Settings2 className="h-4 w-4" />
                Atur Jam & Istirahat
              </Link>
            </>
          ) : (
            <Badge variant="primary" className="h-9 px-3">
              <CalendarDays className="h-3.5 w-3.5" />
              Jadwal saya
            </Badge>
          )
        }
      />

      {!selectedSemester ? (
        <Alert variant="warning">
          Belum ada semester. Buat semester terlebih dahulu di menu Tahun
          Ajaran.
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            Filter
          </CardTitle>
          <CardDescription>
            Pilih semester dan filter opsional untuk melihat jadwal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className={cn(
              "grid gap-3",
              canManage ? "md:grid-cols-5" : "sm:grid-cols-2",
            )}
          >
            <Field label="Semester" htmlFor="filterSemesterId" name="semesterId">
              <Select
                id="filterSemesterId"
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
            {canManage ? (
              <>
                <Field label="Guru" htmlFor="filterTeacherId" name="teacherId">
                  <Select
                    id="filterTeacherId"
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
                <Field label="Kelas" htmlFor="filterClassId" name="classId">
                  <Select
                    id="filterClassId"
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
                <Field label="Hari" htmlFor="filterDayOfWeek" name="dayOfWeek">
                  <Select
                    id="filterDayOfWeek"
                    name="dayOfWeek"
                    defaultValue={params.dayOfWeek ?? ""}
                  >
                    <option value="">Semua hari</option>
                    {DAY_NAMES.map((day, index) => (
                      <option key={day} value={index + 1}>
                        {day}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}
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

      {selectedSemester ? (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4" />
                Kalender Mingguan
                <Badge variant="primary">
                  {selectedSemester.name} {selectedSemester.academicYearName}
                </Badge>
              </CardTitle>
              <CardDescription>
                Istirahat dan waktu sholat ditampilkan di antara jam pelajaran.
                Geser hari pada layar kecil untuk melihat hari lain.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <EmptyState
                title="Belum ada jadwal pada filter ini"
                description={
                  canManage
                    ? "Tambahkan jadwal melalui tombol Tambah Jadwal, atau ubah filter semester/guru/kelas."
                    : "Jadwal akan tampil setelah Waka Kurikulum menambahkannya."
                }
                icon={<CalendarDays className="h-8 w-8" />}
              />
            ) : (
              <TeachingCalendar
                key={params.dayOfWeek ?? "all"}
                slots={timeSlots.map((slot) => ({
                  id: slot.id,
                  label: slot.label,
                  kind: slot.kind,
                  periodNumber: slot.periodNumber,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                }))}
                schedules={calendarSchedules}
                viewer={canManage ? "manager" : "teacher"}
                todayDay={todayDay}
                filterDay={
                  canManage && params.dayOfWeek
                    ? Number(params.dayOfWeek)
                    : undefined
                }
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      {canManage && selectedSemester ? (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Daftar Jadwal {selectedSemester.name}{" "}
              {selectedSemester.academicYearName}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hari / Jam</TableHead>
                  <TableHead>Mapel</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Guru</TableHead>
                  <TableHead>Ruang</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium text-slate-900">
                        {DAY_NAMES[row.dayOfWeek - 1]}
                      </p>
                      <p className="text-xs text-slate-500">
                        Jam {row.periodStart}–{row.periodEnd}
                      </p>
                    </TableCell>
                    <TableCell>{row.subjectName}</TableCell>
                    <TableCell>
                      {classLabel({
                        gradeLevel: row.gradeLevel,
                        section: row.section,
                        departmentCode: row.departmentCode,
                      })}
                    </TableCell>
                    <TableCell>{row.teacherName}</TableCell>
                    <TableCell>{row.room ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <ModalForm
                          action={saveSchedule}
                          triggerLabel="Ubah"
                          triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                          triggerVariant="ghost"
                          triggerSize="sm"
                          title="Ubah Jadwal"
                          description="Perbarui guru, mapel, kelas, waktu, atau ruang."
                          submitLabel="Simpan Perubahan"
                        >
                          <ScheduleFields
                            row={row}
                            semesterId={row.semesterId}
                            teachers={teachers}
                            subjects={subjects}
                            classes={classes}
                          />
                        </ModalForm>
                        <form action={removeSchedule}>
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmSubmit
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            message="Hapus jadwal ini? Jadwal yang sudah memiliki jurnal tidak dapat dihapus."
                          >
                            Hapus
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500">
                      Belum ada jadwal pada filter ini.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
      ) : null}
    </div>
  );
}
