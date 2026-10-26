import type { Metadata } from "next";
import { Filter, Plus, UserPlus, Users } from "lucide-react";

import { BulkEnrollmentForm } from "@/components/domain/bulk-enrollment-form";
import { EnrollmentTable } from "@/components/domain/enrollment-table";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { ModalForm } from "@/components/ui/modal-form";
import { PageHeader } from "@/components/ui/page-header";
import {
  getActiveAcademicYear,
  listAcademicYears,
  listClasses,
  listEnrollments,
  listStudentEnrollmentOptions,
} from "@/data-access/master";
import {
  ENROLLMENT_STATUS_LABELS,
  type EnrollmentStatus,
} from "@/db/schema/enums";
import { requirePagePermission } from "@/lib/dal";
import { classLabel } from "@/lib/utils";
import {
  moveEnrollmentsBulk,
  removeEnrollment,
  saveEnrollment,
  saveEnrollmentBulk,
  updateEnrollmentAction,
} from "./actions";

export const metadata: Metadata = { title: "Enrollment" };
export const dynamic = "force-dynamic";

type ClassRow = Awaited<ReturnType<typeof listClasses>>[number];
type StudentOption = Awaited<
  ReturnType<typeof listStudentEnrollmentOptions>
>[number];

function EnrollmentFields({
  classes,
  students,
  yearId,
}: {
  classes: ClassRow[];
  students: StudentOption[];
  yearId: string;
}) {
  return (
    <>
      <input type="hidden" name="year" value={yearId} />
      <input type="hidden" name="academicYearId" value={yearId} />
      <Field label="Siswa" htmlFor="studentId" required>
        <Select id="studentId" name="studentId" defaultValue="" required>
          <option value="" disabled>
            Pilih siswa
          </option>
          {students.map((student) => (
            <option
              key={student.id}
              value={student.id}
              disabled={Boolean(student.enrollmentStatus)}
            >
              {student.nisn} — {student.name}
              {student.enrollmentStatus ? " (sudah terdaftar)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Kelas" htmlFor="classId" required>
        <Select id="classId" name="classId" defaultValue="" required>
          <option value="" disabled>
            Pilih kelas
          </option>
          {classes.map((row) => (
            <option key={row.id} value={row.id}>
              {classLabel(row)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status" htmlFor="status" required>
        <Select id="status" name="status" defaultValue="ACTIVE">
          {(Object.keys(ENROLLMENT_STATUS_LABELS) as EnrollmentStatus[]).map(
            (status) => (
              <option key={status} value={status}>
                {ENROLLMENT_STATUS_LABELS[status]}
              </option>
            ),
          )}
        </Select>
      </Field>
    </>
  );
}

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requirePagePermission("manage:master_data");
  const params = await searchParams;
  const [years, activeYear] = await Promise.all([
    listAcademicYears(),
    getActiveAcademicYear(),
  ]);
  const selectedYearId =
    params.year ?? activeYear?.id ?? years[0]?.id ?? "";

  const [classes, students, enrollments] = await Promise.all([
    selectedYearId ? listClasses(selectedYearId) : Promise.resolve([]),
    selectedYearId
      ? listStudentEnrollmentOptions(selectedYearId)
      : Promise.resolve([]),
    listEnrollments(selectedYearId || undefined),
  ]);

  const statusOptions = (
    Object.keys(ENROLLMENT_STATUS_LABELS) as EnrollmentStatus[]
  ).map((status) => ({
    value: status,
    label: ENROLLMENT_STATUS_LABELS[status],
  }));
  const classOptions = classes.map((row) => ({
    id: row.id,
    label: classLabel(row),
  }));
  const enrollmentRows = enrollments.map((row) => ({
    id: row.id,
    studentName: row.studentName,
    nisn: row.nisn,
    classId: row.classId,
    className: classLabel({
      gradeLevel: row.gradeLevel,
      section: row.section,
      departmentCode: row.departmentCode,
    }),
    status: row.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrollment"
        description="Enrollment menempatkan siswa pada kelas di tahun ajaran tertentu tanpa menimpa histori."
        actions={
          selectedYearId ? (
            <>
              <ModalForm
                action={saveEnrollmentBulk}
                triggerLabel="Enrollment Massal"
                triggerIcon={<Users className="h-4 w-4" />}
                title="Enrollment Massal"
                description="Pilih beberapa siswa dan tempatkan pada satu kelas. Siswa yang sudah terdaftar akan dilewati."
                submitLabel="Simpan Enrollment"
                pendingText="Menyimpan..."
                size="lg"
              >
                <BulkEnrollmentForm
                  students={students}
                  classes={classOptions}
                  yearId={selectedYearId}
                  statusOptions={statusOptions}
                />
              </ModalForm>
              <ModalForm
                action={saveEnrollment}
                triggerLabel="Tambah Satuan"
                triggerIcon={<Plus className="h-4 w-4" />}
                triggerVariant="secondary"
                title="Tambah Enrollment"
                description="Pilih siswa dan kelas pada tahun ajaran yang dipilih."
                submitLabel="Simpan Enrollment"
              >
                <EnrollmentFields
                  classes={classes}
                  students={students}
                  yearId={selectedYearId}
                />
              </ModalForm>
            </>
          ) : undefined
        }
      />

      {!selectedYearId ? (
        <Alert variant="warning">
          Buat dan pilih tahun ajaran terlebih dahulu.
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Pilih Tahun Ajaran
          </CardTitle>
          <CardDescription>
            Daftar kelas dan enrollment mengikuti tahun ajaran yang dipilih.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs">
              <Field label="Tahun Ajaran" htmlFor="year">
                <Select id="year" name="year" defaultValue={selectedYearId}>
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <button
              type="submit"
              className="h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Tampilkan
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <UserPlus className="h-4 w-4" />
          Daftar Enrollment
        </h2>
        <EnrollmentTable
          rows={enrollmentRows}
          classes={classOptions}
          yearId={selectedYearId}
          statusOptions={statusOptions}
          updateAction={updateEnrollmentAction}
          moveAction={moveEnrollmentsBulk}
          removeAction={removeEnrollment}
        />
      </div>
    </div>
  );
}
