"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createDefaultTimeSlots,
  createTimeSlot,
  deleteTimeSlot,
  updateTimeSlot,
} from "@/data-access/time-slots";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { timeSlotSchema } from "@/lib/validators/schedule";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/jadwal/jam";

function revalidate() {
  revalidatePath(PATH);
  revalidatePath("/jadwal");
}

function target(semesterId: string, error?: string, success?: string) {
  const params = new URLSearchParams();
  if (semesterId) params.set("semesterId", semesterId);
  if (error) params.set("error", error);
  if (success) params.set("success", success);
  const query = params.toString();
  return query ? `${PATH}?${query}` : PATH;
}

export async function saveTimeSlot(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const semesterId = String(formData.get("semesterId") ?? "");
  const id = String(formData.get("id") ?? "");
  try {
    const user = await assertPermission("manage:jadwal");
    const parsed = timeSlotSchema.safeParse({
      semesterId,
      label: formData.get("label"),
      kind: formData.get("kind"),
      periodNumber: formData.get("periodNumber"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali data jam.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    if (id) await updateTimeSlot(id, parsed.data, user.id);
    else await createTimeSlot(parsed.data, user.id);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidate();
  redirect(
    target(
      semesterId,
      undefined,
      id ? "Jam berhasil diperbarui." : "Jam berhasil ditambahkan.",
    ),
  );
}

export async function removeTimeSlot(formData: FormData) {
  const semesterId = String(formData.get("semesterId") ?? "");
  try {
    const user = await assertPermission("manage:jadwal");
    await deleteTimeSlot(String(formData.get("id")), user.id);
  } catch (error) {
    redirect(
      target(semesterId, errorMessage(error)),
    );
  }
  revalidate();
  redirect(target(semesterId, undefined, "Jam dihapus."));
}

export async function seedDefaultTimeSlots(formData: FormData) {
  const semesterId = String(formData.get("semesterId") ?? "");
  try {
    const user = await assertPermission("manage:jadwal");
    await createDefaultTimeSlots(semesterId, user.id);
  } catch (error) {
    redirect(
      target(semesterId, errorMessage(error)),
    );
  }
  revalidate();
  redirect(
    target(semesterId, undefined, "Contoh susunan jam berhasil dibuat."),
  );
}
