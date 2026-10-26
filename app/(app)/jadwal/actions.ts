"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createSchedule,
  deleteSchedule,
  updateSchedule,
} from "@/data-access/schedules";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { scheduleSchema } from "@/lib/validators/schedule";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/jadwal";

function revalidate() {
  revalidatePath(PATH);
  revalidatePath("/dashboard");
}

export async function saveSchedule(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    const user = await assertPermission("manage:jadwal");
    const parsed = scheduleSchema.safeParse({
      semesterId: formData.get("semesterId"),
      teacherId: formData.get("teacherId"),
      subjectId: formData.get("subjectId"),
      classId: formData.get("classId"),
      dayOfWeek: formData.get("dayOfWeek"),
      periodStart: formData.get("periodStart"),
      periodEnd: formData.get("periodEnd"),
      room: formData.get("room"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali input jadwal.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    if (id) await updateSchedule(id, parsed.data, user.id);
    else await createSchedule(parsed.data, user.id);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidate();
  redirect(
    `${PATH}?success=${encodeURIComponent(
      id ? "Jadwal berhasil diperbarui." : "Jadwal berhasil ditambahkan.",
    )}`,
  );
}

export async function removeSchedule(formData: FormData) {
  try {
    const user = await assertPermission("manage:jadwal");
    await deleteSchedule(String(formData.get("id")), user.id);
  } catch (error) {
    redirect(`${PATH}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidate();
  redirect(`${PATH}?success=${encodeURIComponent("Jadwal dihapus.")}`);
}
