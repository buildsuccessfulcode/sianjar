"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  activateAcademicYear,
  activateSemester,
  createAcademicYear,
  createSemester,
  softDeleteAcademicYear,
  updateAcademicYear,
  updateSemester,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { redirectWithFlash } from "@/lib/redirect";
import {
  academicYearSchema,
  semesterSchema,
} from "@/lib/validators/master";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/admin/tahun-ajaran";

function revalidate() {
  revalidatePath(PATH);
  revalidatePath("/dashboard");
  revalidatePath("/jadwal");
}

export async function saveAcademicYear(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    await assertPermission("manage:master_data");
    const parsed = academicYearSchema.safeParse({
      name: formData.get("name"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali input tahun ajaran.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    if (id) await updateAcademicYear(id, parsed.data);
    else await createAcademicYear(parsed.data);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidate();
  redirect(
    redirectWithFlash(
      formData,
      PATH,
      "success",
      id
        ? "Tahun ajaran berhasil diperbarui."
        : "Tahun ajaran berhasil ditambahkan.",
    ),
  );
}

export async function saveSemester(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    await assertPermission("manage:master_data");
    const parsed = semesterSchema.safeParse({
      academicYearId: formData.get("academicYearId"),
      name: formData.get("name"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali input semester.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    if (id) await updateSemester(id, parsed.data);
    else await createSemester(parsed.data);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidate();
  redirect(
    redirectWithFlash(
      formData,
      PATH,
      "success",
      id ? "Semester berhasil diperbarui." : "Semester berhasil ditambahkan.",
    ),
  );
}

export async function activateYear(formData: FormData) {
  try {
    const user = await assertPermission("manage:master_data");
    await activateAcademicYear(String(formData.get("id")), user.id);
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidate();
  redirect(
    redirectWithFlash(formData, PATH, "success", "Tahun ajaran diaktifkan."),
  );
}

export async function activateSemesterAction(formData: FormData) {
  try {
    const user = await assertPermission("manage:master_data");
    await activateSemester(String(formData.get("id")), user.id);
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidate();
  redirect(redirectWithFlash(formData, PATH, "success", "Semester diaktifkan."));
}

export async function deleteYear(formData: FormData) {
  try {
    await assertPermission("manage:master_data");
    await softDeleteAcademicYear(String(formData.get("id")));
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidate();
  redirect(redirectWithFlash(formData, PATH, "success", "Tahun ajaran dihapus."));
}
