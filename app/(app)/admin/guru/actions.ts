"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createTeacher,
  DEFAULT_RESET_PASSWORD,
  resetTeacherPassword as resetTeacherPasswordRecord,
  setTeacherActive,
  updateTeacher,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { redirectWithFlash } from "@/lib/redirect";
import {
  teacherCreateSchema,
  teacherUpdateSchema,
} from "@/lib/validators/master";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/admin/guru";

function subjectIds(formData: FormData) {
  return formData.getAll("subjectIds").map(String).filter(Boolean);
}

export async function saveTeacher(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    await assertPermission("manage:master_data");
    const base = {
      name: formData.get("name"),
      email: formData.get("email"),
      nip: formData.get("nip"),
      expertiseNote: formData.get("expertiseNote"),
    };

    if (id) {
      const parsed = teacherUpdateSchema.safeParse({
        ...base,
        isActive: formData.get("isActive"),
      });
      if (!parsed.success) {
        return {
          status: "error",
          message: "Periksa kembali input guru.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        };
      }
      await updateTeacher(id, parsed.data, subjectIds(formData));
    } else {
      const parsed = teacherCreateSchema.safeParse({
        ...base,
        password: formData.get("password"),
      });
      if (!parsed.success) {
        return {
          status: "error",
          message: "Periksa kembali input guru.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        };
      }
      await createTeacher(parsed.data, subjectIds(formData));
    }
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(PATH);
  revalidatePath("/guru-mapel");
  revalidatePath("/jadwal");
  redirect(
    redirectWithFlash(
      formData,
      PATH,
      "success",
      id ? "Guru berhasil diperbarui." : "Guru berhasil ditambahkan.",
    ),
  );
}

export async function resetTeacherPassword(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  try {
    const actor = await assertPermission("manage:master_data");
    await resetTeacherPasswordRecord(id, actor.id);
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidatePath(PATH);
  redirect(
    redirectWithFlash(
      formData,
      PATH,
      "success",
      `Password guru berhasil direset ke ${DEFAULT_RESET_PASSWORD}.`,
    ),
  );
}

export async function setTeacherStatus(formData: FormData) {
  const isActive = formData.get("isActive") === "true";
  try {
    await assertPermission("manage:master_data");
    await setTeacherActive(String(formData.get("id")), isActive);
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidatePath(PATH);
  revalidatePath("/guru-mapel");
  revalidatePath("/jadwal");
  redirect(
    redirectWithFlash(
      formData,
      PATH,
      "success",
      `Guru ${isActive ? "diaktifkan" : "dinonaktifkan"}.`,
    ),
  );
}
