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
import { resolveReturnTo } from "@/lib/redirect";
import { timeSlotSchema } from "@/lib/validators/schedule";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/jadwal/jam";

function revalidate() {
  revalidatePath(PATH);
  revalidatePath("/jadwal");
}

function target(
  formData: FormData,
  semesterId: string,
  error?: string,
  success?: string,
) {
  const url = new URL(resolveReturnTo(formData, PATH), "http://localhost");
  if (semesterId) url.searchParams.set("semesterId", semesterId);
  url.searchParams.delete("error");
  url.searchParams.delete("success");
  if (error) url.searchParams.set("error", error);
  if (success) url.searchParams.set("success", success);
  return `${url.pathname}${url.search}`;
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
      formData,
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
    redirect(target(formData, semesterId, errorMessage(error)));
  }
  revalidate();
  redirect(target(formData, semesterId, undefined, "Jam dihapus."));
}

export async function seedDefaultTimeSlots(formData: FormData) {
  const semesterId = String(formData.get("semesterId") ?? "");
  try {
    const user = await assertPermission("manage:jadwal");
    await createDefaultTimeSlots(semesterId, user.id);
  } catch (error) {
    redirect(target(formData, semesterId, errorMessage(error)));
  }
  revalidate();
  redirect(
    target(
      formData,
      semesterId,
      undefined,
      "Contoh susunan jam berhasil dibuat.",
    ),
  );
}
