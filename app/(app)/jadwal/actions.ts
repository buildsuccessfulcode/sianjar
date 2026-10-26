"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  copyScheduleData,
  createSchedule,
  deleteSchedule,
  updateSchedule,
} from "@/data-access/schedules";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { redirectWithFlash } from "@/lib/redirect";
import {
  scheduleCopySchema,
  scheduleSchema,
} from "@/lib/validators/schedule";
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
    redirectWithFlash(
      formData,
      PATH,
      "success",
      id ? "Jadwal berhasil diperbarui." : "Jadwal berhasil ditambahkan.",
    ),
  );
}

export async function copyScheduleDataAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let result: Awaited<ReturnType<typeof copyScheduleData>>;
  try {
    const user = await assertPermission("manage:jadwal");
    const parsed = scheduleCopySchema.safeParse({
      sourceSemesterId: formData.get("sourceSemesterId"),
      targetSemesterId: formData.get("targetSemesterId"),
      copyTimeSlots: formData.get("copyTimeSlots"),
      copySchedules: formData.get("copySchedules"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message:
          parsed.error.issues[0]?.message ??
          "Periksa kembali pilihan penyalinan jadwal.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    result = await copyScheduleData(parsed.data, user.id);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidate();
  revalidatePath("/jadwal/jam");

  const notes = result.notes.slice(0, 3).join(" ");
  if (result.timeSlotsCopied === 0 && result.schedulesCopied === 0) {
    return {
      status: "error",
      message: `Tidak ada data yang disalin.${notes ? ` ${notes}` : ""}`,
    };
  }

  const parts = [
    result.timeSlotsCopied > 0
      ? `${result.timeSlotsCopied} susunan jam disalin`
      : undefined,
    result.schedulesCopied > 0
      ? `${result.schedulesCopied} jadwal disalin`
      : undefined,
    result.schedulesSkipped > 0
      ? `${result.schedulesSkipped} jadwal dilewati`
      : undefined,
  ].filter((part): part is string => Boolean(part));

  return {
    status: "success",
    message: `${parts.join(", ")}.${notes ? ` ${notes}` : ""}`,
  };
}

export async function removeSchedule(formData: FormData) {
  try {
    const user = await assertPermission("manage:jadwal");
    await deleteSchedule(String(formData.get("id")), user.id);
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidate();
  redirect(redirectWithFlash(formData, PATH, "success", "Jadwal dihapus."));
}
