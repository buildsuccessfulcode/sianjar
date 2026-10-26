"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createTeacher,
  softDeleteTeacher,
  updateTeacher,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
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
    `${PATH}?success=${encodeURIComponent(
      id ? "Guru berhasil diperbarui." : "Guru berhasil ditambahkan.",
    )}`,
  );
}

export async function deleteTeacher(formData: FormData) {
  try {
    await assertPermission("manage:master_data");
    await softDeleteTeacher(String(formData.get("id")));
  } catch (error) {
    redirect(`${PATH}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?success=${encodeURIComponent("Guru dinonaktifkan.")}`);
}
