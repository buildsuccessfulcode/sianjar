"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createStudent,
  importStudents,
  listClasses,
  setStudentActive,
  setStudentsActive,
  updateStudent,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage, ValidationError } from "@/lib/errors";
import {
  MAX_STUDENT_IMPORT_FILE_SIZE,
  normalizeClassLabel,
  parseStudentWorkbook,
} from "@/lib/excel/students";
import { redirectWithFlash } from "@/lib/redirect";
import { classLabel } from "@/lib/utils";
import {
  studentBulkStatusSchema,
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

    const academicYearId = String(formData.get("academicYearId") ?? "").trim();
    const classes = academicYearId ? await listClasses(academicYearId) : [];

    const parsed = await parseStudentWorkbook(
      Buffer.from(await file.arrayBuffer()),
      { classLabels: classes.map((row) => classLabel(row)) },
    );

    if (!academicYearId && parsed.rows.some((row) => row.classLabel)) {
      return {
        status: "error",
        message:
          "Kolom Kelas terisi tetapi tahun ajaran belum dipilih. Pilih tahun ajaran aktif atau kosongkan kolom Kelas.",
      };
    }

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

    const classIdByLabel = new Map(
      classes.map((row) => [normalizeClassLabel(classLabel(row)), row.id]),
    );
    const rows = parsed.rows.map((row) => ({
      ...row,
      classId: row.classLabel
        ? classIdByLabel.get(normalizeClassLabel(row.classLabel))
        : undefined,
    }));

    const result = await importStudents(rows, user.id);
    revalidatePath(PATH);
    revalidatePath("/admin/enrollment");

    if (result.created === 0 && result.enrolled === 0) {
      return {
        status: "error",
        message:
          "Tidak ada data baru. Semua NISN sudah terdaftar dan tidak ada enrollment baru.",
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

    const summary = [
      result.created > 0 ? `${result.created} siswa baru diimpor` : null,
      result.enrolled > 0
        ? `${result.enrolled} enrollment dibuat`
        : null,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      status: "success",
      message:
        result.skipped.length > 0
          ? `${summary}. ${result.skipped.length} NISN sudah terdaftar dilewati pembuatannya${skippedNames ? `: ${skippedNames}${skippedRest}` : ""}.`
          : `${summary}.`,
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function setStudentStatus(formData: FormData) {
  const isActive = formData.get("isActive") === "true";
  try {
    await assertPermission("manage:master_data");
    await setStudentActive(String(formData.get("id")), isActive);
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidatePath(PATH);
  revalidatePath("/admin/enrollment");
  redirect(
    redirectWithFlash(
      formData,
      PATH,
      "success",
      `Siswa ${isActive ? "diaktifkan" : "dinonaktifkan"}.`,
    ),
  );
}

export async function bulkSetStudentStatus(formData: FormData) {
  let updated = 0;
  let isActive = false;
  try {
    const user = await assertPermission("manage:master_data");
    const parsed = studentBulkStatusSchema.safeParse({
      studentIds: formData.getAll("studentIds").map(String),
      isActive: formData.get("isActive"),
    });
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Pilih siswa dan status.",
      );
    }
    const result = await setStudentsActive(parsed.data, user.id);
    updated = result.updated;
    isActive = parsed.data.isActive;
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidatePath(PATH);
  revalidatePath("/admin/enrollment");
  redirect(
    redirectWithFlash(
      formData,
      PATH,
      "success",
      `${updated} siswa ${isActive ? "diaktifkan" : "dinonaktifkan"}.`,
    ),
  );
}
