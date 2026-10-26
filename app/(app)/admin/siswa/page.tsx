import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
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
import { getActiveAcademicYear, listStudents } from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import { deleteStudent, saveStudent } from "./actions";

export const metadata: Metadata = { title: "Siswa" };
export const dynamic = "force-dynamic";

type StudentRow = Awaited<ReturnType<typeof listStudents>>[number];

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

export default async function StudentPage() {
  await requirePagePermission("manage:master_data");
  const activeYear = await getActiveAcademicYear();
  const students = await listStudents(activeYear?.id ?? null);

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
              action={saveStudent}
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

      {!activeYear ? (
        <Alert variant="warning">
          Belum ada tahun ajaran aktif. Kolom kelas akan kosong sampai tahun
          ajaran diaktifkan.
        </Alert>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Siswa {activeYear ? `· ${activeYear.name}` : ""}
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NISN</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>L/P</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
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
                      <Badge variant="primary">{student.enrollmentStatus}</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ModalForm
                      action={saveStudent}
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
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Belum ada siswa.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
