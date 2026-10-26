import type { Metadata } from "next";
import { Link2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Field, Select } from "@/components/ui/form";
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
  listSubjects,
  listTeacherOptions,
  listTeacherSubjects,
  listTeachers,
} from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import { addMapping, removeMapping } from "./actions";

export const metadata: Metadata = { title: "Mapping Guru–Mapel" };
export const dynamic = "force-dynamic";

type TeacherOption = Awaited<ReturnType<typeof listTeacherOptions>>[number];
type SubjectRow = Awaited<ReturnType<typeof listSubjects>>[number];

function MappingFields({
  teacherOptions,
  subjects,
}: {
  teacherOptions: TeacherOption[];
  subjects: SubjectRow[];
}) {
  return (
    <>
      <Field label="Guru" htmlFor="teacherId" required>
        <Select id="teacherId" name="teacherId" defaultValue="" required>
          <option value="" disabled>
            Pilih guru
          </option>
          {teacherOptions.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Mapel" htmlFor="subjectId" required>
        <Select id="subjectId" name="subjectId" defaultValue="" required>
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
    </>
  );
}

export default async function TeacherSubjectPage() {
  await requirePagePermission("manage:mapping_guru_mapel");
  const [teachers, teacherOptions, subjects, mappings] = await Promise.all([
    listTeachers(),
    listTeacherOptions(),
    listSubjects(),
    listTeacherSubjects(),
  ]);

  const teacherName = new Map(
    teachers.map((teacher) => [teacher.id, teacher.name]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapping Guru–Mapel"
        description="Jadwal hanya dapat dibuat jika guru sudah dipetakan ke mapel yang dipilih."
        actions={
          <ModalForm
            action={addMapping}
            triggerLabel="Tambah Mapping"
            triggerIcon={<Plus className="h-4 w-4" />}
            title="Tambah Mapping"
            description="Satu guru boleh mengampu beberapa mapel."
            submitLabel="Tambah Mapping"
          >
            <MappingFields teacherOptions={teacherOptions} subjects={subjects} />
          </ModalForm>
        }
      />

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Link2 className="h-4 w-4" />
          Daftar Mapping ({mappings.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guru</TableHead>
              <TableHead>Mapel</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((mapping) => (
              <TableRow key={`${mapping.teacherId}-${mapping.subjectId}`}>
                <TableCell className="font-medium text-slate-900">
                  {teacherName.get(mapping.teacherId) ?? "Guru"}
                </TableCell>
                <TableCell>
                  <Badge variant="primary">{mapping.subjectCode}</Badge>{" "}
                  {mapping.subjectName}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <form action={removeMapping}>
                      <input
                        type="hidden"
                        name="teacherId"
                        value={mapping.teacherId}
                      />
                      <input
                        type="hidden"
                        name="subjectId"
                        value={mapping.subjectId}
                      />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        message="Hapus mapping ini? Jadwal yang sudah ada tidak berubah."
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </ConfirmSubmit>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-slate-500">
                  Belum ada mapping. Tambahkan mapping agar guru bisa
                  dijadwalkan.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
