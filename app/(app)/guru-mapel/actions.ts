"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addTeacherSubject,
  removeTeacherSubject,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { teacherSubjectSchema } from "@/lib/validators/master";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/guru-mapel";

export async function addMapping(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPermission("manage:mapping_guru_mapel");
    const parsed = teacherSubjectSchema.safeParse({
      teacherId: formData.get("teacherId"),
      subjectId: formData.get("subjectId"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Pilih guru dan mapel.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    await addTeacherSubject(parsed.data.teacherId, parsed.data.subjectId);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(PATH);
  revalidatePath("/jadwal");
  redirect(`${PATH}?success=${encodeURIComponent("Mapping berhasil ditambahkan.")}`);
}

export async function removeMapping(formData: FormData) {
  try {
    await assertPermission("manage:mapping_guru_mapel");
    await removeTeacherSubject(
      String(formData.get("teacherId")),
      String(formData.get("subjectId")),
    );
  } catch (error) {
    redirect(`${PATH}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?success=${encodeURIComponent("Mapping dihapus.")}`);
}
