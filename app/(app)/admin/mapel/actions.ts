"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createSubject,
  softDeleteSubject,
  updateSubject,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { subjectSchema } from "@/lib/validators/master";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/admin/mapel";

export async function saveSubject(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    await assertPermission("manage:master_data");
    const parsed = subjectSchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali input mapel.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    if (id) await updateSubject(id, parsed.data);
    else await createSubject(parsed.data);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(PATH);
  revalidatePath("/guru-mapel");
  redirect(
    `${PATH}?success=${encodeURIComponent(
      id ? "Mapel berhasil diperbarui." : "Mapel berhasil ditambahkan.",
    )}`,
  );
}

export async function deleteSubject(formData: FormData) {
  try {
    await assertPermission("manage:master_data");
    await softDeleteSubject(String(formData.get("id")));
  } catch (error) {
    redirect(`${PATH}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?success=${encodeURIComponent("Mapel dinonaktifkan.")}`);
}
