import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  Clock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/form";
import { ModalForm } from "@/components/ui/modal-form";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveSemester, listSemesters } from "@/data-access/master";
import { listTimeSlots } from "@/data-access/time-slots";
import { TIME_SLOT_KIND_LABELS } from "@/db/schema/enums";
import { requirePagePermission } from "@/lib/dal";
import { cn } from "@/lib/utils";
import {
  removeTimeSlot,
  saveTimeSlot,
  seedDefaultTimeSlots,
} from "./actions";

export const metadata: Metadata = { title: "Jam Pelajaran" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  semesterId?: string;
}>;

type SlotRow = Awaited<ReturnType<typeof listTimeSlots>>[number];

const kindVariant = {
  LESSON: "primary",
  BREAK: "warning",
  PRAYER: "info",
} as const;

function shortTime(value: string) {
  return value.slice(0, 5);
}

function TimeSlotFields({
  slot,
  semesterId,
}: {
  slot?: SlotRow;
  semesterId: string;
}) {
  return (
    <>
      {slot ? <input type="hidden" name="id" value={slot.id} /> : null}
      <input type="hidden" name="semesterId" value={semesterId} />
      <Field label="Nama" htmlFor="label" name="label" required>
        <Input
          id="label"
          name="label"
          placeholder="Jam 1 / Istirahat / Sholat Dzuhur"
          defaultValue={slot?.label ?? ""}
          required
        />
      </Field>
      <Field label="Jenis" htmlFor="kind" name="kind" required>
        <Select
          id="kind"
          name="kind"
          defaultValue={slot?.kind ?? "LESSON"}
          required
        >
          <option value="LESSON">Jam pelajaran</option>
          <option value="BREAK">Istirahat</option>
          <option value="PRAYER">Sholat / ibadah</option>
        </Select>
      </Field>
      <Field
        label="Nomor jam pelajaran"
        htmlFor="periodNumber"
        name="periodNumber"
        hint="Wajib untuk jam pelajaran. Kosongkan untuk istirahat/sholat."
      >
        <Input
          id="periodNumber"
          name="periodNumber"
          type="number"
          min={1}
          max={20}
          defaultValue={slot?.periodNumber ?? ""}
          placeholder="1"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mulai" htmlFor="startTime" name="startTime" required>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={slot ? shortTime(slot.startTime) : ""}
            required
          />
        </Field>
        <Field label="Selesai" htmlFor="endTime" name="endTime" required>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={slot ? shortTime(slot.endTime) : ""}
            required
          />
        </Field>
      </div>
    </>
  );
}

export default async function TimeSlotPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("manage:jadwal");
  const params = await searchParams;

  const [semesters, activeSemester] = await Promise.all([
    listSemesters(),
    getActiveSemester(),
  ]);

  const selectedSemester =
    semesters.find((row) => row.id === params.semesterId) ??
    semesters.find((row) => row.id === activeSemester?.id) ??
    semesters[0] ??
    null;

  const slots = selectedSemester
    ? await listTimeSlots(selectedSemester.id)
    : [];

  const backHref = selectedSemester
    ? `/jadwal?semesterId=${selectedSemester.id}`
    : "/jadwal";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jam Pelajaran & Istirahat"
        description="Atur jam pelajaran, istirahat, dan waktu sholat. Susunan ini dipakai untuk semua hari pada semester terpilih."
        actions={
          <>
            {selectedSemester ? (
              <ModalForm
                action={saveTimeSlot}
                triggerLabel="Tambah Jam"
                triggerIcon={<Plus className="h-4 w-4" />}
                title="Tambah Jam"
                description="Pilih jenis istirahat atau sholat untuk waktu non-pelajaran."
                submitLabel="Tambah Jam"
              >
                <TimeSlotFields semesterId={selectedSemester.id} />
              </ModalForm>
            ) : null}
            <Link
              href={backHref}
              className={buttonVariants({ variant: "secondary" })}
            >
              <CalendarClock className="h-4 w-4" />
              Kembali ke Jadwal
            </Link>
          </>
        }
      />

      {!selectedSemester ? (
        <Alert variant="warning">
          Belum ada semester. Buat semester terlebih dahulu di menu Tahun
          Ajaran.
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Semester</CardTitle>
          <CardDescription>
            Setiap semester memiliki susunan jamnya sendiri.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Semester" htmlFor="filterSemesterId" className="sm:max-w-sm">
              <Select
                id="filterSemesterId"
                name="semesterId"
                defaultValue={selectedSemester?.id ?? ""}
              >
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name} — {semester.academicYearName}
                  </option>
                ))}
              </Select>
            </Field>
            <button
              type="submit"
              className="h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Tampilkan
            </button>
          </form>
        </CardContent>
      </Card>

      {selectedSemester ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Susunan Jam {selectedSemester.name}{" "}
              {selectedSemester.academicYearName}
            </h2>
            <Badge variant="neutral">{slots.length} entri</Badge>
          </div>

          {slots.length === 0 ? (
            <EmptyState
              title="Belum ada susunan jam"
              description="Buat susunan jam sendiri atau gunakan contoh yang sudah memuat istirahat dan sholat dzuhur."
              icon={<Clock className="h-8 w-8" />}
              action={
                <form action={seedDefaultTimeSlots}>
                  <input
                    type="hidden"
                    name="semesterId"
                    value={selectedSemester.id}
                  />
                  <ConfirmSubmit
                    confirmVariant="primary"
                    confirmLabel="Ya, gunakan"
                    pendingText="Membuat..."
                    title="Gunakan contoh jam"
                    message="Buat susunan contoh berisi 8 jam pelajaran, dua istirahat, dan sholat dzuhur?"
                    className={cn(buttonVariants({ variant: "primary" }))}
                  >
                    <Sparkles className="h-4 w-4" />
                    Gunakan Contoh Jam
                  </ConfirmSubmit>
                </form>
              }
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-slate-100">
                  {slots.map((slot) => (
                    <li
                      key={slot.id}
                      className={cn(
                        "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
                        slot.kind === "BREAK" && "bg-amber-50/40",
                        slot.kind === "PRAYER" && "bg-sky-50/50",
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex w-24 shrink-0 flex-col rounded-lg bg-white px-2 py-1.5 text-center ring-1 ring-slate-200">
                          <span className="text-sm font-semibold text-slate-800">
                            {shortTime(slot.startTime)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {shortTime(slot.endTime)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-900">
                              {slot.label}
                            </p>
                            <Badge variant={kindVariant[slot.kind]}>
                              {TIME_SLOT_KIND_LABELS[slot.kind]}
                            </Badge>
                            {slot.periodNumber ? (
                              <span className="text-xs text-slate-500">
                                Jam ke-{slot.periodNumber}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                        <ModalForm
                          action={saveTimeSlot}
                          triggerLabel="Ubah"
                          triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                          triggerVariant="ghost"
                          triggerSize="sm"
                          title="Ubah Jam"
                          description="Perbarui nama, jenis, nomor, atau waktu."
                          submitLabel="Simpan Perubahan"
                        >
                          <TimeSlotFields
                            slot={slot}
                            semesterId={selectedSemester.id}
                          />
                        </ModalForm>
                        <form action={removeTimeSlot}>
                          <input
                            type="hidden"
                            name="semesterId"
                            value={selectedSemester.id}
                          />
                          <input type="hidden" name="id" value={slot.id} />
                          <ConfirmSubmit
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            message={`Hapus "${slot.label}" dari susunan jam?`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
