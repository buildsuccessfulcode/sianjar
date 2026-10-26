"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createStudent,
  importStudents,
  softDeleteStudent,
  updateStudent,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import {
  MAX_STUDENT_IMPORT_FILE_SIZE,
  parseStudentWorkbook,
} from "@/lib/excel/students";
import { redirectWithFlash } from "@/lib/redirect";
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
    redirectWithFlash(
      formData,
      PATH,
      "success",
      id ? "Siswa berhasil diperbarui." : "Siswa berhasil ditambahkan.",
    ),
  );
}

export async function importStudentsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertPermission("manage:master_data");
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return { status: "error", message: "Pilih file Excel terlebih dahulu." };
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return {
        status: "error",
        message: "Gunakan file .xlsx sesuai template import siswa.",
      };
    }
    if (file.size > MAX_STUDENT_IMPORT_FILE_SIZE) {
      return { status: "error", message: "Ukuran file maksimal 5 MB." };
    }

    const parsed = await parseStudentWorkbook(
      Buffer.from(await file.arrayBuffer()),
    );

    if (parsed.errors.length > 0) {
      const details = parsed.errors
        .slice(0, 5)
        .map((row) => `baris ${row.rowNumber}: ${row.message}`)
        .join("; ");
      const rest =
        parsed.errors.length > 5
          ? `; +${parsed.errors.length - 5} baris lainnya`
          : "";
      return {
        status: "error",
        message: `Import dibatalkan, ${parsed.errors.length} baris bermasalah (${details}${rest}).`,
      };
    }

    if (parsed.rows.length === 0) {
      return {
        status: "error",
        message: "Tidak ada data siswa pada file. Isi sheet Siswa mulai baris 2.",
      };
    }

    const result = await importStudents(parsed.rows, user.id);
    revalidatePath(PATH);

    if (result.created === 0) {
      return {
        status: "error",
        message: "Tidak ada siswa baru. Semua NISN pada file sudah terdaftar.",
      };
    }

    const skippedNames = result.skipped
      .slice(0, 3)
      .map((row) => row.name)
      .join(", ");
    const skippedRest =
      result.skipped.length > 3
        ? `, +${result.skipped.length - 3} lainnya`
        : "";

    return {
      status: "success",
      message:
        result.skipped.length > 0
          ? `${result.created} siswa diimpor. ${result.skipped.length} dilewati karena NISN sudah terdaftar${skippedNames ? `: ${skippedNames}${skippedRest}` : ""}.`
          : `${result.created} siswa berhasil diimpor.`,
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function deleteStudent(formData: FormData) {
  try {
    await assertPermission("manage:master_data");
    await softDeleteStudent(String(formData.get("id")));
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidatePath(PATH);
  redirect(redirectWithFlash(formData, PATH, "success", "Siswa dinonaktifkan."));
}
