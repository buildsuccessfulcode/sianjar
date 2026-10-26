import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import {
  CalendarClock,
  CalendarDays,
  Copy,
  Pencil,
  Plus,
  Settings2,
} from "lucide-react";

import { CalendarScope } from "@/components/domain/calendar-scope";
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
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { ListQueryHidden } from "@/components/ui/list-query-hidden";
import { ModalForm } from "@/components/ui/modal-form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import { SortableHead } from "@/components/ui/sortable-head";
import {
  Table,
  TableBody,
  TableCell,
  TableGroupRow,
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
import { listSchedules, listSchedulesPaged } from "@/data-access/schedules";
import { listTimeSlots } from "@/data-access/time-slots";
import { DAY_NAMES } from "@/db/schema/enums";
import { requirePagePermission } from "@/lib/dal";
import { hasPermission } from "@/lib/permissions";
import { dayOfWeekFromDate, todayInJakarta } from "@/lib/date";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { classLabel, cn } from "@/lib/utils";
import {
  copyScheduleDataAction,
  removeSchedule,
  saveSchedule,
} from "./actions";

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

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const sortOptions = [
  "day",
  "period",
  "subject",
  "class",
  "teacher",
  "room",
] as const;
const BASE_PATH = "/jadwal";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("read:jadwal_own");
  const canManage = hasPermission(user.roles, "manage:jadwal");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const subjectId =
    typeof params.subjectId === "string" ? params.subjectId : undefined;
  const sort = resolveSort(params.sort, sortOptions, "day");
  const dir = resolveDirection(params.dir, "asc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const returnTo = buildListHref(BASE_PATH, params);

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

  const selectedTeacherId =
    canManage && typeof params.teacherId === "string" && params.teacherId
      ? params.teacherId
      : undefined;
  const selectedClassId =
    canManage && typeof params.classId === "string" && params.classId
      ? params.classId
      : undefined;

  const scheduleFilters = {
    semesterId: selectedSemester?.id,
    teacherId: canManage ? selectedTeacherId : user.id,
    classId: selectedClassId,
    subjectId: canManage ? subjectId : undefined,
    dayOfWeek:
      canManage && typeof params.dayOfWeek === "string" && params.dayOfWeek
        ? Number(params.dayOfWeek)
        : undefined,
    q,
  };

  const schedules = selectedSemester
    ? await listSchedules(scheduleFilters)
    : [];
  const result = selectedSemester
    ? await listSchedulesPaged({
        ...scheduleFilters,
        sort,
        dir,
        page,
        perPage,
      })
    : null;

  const timeSlots = selectedSemester
    ? await listTimeSlots(selectedSemester.id)
    : [];

  const copySources = selectedSemester
    ? semesters
        .filter(
          (semester) =>
            semester.id !== selectedSemester.id &&
            semester.startDate < selectedSemester.startDate,
        )
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
    : [];
  const timeSlotsEmpty = timeSlots.length === 0;

  const calendarClass =
    canManage && !selectedTeacherId
      ? (classes.find((row) => row.id === selectedClassId) ??
        classes[0] ??
        null)
      : null;
  const calendarRows = calendarClass
    ? schedules.filter((row) => row.classId === calendarClass.id)
    : schedules;

  const calendarSchedules = calendarRows.map((row) => ({
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
                  returnTo={returnTo}
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
              {selectedSemester && copySources.length > 0 ? (
                <ModalForm
                  action={copyScheduleDataAction}
                  triggerLabel="Salin Jadwal"
                  triggerIcon={<Copy className="h-4 w-4" />}
                  triggerVariant="secondary"
                  title="Salin Jadwal & Jam"
                  description="Salin susunan jam dan jadwal mengajar dari semester sebelumnya."
                  submitLabel="Salin Data"
                  pendingText="Menyalin..."
                >
                  <input
                    type="hidden"
                    name="targetSemesterId"
                    value={selectedSemester.id}
                  />
                  <Field
                    label="Semester sumber"
                    htmlFor="sourceSemesterId"
                    name="sourceSemesterId"
                    required
                  >
                    <Select
                      id="sourceSemesterId"
                      name="sourceSemesterId"
                      defaultValue={copySources[0]?.id ?? ""}
                      required
                    >
                      {copySources.map((semester) => (
                        <option key={semester.id} value={semester.id}>
                          {semester.name} — {semester.academicYearName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <Checkbox
                      id="copySchedules"
                      name="copySchedules"
                      label="Salin jadwal mengajar"
                      defaultChecked
                    />
                    <Checkbox
                      id="copyTimeSlots"
                      name="copyTimeSlots"
                      label={
                        timeSlotsEmpty
                          ? "Salin susunan jam pelajaran"
                          : "Susunan jam tujuan sudah ada"
                      }
                      defaultChecked={timeSlotsEmpty}
                      disabled={!timeSlotsEmpty}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Kelas tujuan dipetakan mengikuti kenaikan tingkat (X → XI).
                    Pastikan promosi kelas sudah dijalankan. Jadwal yang bentrok
                    atau kelasnya belum memiliki padanan akan dilewati.
                  </p>
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
              canManage ? "md:grid-cols-2 xl:grid-cols-7" : "sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
            <SearchField
              defaultValue={q}
              placeholder="Cari guru, mapel, kelas, ruang..."
            />
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
                <Field label="Mapel" htmlFor="filterSubjectId" name="subjectId">
                  <Select
                    id="filterSubjectId"
                    name="subjectId"
                    defaultValue={subjectId ?? ""}
                  >
                    <option value="">Semua mapel</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
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
            <div className="flex items-end md:col-span-full">
              <button
                type="submit"
                className="h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Terapkan
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {selectedSemester ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4" />
                Kalender Mingguan
                <Badge variant="primary">
                  {selectedSemester.name} {selectedSemester.academicYearName}
                </Badge>
              </CardTitle>
              <CardDescription>
                Jadwal ditampilkan per kelas atau guru. Istirahat dan waktu
                sholat tetap terlihat di antara jam pelajaran. Geser hari pada
                layar kecil untuk melihat hari lain.
              </CardDescription>
            </div>
            {canManage && (classes.length > 0 || teachers.length > 0) ? (
              <CalendarScope
                classes={classes.map((row) => ({
                  id: row.id,
                  label: classLabel(row),
                }))}
                teachers={teachers.map((row) => ({
                  id: row.id,
                  label: row.name,
                }))}
                selectedClassId={calendarClass?.id}
                selectedTeacherId={selectedTeacherId}
              />
            ) : null}
          </CardHeader>
          <CardContent>
            {calendarSchedules.length === 0 ? (
              <EmptyState
                title="Belum ada jadwal pada tampilan ini"
                description={
                  canManage
                    ? "Tambahkan jadwal melalui tombol Tambah Jadwal, salin dari semester sebelumnya, atau pilih kelas/guru lain pada Kalender untuk."
                    : "Jadwal akan tampil setelah Waka Kurikulum menambahkannya."
                }
                icon={<CalendarDays className="h-8 w-8" />}
              />
            ) : (
              <TeachingCalendar
                key={`${calendarClass?.id ?? selectedTeacherId ?? "all"}-${
                  typeof params.dayOfWeek === "string"
                    ? params.dayOfWeek
                    : "all"
                }`}
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

      {canManage && selectedSemester && result ? (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Daftar Jadwal {selectedSemester.name}{" "}
            {selectedSemester.academicYearName}
            <Badge variant="neutral">{result.total} slot</Badge>
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label="Hari / Jam"
                  column="day"
                  currentSort={sort}
                  currentDir={dir}
                  basePath={BASE_PATH}
                  searchParams={params}
                />
                <SortableHead
                  label="Mapel"
                  column="subject"
                  currentSort={sort}
                  currentDir={dir}
                  basePath={BASE_PATH}
                  searchParams={params}
                />
                <SortableHead
                  label="Kelas"
                  column="class"
                  currentSort={sort}
                  currentDir={dir}
                  basePath={BASE_PATH}
                  searchParams={params}
                />
                <SortableHead
                  label="Guru"
                  column="teacher"
                  currentSort={sort}
                  currentDir={dir}
                  basePath={BASE_PATH}
                  searchParams={params}
                />
                <SortableHead
                  label="Ruang"
                  column="room"
                  currentSort={sort}
                  currentDir={dir}
                  basePath={BASE_PATH}
                  searchParams={params}
                />
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row, index) => {
                const previous = result.rows[index - 1];
                const showGroup = !previous || previous.dayOfWeek !== row.dayOfWeek;
                return (
                  <Fragment key={row.id}>
                    {showGroup ? (
                      <TableGroupRow colSpan={6}>
                        {DAY_NAMES[row.dayOfWeek - 1]}
                      </TableGroupRow>
                    ) : null}
                    <TableRow>
                      <TableCell>
                        <p className="font-medium text-slate-900">
                          Jam {row.periodStart}–{row.periodEnd}
                        </p>
                        <p className="text-xs text-slate-500">Jam ke-{row.periodStart}</p>
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
                            returnTo={returnTo}
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
                            <input type="hidden" name="returnTo" value={returnTo} />
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
                  </Fragment>
                );
              })}
              {result.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    Belum ada jadwal pada filter ini.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pagination
            basePath={BASE_PATH}
            searchParams={params}
            page={result.page}
            perPage={result.perPage}
            total={result.total}
            totalPages={result.totalPages}
            from={result.from}
            to={result.to}
          />
        </div>
      ) : null}
    </div>
  );
}
