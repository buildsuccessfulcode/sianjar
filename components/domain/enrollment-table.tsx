"use client";

import { useState, type ReactNode } from "react";
import { ArrowRightLeft, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Field, Select } from "@/components/ui/form";
import { ModalForm } from "@/components/ui/modal-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { ENROLLMENT_VARIANTS } from "@/lib/status";
import type { ActionState } from "@/lib/validators/common";
import { cn } from "@/lib/utils";

type EnrollmentRow = {
  id: string;
  studentName: string;
  nisn: string;
  classId: string;
  className: string;
  status: EnrollmentStatus;
};

type ClassOption = { id: string; label: string };
type StatusOption = { value: string; label: string };

type ActionStateFn = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;
type FormActionFn = (formData: FormData) => void | Promise<void>;

export function EnrollmentTable({
  rows,
  classes,
  yearId,
  statusOptions,
  updateAction,
  moveAction,
  statusAction,
  removeAction,
  sortControls,
  returnTo,
}: {
  rows: EnrollmentRow[];
  classes: ClassOption[];
  yearId: string;
  statusOptions: StatusOption[];
  updateAction: ActionStateFn;
  moveAction: FormActionFn;
  statusAction: FormActionFn;
  removeAction: FormActionFn;
  sortControls?: ReactNode;
  returnTo: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetClassId, setTargetClassId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("ACTIVE");

  const allSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.id));
  const targetLabel =
    classes.find((row) => row.id === targetClassId)?.label ?? "kelas tujuan";
  const statusLabel =
    statusOptions.find((option) => option.value === bulkStatus)?.label ??
    bulkStatus;

  const toggleRow = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(rows.map((row) => row.id)),
    );
  };

  return (
    <div className="space-y-3">
      {sortControls ? <div className="px-1">{sortControls}</div> : null}
      <form
        action={moveAction}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="year" value={yearId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="enrollmentIds" value={id} />
        ))}
        <div className="w-full sm:max-w-xs">
          <Field label="Pindah kelas terpilih" htmlFor="move-target-class">
            <Select
              id="move-target-class"
              name="targetClassId"
              value={targetClassId}
              onChange={(event) => setTargetClassId(event.target.value)}
              required
            >
              <option value="" disabled>
                Pilih kelas tujuan
              </option>
              {classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex items-center gap-3 pb-0.5">
          <ConfirmSubmit
            size="md"
            variant="secondary"
            message={`Pindahkan ${selected.size} enrollment ke ${targetLabel}?`}
            confirmLabel="Ya, pindahkan"
            confirmVariant="primary"
            disabled={selected.size === 0 || !targetClassId}
          >
            <ArrowRightLeft className="h-4 w-4" />
            Pindahkan ({selected.size})
          </ConfirmSubmit>
          <span className="text-sm text-slate-500">
            {selected.size > 0
              ? `${selected.size} siswa dipilih`
              : "Centang siswa untuk memindahkan kelas"}
          </span>
        </div>
      </form>

      <form
        action={statusAction}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="year" value={yearId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="enrollmentIds" value={id} />
        ))}
        <div className="w-full sm:max-w-xs">
          <Field label="Ubah status terpilih" htmlFor="bulk-status">
            <Select
              id="bulk-status"
              name="status"
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value)}
              required
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex items-center gap-3 pb-0.5">
          <ConfirmSubmit
            size="md"
            variant="secondary"
            message={`Ubah status ${selected.size} enrollment menjadi ${statusLabel}?`}
            confirmLabel="Ya, ubah status"
            confirmVariant="primary"
            disabled={selected.size === 0}
          >
            Ubah Status ({selected.size})
          </ConfirmSubmit>
          <span className="text-sm text-slate-500">
            {selected.size > 0
              ? "Hanya enrollment yang dicentang yang berubah"
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
                aria-label="Pilih semua enrollment"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={allSelected}
                onChange={toggleAll}
                disabled={rows.length === 0}
              />
            </TableHead>
            <TableHead>Siswa</TableHead>
            <TableHead>NISN</TableHead>
            <TableHead>Kelas</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                selected.has(row.id) && "bg-indigo-50/60",
              )}
            >
              <TableCell>
                <input
                  type="checkbox"
                  aria-label={`Pilih ${row.studentName}`}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selected.has(row.id)}
                  onChange={() => toggleRow(row.id)}
                />
              </TableCell>
              <TableCell className="font-medium text-slate-900">
                {row.studentName}
              </TableCell>
              <TableCell className="font-mono text-xs">{row.nisn}</TableCell>
              <TableCell>{row.className}</TableCell>
              <TableCell>
                <Badge variant={ENROLLMENT_VARIANTS[row.status]}>
                  {statusOptions.find((option) => option.value === row.status)
                    ?.label ?? row.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-1">
                  <ModalForm
                    action={updateAction}
                    returnTo={returnTo}
                    triggerLabel="Ubah"
                    triggerIcon={<Pencil className="h-4 w-4" />}
                    triggerVariant="ghost"
                    triggerSize="sm"
                    title={`Ubah Enrollment ${row.studentName}`}
                    description="Pilih kelas dan status enrollment pada tahun ajaran ini."
                    submitLabel="Simpan Perubahan"
                    pendingText="Menyimpan..."
                  >
                    <input type="hidden" name="year" value={yearId} />
                    <input type="hidden" name="id" value={row.id} />
                    <Field
                      label="Kelas"
                      htmlFor={`edit-class-${row.id}`}
                      required
                    >
                      <Select
                        id={`edit-class-${row.id}`}
                        name="classId"
                        defaultValue={row.classId}
                        required
                      >
                        {classes.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="Status"
                      htmlFor={`edit-status-${row.id}`}
                      required
                    >
                      <Select
                        id={`edit-status-${row.id}`}
                        name="status"
                        defaultValue={row.status}
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </ModalForm>

                  <form action={removeAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="year" value={yearId} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <ConfirmSubmit
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      message={`Hapus enrollment ${row.studentName}? Tindakan ini tidak menghapus siswa.`}
                    >
                      Hapus
                    </ConfirmSubmit>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-slate-500">
                Belum ada enrollment pada tahun ajaran ini.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
