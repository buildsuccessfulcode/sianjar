"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createDepartment,
  softDeleteDepartment,
  updateDepartment,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { redirectWithFlash } from "@/lib/redirect";
import { departmentSchema } from "@/lib/validators/master";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/admin/jurusan";

export async function saveDepartment(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    await assertPermission("manage:master_data");
    const parsed = departmentSchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali input jurusan.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    if (id) await updateDepartment(id, parsed.data);
    else await createDepartment(parsed.data);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(PATH);
  redirect(
    redirectWithFlash(
      formData,
      PATH,
      "success",
      id ? "Jurusan berhasil diperbarui." : "Jurusan berhasil ditambahkan.",
    ),
  );
}

export async function deleteDepartment(formData: FormData) {
  try {
    await assertPermission("manage:master_data");
    await softDeleteDepartment(String(formData.get("id")));
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidatePath(PATH);
  redirect(
    redirectWithFlash(formData, PATH, "success", "Jurusan dinonaktifkan."),
  );
}
