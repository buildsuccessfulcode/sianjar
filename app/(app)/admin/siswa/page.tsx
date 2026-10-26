import type { Metadata } from "next";
import Link from "next/link";
import { Download, Pencil, Plus, Upload } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { FilterBar } from "@/components/ui/filter-bar";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getActiveAcademicYear,
  listAcademicYears,
  listClasses,
  listStudentsPaged,
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
  deleteStudent,
  importStudentsAction,
  saveStudent,
} from "./actions";

export const metadata: Metadata = { title: "Siswa" };
export const dynamic = "force-dynamic";

type StudentRow = Awaited<ReturnType<typeof listStudentsPaged>>["rows"][number];

function StudentFields({ student }: { student?: StudentRow }) {
  return (
    <>
      {student ? <input type="hidden" name="id" value={student.id} /> : null}
      <Field label="NISN" htmlFor="nisn" required>
        <Input
          id="nisn"
          name="nisn"
          placeholder="0051234567"
          defaultValue={student?.nisn}
          required
        />
      </Field>
      <Field label="Nama Lengkap" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          placeholder="Ahmad Fauzi"
          defaultValue={student?.name}
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jenis Kelamin" htmlFor="gender" required>
          <Select
            id="gender"
            name="gender"
            defaultValue={student?.gender ?? "L"}
            required
          >
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </Select>
        </Field>
        <Field label="Tanggal Lahir" htmlFor="birthDate">
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={student?.birthDate ?? ""}
          />
        </Field>
      </div>
      {student ? (
        <Checkbox
          id="isActive"
          name="isActive"
          label="Siswa aktif"
          defaultChecked={student.isActive}
        />
      ) : null}
    </>
  );
}

const sortOptions = ["name", "nisn", "class", "gender", "isActive"] as const;
const BASE_PATH = "/admin/siswa";

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("manage:master_data");
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : undefined;
  const selectedYearId =
    typeof params.year === "string" ? params.year : undefined;
  const classId = typeof params.classId === "string" ? params.classId : undefined;
  const gender: "L" | "P" | undefined =
    params.gender === "L" || params.gender === "P" ? params.gender : undefined;
  const status: "active" | "inactive" | undefined =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;
  const enrollmentStatus =
    typeof params.enrollmentStatus === "string" &&
    params.enrollmentStatus in ENROLLMENT_STATUS_LABELS
      ? (params.enrollmentStatus as EnrollmentStatus)
      : undefined;
  const sort = resolveSort(params.sort, sortOptions, "name");
  const dir = resolveDirection(params.dir, "asc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const returnTo = buildListHref(BASE_PATH, params);

  const [years, activeYear] = await Promise.all([
    listAcademicYears(),
    getActiveAcademicYear(),
  ]);
  const effectiveYearId = selectedYearId ?? activeYear?.id ?? "";
  const classes = effectiveYearId ? await listClasses(effectiveYearId) : [];
  const result = await listStudentsPaged({
    academicYearId: effectiveYearId || null,
    q,
    gender,
    status,
    classId,
    enrollmentStatus,
    sort,
    dir,
    page,
    perPage,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Siswa"
        description="Data siswa tidak menyimpan kelas secara langsung. Kelas diatur melalui Enrollment."
        actions={
          <>
            <Link
              href="/admin/enrollment"
              className={buttonVariants({ variant: "secondary" })}
            >
              Kelola Enrollment
            </Link>
            <ModalForm
              action={importStudentsAction}
              returnTo={returnTo}
              triggerLabel="Import Excel"
              triggerIcon={<Upload className="h-4 w-4" />}
              triggerVariant="secondary"
              title="Import Siswa dari Excel"
              description="Gunakan template resmi agar nama dan urutan kolom sesuai."
              submitLabel="Import Siswa"
              pendingText="Mengimpor..."
            >
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p>
                  Unduh template, isi data mulai baris 2, lalu unggah kembali
                  file <span className="font-medium text-slate-900">.xlsx</span>.
                </p>
                <a
                  href="/admin/siswa/template"
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  <Download className="h-4 w-4" />
                  Unduh Template Excel
                </a>
                <p className="text-xs text-slate-500">
                  Baris dengan NISN yang sudah terdaftar akan dilewati. Kelas
                  siswa diatur melalui menu Enrollment setelah import.
                </p>
              </div>
              <Field
                label="File Excel"
                htmlFor="file"
                required
                hint="Format .xlsx, maksimal 5 MB dan 5000 baris."
              >
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                />
              </Field>
            </ModalForm>
            <ModalForm
              action={saveStudent}
              returnTo={returnTo}
              triggerLabel="Tambah Siswa"
              triggerIcon={<Plus className="h-4 w-4" />}
              title="Tambah Siswa"
              description="NISN harus unik."
              submitLabel="Tambah Siswa"
            >
              <StudentFields />
            </ModalForm>
          </>
        }
      />

      {!effectiveYearId ? (
        <Alert variant="warning">
          Belum ada tahun ajaran aktif. Kolom kelas akan kosong sampai tahun
          ajaran diaktifkan.
        </Alert>
      ) : null}

      <FilterBar
        resetHref={BASE_PATH}
        description="Filter tahun ajaran menentukan kelas dan status enrollment yang ditampilkan."
        formClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
        <SearchField
          defaultValue={q}
          placeholder="Cari nama atau NISN..."
        />
        <Field label="Tahun Ajaran" htmlFor="year">
          <Select id="year" name="year" defaultValue={effectiveYearId}>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.isActive ? " (aktif)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kelas" htmlFor="classId">
          <Select id="classId" name="classId" defaultValue={classId ?? ""}>
            <option value="">Semua kelas</option>
            <option value="none">Belum ada kelas</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {classLabel(row)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="L/P" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={gender ?? ""}>
            <option value="">Semua</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </Select>
        </Field>
        <Field label="Status siswa" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
        </Field>
        <Field label="Status enrollment" htmlFor="enrollmentStatus">
          <Select
            id="enrollmentStatus"
            name="enrollmentStatus"
            defaultValue={enrollmentStatus ?? ""}
          >
            <option value="">Semua</option>
            {(
              Object.keys(ENROLLMENT_STATUS_LABELS) as EnrollmentStatus[]
            ).map((value) => (
              <option key={value} value={value}>
                {ENROLLMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Siswa
          <Badge variant="neutral">{result.total} data</Badge>
          {effectiveYearId ? (
            <Badge variant="primary">
              {years.find((year) => year.id === effectiveYearId)?.name ?? ""}
            </Badge>
          ) : null}
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="NISN"
                column="nisn"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Nama"
                column="name"
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
                label="L/P"
                column="gender"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Status"
                column="isActive"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-mono text-xs">
                  {student.nisn}
                </TableCell>
                <TableCell className="font-medium text-slate-900">
                  {student.name}
                </TableCell>
                <TableCell>{student.className ?? "—"}</TableCell>
                <TableCell>{student.gender}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={student.isActive ? "success" : "neutral"}>
                      {student.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                    {student.enrollmentStatus ? (
                      <Badge variant="primary">
                        {
                          ENROLLMENT_STATUS_LABELS[
                            student.enrollmentStatus as EnrollmentStatus
                          ]
                        }
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ModalForm
                      action={saveStudent}
                      returnTo={returnTo}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Siswa"
                      description="Perbarui data siswa."
                      submitLabel="Simpan Perubahan"
                    >
                      <StudentFields student={student} />
                    </ModalForm>
                    <form action={deleteStudent}>
                      <input type="hidden" name="id" value={student.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        message={`Nonaktifkan siswa ${student.name}? Riwayat absensi tetap tersimpan.`}
                      >
                        Nonaktifkan
                      </ConfirmSubmit>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Tidak ada siswa pada filter ini.
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
    </div>
  );
}
