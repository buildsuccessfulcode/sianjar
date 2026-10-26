"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addTeacherSubject,
  addTeacherSubjectsBulk,
  removeTeacherSubject,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { redirectWithFlash } from "@/lib/redirect";
import {
  teacherSubjectBulkSchema,
  teacherSubjectSchema,
} from "@/lib/validators/master";
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
  redirect(
    redirectWithFlash(formData, PATH, "success", "Mapping berhasil ditambahkan."),
  );
}

export async function addMappingsBulk(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let result: Awaited<ReturnType<typeof addTeacherSubjectsBulk>>;
  try {
    await assertPermission("manage:mapping_guru_mapel");
    const parsed = teacherSubjectBulkSchema.safeParse({
      teacherId: formData.get("teacherId"),
      subjectIds: formData.getAll("subjectIds").map(String),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Pilih guru dan mapel.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    result = await addTeacherSubjectsBulk(parsed.data);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(PATH);
  revalidatePath("/jadwal");

  const parts = [
    `${result.created} mapping ditambahkan`,
    result.skipped > 0 ? `${result.skipped} sudah ada` : undefined,
  ].filter(Boolean);

  return { status: "success", message: `${parts.join(", ")}.` };
}

export async function removeMapping(formData: FormData) {
  try {
    await assertPermission("manage:mapping_guru_mapel");
    await removeTeacherSubject(
      String(formData.get("teacherId")),
      String(formData.get("subjectId")),
    );
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidatePath(PATH);
  redirect(redirectWithFlash(formData, PATH, "success", "Mapping dihapus."));
}
