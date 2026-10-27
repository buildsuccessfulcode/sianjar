"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { ModalForm } from "@/components/ui/modal-form";
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
  ENROLLMENT_STATUS_LABELS,
  type EnrollmentStatus,
} from "@/db/schema/enums";
import type { ActionState } from "@/lib/validators/common";
import type { SearchParamsRecord, SortDirection } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export type StudentTableRow = {
  id: string;
  nisn: string;
  name: string;
  gender: "L" | "P";
  birthDate: string | null;
  isActive: boolean;
  className: string | null;
  enrollmentStatus: string | null;
};

type ActionStateFn = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;
type FormActionFn = (formData: FormData) => void | Promise<void>;

export function StudentFields({ student }: { student?: StudentTableRow }) {
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

export function StudentTable({
  rows,
  returnTo,
  basePath,
  searchParams,
  sort,
  dir,
  saveAction,
  statusAction,
  bulkAction,
}: {
  rows: StudentTableRow[];
  returnTo: string;
  basePath: string;
  searchParams: SearchParamsRecord;
  sort: string;
  dir: SortDirection;
  saveAction: ActionStateFn;
  statusAction: FormActionFn;
  bulkAction: FormActionFn;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("inactive");

  const allSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.id));
  const statusLabel = bulkStatus === "active" ? "Aktif" : "Nonaktif";

  const toggleRow = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
  };

  return (
    <div className="space-y-3">
      <form
        action={bulkAction}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="returnTo" value={returnTo} />
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="studentIds" value={id} />
        ))}
        <div className="w-full sm:max-w-xs">
          <Field label="Ubah status terpilih" htmlFor="bulk-status">
            <Select
              id="bulk-status"
              name="isActive"
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value)}
              required
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </Field>
        </div>
        <div className="flex items-center gap-3 pb-0.5">
          <ConfirmSubmit
            size="md"
            variant="secondary"
            message={`Ubah status ${selected.size} siswa menjadi ${statusLabel}?`}
            confirmLabel="Ya, ubah status"
            confirmVariant="primary"
            disabled={selected.size === 0}
          >
            Ubah Status ({selected.size})
          </ConfirmSubmit>
          <span className="text-sm text-slate-500">
            {selected.size > 0
              ? "Hanya siswa yang dicentang yang berubah"
              : "Centang siswa untuk mengubah status massal"}
          </span>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label="Pilih semua siswa"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={allSelected}
                onChange={toggleAll}
                disabled={rows.length === 0}
              />
            </TableHead>
            <SortableHead
              label="NISN"
              column="nisn"
              currentSort={sort}
              currentDir={dir}
              basePath={basePath}
              searchParams={searchParams}
            />
            <SortableHead
              label="Nama"
              column="name"
              currentSort={sort}
              currentDir={dir}
              basePath={basePath}
              searchParams={searchParams}
            />
            <SortableHead
              label="Kelas"
              column="class"
              currentSort={sort}
              currentDir={dir}
              basePath={basePath}
              searchParams={searchParams}
            />
            <SortableHead
              label="L/P"
              column="gender"
              currentSort={sort}
              currentDir={dir}
              basePath={basePath}
              searchParams={searchParams}
            />
            <SortableHead
              label="Status Siswa"
              column="isActive"
              currentSort={sort}
              currentDir={dir}
              basePath={basePath}
              searchParams={searchParams}
            />
            <TableHead>Status Enrollment</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((student) => (
            <TableRow
              key={student.id}
              className={cn(selected.has(student.id) && "bg-indigo-50/60")}
            >
              <TableCell>
                <input
                  type="checkbox"
                  aria-label={`Pilih ${student.name}`}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selected.has(student.id)}
                  onChange={() => toggleRow(student.id)}
                />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {student.nisn}
              </TableCell>
              <TableCell className="font-medium text-slate-900">
                {student.name}
              </TableCell>
              <TableCell>{student.className ?? "—"}</TableCell>
              <TableCell>{student.gender}</TableCell>
              <TableCell>
                <Badge variant={student.isActive ? "success" : "neutral"}>
                  {student.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </TableCell>
              <TableCell>
                {student.enrollmentStatus ? (
                  <Badge variant="primary">
                    {
                      ENROLLMENT_STATUS_LABELS[
                        student.enrollmentStatus as EnrollmentStatus
                      ]
                    }
                  </Badge>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <ModalForm
                    action={saveAction}
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
                  <form action={statusAction}>
                    <input type="hidden" name="id" value={student.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={student.isActive ? "false" : "true"}
                    />
                    <ConfirmSubmit
                      variant="ghost"
                      size="sm"
                      className={
                        student.isActive
                          ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                          : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                      }
                      message={
                        student.isActive
                          ? `Nonaktifkan siswa ${student.name}? Riwayat absensi tetap tersimpan.`
                          : `Aktifkan kembali siswa ${student.name}?`
                      }
                    >
                      {student.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </ConfirmSubmit>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-slate-500">
                Tidak ada siswa pada filter ini.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
