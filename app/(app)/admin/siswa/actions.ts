"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createStudent,
  softDeleteStudent,
  updateStudent,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import {
  studentCreateSchema,
  studentUpdateSchema,
} from "@/lib/validators/master";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/admin/siswa";

export async function saveStudent(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    await assertPermission("manage:master_data");
    const base = {
      nisn: formData.get("nisn"),
      name: formData.get("name"),
      gender: formData.get("gender"),
      birthDate: formData.get("birthDate"),
    };

    if (id) {
      const parsed = studentUpdateSchema.safeParse({
        ...base,
        isActive: formData.get("isActive"),
      });
      if (!parsed.success) {
        return {
          status: "error",
          message: "Periksa kembali input siswa.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        };
      }
      await updateStudent(id, parsed.data);
    } else {
      const parsed = studentCreateSchema.safeParse(base);
      if (!parsed.success) {
        return {
          status: "error",
          message: "Periksa kembali input siswa.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        };
      }
      await createStudent(parsed.data);
    }
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(PATH);
  revalidatePath("/admin/enrollment");
  redirect(
    `${PATH}?success=${encodeURIComponent(
      id ? "Siswa berhasil diperbarui." : "Siswa berhasil ditambahkan.",
    )}`,
  );
}

export async function deleteStudent(formData: FormData) {
  try {
    await assertPermission("manage:master_data");
    await softDeleteStudent(String(formData.get("id")));
  } catch (error) {
    redirect(`${PATH}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?success=${encodeURIComponent("Siswa dinonaktifkan.")}`);
}
