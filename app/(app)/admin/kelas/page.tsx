import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
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
  getActiveAcademicYear,
  listAcademicYears,
  listClasses,
  listDepartments,
  listTeacherOptions,
} from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import { classLabel } from "@/lib/utils";
import { deleteClass, saveClass } from "./actions";

export const metadata: Metadata = { title: "Kelas" };
export const dynamic = "force-dynamic";

type ClassRow = Awaited<ReturnType<typeof listClasses>>[number];
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
        <Field label="Rombel" htmlFor="section" required>
          <Input
            id="section"
            name="section"
            placeholder="1"
            defaultValue={row?.section}
            required
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

export default async function ClassPage() {
  await requirePagePermission("manage:master_data");
  const [years, departments, teachers, activeYear, classes] = await Promise.all([
    listAcademicYears(),
    listDepartments(),
    listTeacherOptions(),
    getActiveAcademicYear(),
    listClasses(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelas"
        description="Kelas terikat pada tahun ajaran, jurusan, tingkat, dan rombel."
        actions={
          <ModalForm
            action={saveClass}
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

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Kelas
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kelas</TableHead>
              <TableHead>Tahun</TableHead>
              <TableHead>Wali Kelas</TableHead>
              <TableHead>Siswa</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((row) => (
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
                  <div className="flex justify-end gap-2">
                    <ModalForm
                      action={saveClass}
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
            {classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Belum ada kelas.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
