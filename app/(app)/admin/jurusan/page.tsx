import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Field, Input } from "@/components/ui/form";
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
import { listDepartments } from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import { deleteDepartment, saveDepartment } from "./actions";

export const metadata: Metadata = { title: "Jurusan" };
export const dynamic = "force-dynamic";

type DepartmentRow = Awaited<ReturnType<typeof listDepartments>>[number];

function DepartmentFields({ department }: { department?: DepartmentRow }) {
  return (
    <>
      {department ? (
        <input type="hidden" name="id" value={department.id} />
      ) : null}
      <Field label="Kode" htmlFor="code" required>
        <Input
          id="code"
          name="code"
          placeholder="IPA"
          defaultValue={department?.code}
          required
        />
      </Field>
      <Field label="Nama" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          placeholder="Ilmu Pengetahuan Alam"
          defaultValue={department?.name}
          required
        />
      </Field>
    </>
  );
}

export default async function DepartmentPage() {
  await requirePagePermission("manage:master_data");
  const departments = await listDepartments();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurusan"
        description="Kode jurusan dipakai pada nama kelas, misalnya IPA, IPS, atau TKJ."
        actions={
          <ModalForm
            action={saveDepartment}
            triggerLabel="Tambah Jurusan"
            triggerIcon={<Plus className="h-4 w-4" />}
            title="Tambah Jurusan"
            description="Kode harus unik dan singkat."
            submitLabel="Tambah Jurusan"
          >
            <DepartmentFields />
          </ModalForm>
        }
      />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Jurusan
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((department) => (
              <TableRow key={department.id}>
                <TableCell className="font-medium text-slate-900">
                  {department.code}
                </TableCell>
                <TableCell>{department.name}</TableCell>
                <TableCell>
                  <Badge variant={department.isActive ? "success" : "neutral"}>
                    {department.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ModalForm
                      action={saveDepartment}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Jurusan"
                      description="Perbarui kode atau nama jurusan."
                      submitLabel="Simpan Perubahan"
                    >
                      <DepartmentFields department={department} />
                    </ModalForm>
                    <form action={deleteDepartment}>
                      <input type="hidden" name="id" value={department.id} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        message={`Nonaktifkan jurusan ${department.name}?`}
                      >
                        Nonaktifkan
                      </ConfirmSubmit>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Belum ada jurusan.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
