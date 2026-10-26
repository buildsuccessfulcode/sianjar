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
import { listSubjects } from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import { deleteSubject, saveSubject } from "./actions";

export const metadata: Metadata = { title: "Mapel" };
export const dynamic = "force-dynamic";

type SubjectRow = Awaited<ReturnType<typeof listSubjects>>[number];

function SubjectFields({ subject }: { subject?: SubjectRow }) {
  return (
    <>
      {subject ? <input type="hidden" name="id" value={subject.id} /> : null}
      <Field label="Kode" htmlFor="code" required>
        <Input
          id="code"
          name="code"
          placeholder="MTK"
          defaultValue={subject?.code}
          required
        />
      </Field>
      <Field label="Nama" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          placeholder="Matematika"
          defaultValue={subject?.name}
          required
        />
      </Field>
    </>
  );
}

export default async function SubjectPage() {
  await requirePagePermission("manage:master_data");
  const subjects = await listSubjects();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mata Pelajaran"
        description="Mapel dipakai pada jadwal dan dipetakan ke guru pengampu."
        actions={
          <ModalForm
            action={saveSubject}
            triggerLabel="Tambah Mapel"
            triggerIcon={<Plus className="h-4 w-4" />}
            title="Tambah Mapel"
            description="Kode mapel harus unik."
            submitLabel="Tambah Mapel"
          >
            <SubjectFields />
          </ModalForm>
        }
      />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Mapel
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
            {subjects.map((subject) => (
              <TableRow key={subject.id}>
                <TableCell className="font-medium text-slate-900">
                  {subject.code}
                </TableCell>
                <TableCell>{subject.name}</TableCell>
                <TableCell>
                  <Badge variant={subject.isActive ? "success" : "neutral"}>
                    {subject.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ModalForm
                      action={saveSubject}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Mapel"
                      description="Perbarui kode atau nama mapel."
                      submitLabel="Simpan Perubahan"
                    >
                      <SubjectFields subject={subject} />
                    </ModalForm>
                    <form action={deleteSubject}>
                      <input type="hidden" name="id" value={subject.id} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        message={`Nonaktifkan mapel ${subject.name}?`}
                      >
                        Nonaktifkan
                      </ConfirmSubmit>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Belum ada mapel.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
