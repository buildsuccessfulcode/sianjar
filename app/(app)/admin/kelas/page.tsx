import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { FilterBar } from "@/components/ui/filter-bar";
import { Field, Input, Select } from "@/components/ui/form";
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
  listClassesPaged,
  listDepartments,
  listTeacherOptions,
} from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { classLabel } from "@/lib/utils";
import { deleteClass, saveClass } from "./actions";

export const metadata: Metadata = { title: "Kelas" };
export const dynamic = "force-dynamic";

type ClassRow = Awaited<ReturnType<typeof listClassesPaged>>["rows"][number];
type YearRow = Awaited<ReturnType<typeof listAcademicYears>>[number];
type DepartmentRow = Awaited<ReturnType<typeof listDepartments>>[number];
type TeacherRow = Awaited<ReturnType<typeof listTeacherOptions>>[number];

function ClassFields({
  row,
  years,
  departments,
  teachers,
  activeYearId,
}: {
  row?: ClassRow;
  years: YearRow[];
  departments: DepartmentRow[];
  teachers: TeacherRow[];
  activeYearId?: string;
}) {
  return (
    <>
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      {row ? (
        <>
          <input type="hidden" name="academicYearId" value={row.academicYearId} />
          <Field label="Tahun Ajaran" htmlFor="academicYearDisplay">
            <Input id="academicYearDisplay" value={row.academicYearName} disabled />
          </Field>
        </>
      ) : (
        <Field label="Tahun Ajaran" htmlFor="academicYearId" required>
          <Select
            id="academicYearId"
            name="academicYearId"
            defaultValue={activeYearId ?? years[0]?.id ?? ""}
            required
          >
            <option value="" disabled>
              Pilih tahun ajaran
            </option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Jurusan" htmlFor="departmentId" required>
        <Select
          id="departmentId"
          name="departmentId"
          defaultValue={row?.departmentId ?? ""}
          required
        >
          <option value="" disabled>
            Pilih jurusan
          </option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.code} — {department.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tingkat" htmlFor="gradeLevel" required>
          <Select
            id="gradeLevel"
            name="gradeLevel"
            defaultValue={String(row?.gradeLevel ?? 10)}
            required
          >
            {[7, 8, 9, 10, 11, 12].map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rombel (opsional)" htmlFor="section">
          <Input
            id="section"
            name="section"
            placeholder="Opsional"
            defaultValue={row?.section}
          />
        </Field>
      </div>
      <Field label="Wali Kelas" htmlFor="homeroomTeacherId" hint="Opsional.">
        <Select
          id="homeroomTeacherId"
          name="homeroomTeacherId"
          defaultValue={row?.homeroomTeacherId ?? ""}
        >
          <option value="">Tidak ditentukan</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

const sortOptions = [
  "class",
  "year",
  "homeroom",
  "studentCount",
  "status",
] as const;
const BASE_PATH = "/admin/kelas";

export default async function ClassPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("manage:master_data");
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : undefined;
  const academicYearId =
    typeof params.year === "string" ? params.year : undefined;
  const departmentId =
    typeof params.department === "string" ? params.department : undefined;
  const gradeLevel = Number(params.grade);
  const status: "active" | "inactive" | undefined =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;
  const sort = resolveSort(params.sort, sortOptions, "class");
  const dir = resolveDirection(params.dir, "asc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const returnTo = buildListHref(BASE_PATH, params);

  const [years, departments, teachers, activeYear, result] = await Promise.all([
    listAcademicYears(),
    listDepartments(),
    listTeacherOptions(),
    getActiveAcademicYear(),
    listClassesPaged({
      academicYearId,
      departmentId,
      gradeLevel: [7, 8, 9, 10, 11, 12].includes(gradeLevel)
        ? gradeLevel
        : undefined,
      q,
      status,
      sort,
      dir,
      page,
      perPage,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelas"
        description="Kelas terikat pada tahun ajaran, jurusan, tingkat, dan rombel."
        actions={
          <ModalForm
            action={saveClass}
            returnTo={returnTo}
            triggerLabel="Tambah Kelas"
            triggerIcon={<Plus className="h-4 w-4" />}
            title="Tambah Kelas"
            description="Rombel biasanya berupa angka atau huruf, misalnya 1, 2, A."
            submitLabel="Tambah Kelas"
          >
            <ClassFields
              years={years}
              departments={departments}
              teachers={teachers}
              activeYearId={activeYear?.id}
            />
          </ModalForm>
        }
      />

      <FilterBar
        resetHref={BASE_PATH}
        description="Saring kelas per tahun ajaran, jurusan, tingkat, dan status. Klik judul kolom untuk mengurutkan."
        formClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
        <SearchField
          defaultValue={q}
          placeholder="Cari kelas, jurusan, atau wali..."
        />
        <Field label="Tahun Ajaran" htmlFor="year">
          <Select id="year" name="year" defaultValue={academicYearId ?? ""}>
            <option value="">Semua tahun</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jurusan" htmlFor="department">
          <Select
            id="department"
            name="department"
            defaultValue={departmentId ?? ""}
          >
            <option value="">Semua jurusan</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.code} — {department.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tingkat" htmlFor="grade">
          <Select
            id="grade"
            name="grade"
            defaultValue={
              [7, 8, 9, 10, 11, 12].includes(gradeLevel)
                ? String(gradeLevel)
                : ""
            }
          >
            <option value="">Semua tingkat</option>
            {[7, 8, 9, 10, 11, 12].map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
        </Field>
      </FilterBar>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Kelas
          <Badge variant="neutral">{result.total} data</Badge>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Kelas"
                column="class"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Tahun"
                column="year"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Wali Kelas"
                column="homeroom"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Siswa"
                column="studentCount"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Status"
                column="status"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-slate-900">
                  {classLabel({
                    gradeLevel: row.gradeLevel,
                    section: row.section,
                    departmentCode: row.departmentCode,
                  })}
                </TableCell>
                <TableCell>{row.academicYearName}</TableCell>
                <TableCell>{row.homeroomTeacherName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={row.studentCount > 0 ? "primary" : "neutral"}>
                    {row.studentCount} siswa
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={row.isActive ? "success" : "neutral"}>
                    {row.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ModalForm
                      action={saveClass}
                      returnTo={returnTo}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Kelas"
                      description="Perbarui jurusan, tingkat, rombel, atau wali kelas."
                      submitLabel="Simpan Perubahan"
                    >
                      <ClassFields
                        row={row}
                        years={years}
                        departments={departments}
                        teachers={teachers}
                      />
                    </ModalForm>
                    <form action={deleteClass}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        message={`Nonaktifkan kelas ${classLabel(row)}? Pastikan tidak ada jadwal atau enrollment aktif.`}
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
                  Tidak ada kelas pada filter ini.
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
