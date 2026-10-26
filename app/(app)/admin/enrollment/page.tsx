import type { Metadata } from "next";
import { Plus, UserPlus, Users } from "lucide-react";

import { BulkEnrollmentForm } from "@/components/domain/bulk-enrollment-form";
import { EnrollmentTable } from "@/components/domain/enrollment-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { Field, Select } from "@/components/ui/form";
import { ListQueryHidden } from "@/components/ui/list-query-hidden";
import { ModalForm } from "@/components/ui/modal-form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import { SortLinks } from "@/components/ui/sort-links";
import {
  getActiveAcademicYear,
  listAcademicYears,
  listClasses,
  listEnrollmentsPaged,
  listStudentEnrollmentOptions,
} from "@/data-access/master";
import {
  ENROLLMENT_STATUS_LABELS,
  type EnrollmentStatus,
} from "@/db/schema/enums";
import { requirePagePermission } from "@/lib/dal";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { classLabel } from "@/lib/utils";
import {
  bulkUpdateEnrollmentStatus,
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

const sortOptions = ["student", "class", "status"] as const;
const BASE_PATH = "/admin/enrollment";

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("manage:master_data");
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : undefined;
  const classId = typeof params.classId === "string" ? params.classId : undefined;
  const status: EnrollmentStatus | undefined =
    typeof params.status === "string" && params.status in ENROLLMENT_STATUS_LABELS
      ? (params.status as EnrollmentStatus)
      : undefined;
  const sort = resolveSort(params.sort, sortOptions, "student");
  const dir = resolveDirection(params.dir, "asc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const returnTo = buildListHref(BASE_PATH, params);

  const [years, activeYear] = await Promise.all([
    listAcademicYears(),
    getActiveAcademicYear(),
  ]);
  const requestedYearId =
    typeof params.year === "string" ? params.year : undefined;
  const selectedYearId = requestedYearId ?? activeYear?.id ?? years[0]?.id ?? "";

  const [classes, students, result] = await Promise.all([
    selectedYearId ? listClasses(selectedYearId) : Promise.resolve([]),
    selectedYearId
      ? listStudentEnrollmentOptions(selectedYearId)
      : Promise.resolve([]),
    listEnrollmentsPaged({
      academicYearId: selectedYearId || undefined,
      q,
      classId,
      status,
      sort,
      dir,
      page,
      perPage,
    }),
  ]);

  const statusOptions = (
    Object.keys(ENROLLMENT_STATUS_LABELS) as EnrollmentStatus[]
  ).map((value) => ({
    value,
    label: ENROLLMENT_STATUS_LABELS[value],
  }));
  const classOptions = classes.map((row) => ({
    id: row.id,
    label: classLabel(row),
  }));
  const enrollmentRows = result.rows.map((row) => ({
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
                returnTo={returnTo}
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
                returnTo={returnTo}
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

      <FilterBar
        resetHref={BASE_PATH}
        description="Pilih tahun ajaran, cari siswa, lalu saring kelas/status. Centang baris untuk aksi massal."
        formClassName="sm:grid-cols-2 lg:grid-cols-4"
      >
        <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
        <Field label="Tahun Ajaran" htmlFor="year">
          <Select id="year" name="year" defaultValue={selectedYearId}>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.isActive ? " (aktif)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <SearchField
          defaultValue={q}
          placeholder="Cari nama atau NISN siswa..."
        />
        <Field label="Kelas" htmlFor="classId">
          <Select id="classId" name="classId" defaultValue={classId ?? ""}>
            <option value="">Semua kelas</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {classLabel(row)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Semua status</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <UserPlus className="h-4 w-4" />
          Daftar Enrollment
          <Badge variant="neutral">{result.total} data</Badge>
          {selectedYearId ? (
            <Badge variant="primary">
              {years.find((year) => year.id === selectedYearId)?.name ?? ""}
            </Badge>
          ) : null}
        </h2>
        <EnrollmentTable
          rows={enrollmentRows}
          classes={classOptions}
          yearId={selectedYearId}
          statusOptions={statusOptions}
          updateAction={updateEnrollmentAction}
          moveAction={moveEnrollmentsBulk}
          statusAction={bulkUpdateEnrollmentStatus}
          removeAction={removeEnrollment}
          returnTo={returnTo}
          sortControls={
            <SortLinks
              items={[
                { label: "Siswa", column: "student" },
                { label: "Kelas", column: "class" },
                { label: "Status", column: "status" },
              ]}
              currentSort={sort}
              currentDir={dir}
              basePath={BASE_PATH}
              searchParams={params}
            />
          }
        />
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
    </div>
  );
}
