"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { saveJournal } from "@/data-access/journals";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import {
  attendanceEntrySchema,
  journalDetailSchema,
  type AttendanceEntryInput,
} from "@/lib/validators/schedule";
import type { ActionState } from "@/lib/validators/common";

export async function saveJournalAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let journalId: string;

  try {
    const user = await assertPermission("create:jurnal_own");

    const scheduleId = String(formData.get("scheduleId") ?? "");
    const parsed = journalDetailSchema.safeParse({
      date: formData.get("date"),
      material: formData.get("material"),
      activity: formData.get("activity"),
      notes: formData.get("notes"),
    });

    if (!scheduleId) {
      return { status: "error", message: "Jadwal tidak valid." };
    }

    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali isi jurnal.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const attendance: AttendanceEntryInput[] = [];
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("status_")) continue;
      const studentId = key.slice("status_".length);
      const entry = attendanceEntrySchema.safeParse({
        studentId,
        status: value,
        note: formData.get(`note_${studentId}`),
      });
      if (!entry.success) {
        return {
          status: "error",
          message: "Status absensi tidak valid. Muat ulang halaman.",
        };
      }
      attendance.push(entry.data);
    }

    const journal = await saveJournal(
      {
        scheduleId,
        date: parsed.data.date,
        material: parsed.data.material,
        activity: parsed.data.activity,
        notes: parsed.data.notes,
        attendance,
      },
      user,
    );

    journalId = journal.id;
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath("/dashboard");
  revalidatePath("/jurnal");
  redirect(
    `/jurnal/${journalId}?success=${encodeURIComponent("Jurnal tersimpan.")}`,
  );
}
