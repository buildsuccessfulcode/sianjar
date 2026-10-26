"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createClass,
  softDeleteClass,
  updateClass,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { classSchema } from "@/lib/validators/master";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/admin/kelas";

export async function saveClass(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    await assertPermission("manage:master_data");
    const parsed = classSchema.safeParse({
      academicYearId: formData.get("academicYearId"),
      departmentId: formData.get("departmentId"),
      gradeLevel: formData.get("gradeLevel"),
      section: formData.get("section"),
      homeroomTeacherId: formData.get("homeroomTeacherId"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali input kelas.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    if (id) await updateClass(id, parsed.data);
    else await createClass(parsed.data);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(PATH);
  revalidatePath("/jadwal");
  revalidatePath("/admin/enrollment");
  redirect(
    `${PATH}?success=${encodeURIComponent(
      id ? "Kelas berhasil diperbarui." : "Kelas berhasil ditambahkan.",
    )}`,
  );
}

export async function deleteClass(formData: FormData) {
  try {
    await assertPermission("manage:master_data");
    await softDeleteClass(String(formData.get("id")));
  } catch (error) {
    redirect(`${PATH}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?success=${encodeURIComponent("Kelas dinonaktifkan.")}`);
}
