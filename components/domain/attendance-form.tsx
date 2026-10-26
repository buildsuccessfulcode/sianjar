"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, UserCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import type { AttendanceStatus } from "@/db/schema/enums";
import { ATTENDANCE_UI_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  initialActionState,
  type ActionState,
} from "@/lib/validators/common";
import { saveJournalAction } from "@/app/(app)/jurnal/actions";

type UiStatus = "HADIR" | AttendanceStatus;

const statuses: UiStatus[] = [
  "HADIR",
  "SAKIT",
  "IZIN",
  "ALPA",
  "DISPENSASI",
];

const rowAccent: Record<UiStatus, string> = {
  HADIR: "border-l-transparent",
  SAKIT: "border-l-amber-400 bg-amber-50/40",
  IZIN: "border-l-sky-400 bg-sky-50/40",
  ALPA: "border-l-red-400 bg-red-50/40",
  DISPENSASI: "border-l-slate-400 bg-slate-50",
};

export function AttendanceForm({
  scheduleId,
  date,
  material,
  activity,
  notes,
  students,
  initialAttendance,
}: {
  scheduleId: string;
  date: string;
  material?: string;
  activity?: string;
  notes?: string;
  students: { id: string; name: string; nisn: string }[];
  initialAttendance: {
    studentId: string;
    status: AttendanceStatus;
    note: string | null;
  }[];
}) {
  const [state, formAction] = useActionState(
    saveJournalAction,
    initialActionState,
  );
  const { toast } = useToast();
  const shownState = useRef<ActionState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const bypassConfirm = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!state.message || shownState.current === state) return;
    shownState.current = state;
    toast({
      title: "Gagal menyimpan jurnal",
      description: state.message,
      variant: "error",
    });
  }, [state, toast]);

  const [statusMap, setStatusMap] = useState<Record<string, UiStatus>>(() => {
    const map: Record<string, UiStatus> = {};
    for (const student of students) map[student.id] = "HADIR";
    for (const entry of initialAttendance) map[entry.studentId] = entry.status;
    return map;
  });
  const [noteMap, setNoteMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const entry of initialAttendance) {
      if (entry.note) map[entry.studentId] = entry.note;
    }
    return map;
  });

  const counts = statuses.reduce<Record<UiStatus, number>>(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    { HADIR: 0, SAKIT: 0, IZIN: 0, ALPA: 0, DISPENSASI: 0 },
  );
  for (const student of students) {
    counts[statusMap[student.id] ?? "HADIR"] += 1;
  }

  const absent = students.length - counts.HADIR;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-5"
      onSubmit={(event) => {
        if (absent > 0 && !bypassConfirm.current) {
          event.preventDefault();
          setConfirmOpen(true);
        }
      }}
    >
      <input type="hidden" name="scheduleId" value={scheduleId} />
      <input type="hidden" name="date" value={date} />

      <Field label="Materi" htmlFor="material" required>
        <Input
          id="material"
          name="material"
          placeholder="Contoh: Persamaan linear dua variabel"
          defaultValue={material}
          required
        />
      </Field>

      <Field
        label="Aktivitas"
        htmlFor="activity"
        hint="Contoh: ceramah, diskusi kelompok, praktikum."
        required
      >
        <Input
          id="activity"
          name="activity"
          placeholder="Diskusi kelompok"
          defaultValue={activity}
          required
        />
      </Field>

      <Field label="Catatan" htmlFor="notes" hint="Opsional.">
        <Textarea
          id="notes"
          name="notes"
          placeholder="Catatan tambahan untuk pertemuan ini..."
          defaultValue={notes}
        />
      </Field>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              Absensi Siswa ({students.length})
            </h2>
            <p className="text-xs text-slate-500">
              Semua siswa default hadir. Ubah status hanya untuk yang tidak
              hadir.
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              absent > 0
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800",
            )}
          >
            {absent > 0
              ? `${absent} tidak hadir`
              : "Semua hadir"}
          </span>
        </div>

        {absent > 0 ? (
          <p className="text-xs text-slate-600">
            {(["SAKIT", "IZIN", "ALPA", "DISPENSASI"] as AttendanceStatus[])
              .filter((status) => counts[status] > 0)
              .map(
                (status) =>
                  `${counts[status]} ${ATTENDANCE_UI_LABELS[status].toLowerCase()}`,
              )
              .join(" · ")}
          </p>
        ) : null}

        <ul className="divide-y divide-slate-100">
          {students.map((student, index) => {
            const status = statusMap[student.id] ?? "HADIR";
            return (
              <li
                key={student.id}
                className={cn(
                  "border-l-4 px-2 py-3 transition-colors",
                  rowAccent[status],
                )}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      <span className="mr-2 text-xs text-slate-400">
                        {index + 1}.
                      </span>
                      {student.name}
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      {student.nisn}
                    </p>
                  </div>
                  <div className="w-full sm:w-44">
                    <label htmlFor={`status-${student.id}`} className="sr-only">
                      Status {student.name}
                    </label>
                    <Select
                      id={`status-${student.id}`}
                      name={`status_${student.id}`}
                      value={status}
                      onChange={(event) =>
                        setStatusMap((current) => ({
                          ...current,
                          [student.id]: event.target.value as UiStatus,
                        }))
                      }
                      className="h-10"
                    >
                      {statuses.map((option) => (
                        <option key={option} value={option}>
                          {ATTENDANCE_UI_LABELS[option]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                {status !== "HADIR" ? (
                  <div className="mt-2 sm:pl-6">
                    <label
                      htmlFor={`note-${student.id}`}
                      className="sr-only"
                    >
                      Catatan untuk {student.name}
                    </label>
                    <Input
                      id={`note-${student.id}`}
                      name={`note_${student.id}`}
                      value={noteMap[student.id] ?? ""}
                      onChange={(event) =>
                        setNoteMap((current) => ({
                          ...current,
                          [student.id]: event.target.value,
                        }))
                      }
                      placeholder="Catatan opsional (surat izin, keterangan, dll.)"
                      className="h-9"
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {students.length === 0 ? (
          <Alert variant="warning">
            Belum ada siswa aktif di kelas ini. Hubungi Admin untuk mengatur
            enrollment.
          </Alert>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingText="Menyimpan jurnal...">
          Simpan Jurnal
        </SubmitButton>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "ghost" })}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Konfirmasi simpan jurnal"
        description={`Terdapat ${absent} siswa tidak hadir (${counts.SAKIT} sakit, ${counts.IZIN} izin, ${counts.ALPA} alpa, ${counts.DISPENSASI} dispensasi). Simpan jurnal sekarang?`}
        size="sm"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmOpen(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={() => {
              setConfirmOpen(false);
              bypassConfirm.current = true;
              formRef.current?.requestSubmit();
              bypassConfirm.current = false;
            }}
          >
            Ya, simpan
          </Button>
        </div>
      </Modal>
    </form>
  );
}
