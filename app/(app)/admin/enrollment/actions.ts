"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createEnrollment,
  createEnrollmentsBulk,
  deleteEnrollment,
  moveEnrollmentsBulk as moveEnrollmentsBulkData,
  updateEnrollment,
  updateEnrollmentsStatusBulk as updateEnrollmentsStatusBulkData,
} from "@/data-access/master";
import { assertPermission } from "@/lib/dal";
import { errorMessage, ValidationError } from "@/lib/errors";
import { resolveReturnTo } from "@/lib/redirect";
import {
  enrollmentBulkSchema,
  enrollmentBulkStatusSchema,
  enrollmentMoveSchema,
  enrollmentSchema,
  enrollmentUpdateSchema,
} from "@/lib/validators/master";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/admin/enrollment";

function target(formData: FormData, error?: string, success?: string) {
  const year = String(formData.get("year") ?? "");
  const url = new URL(resolveReturnTo(formData, PATH), "http://localhost");
  if (year) url.searchParams.set("year", year);
  url.searchParams.delete("error");
  url.searchParams.delete("success");
  if (error) url.searchParams.set("error", error);
  if (success) url.searchParams.set("success", success);
  return `${url.pathname}${url.search}`;
}

export async function saveEnrollment(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPermission("manage:master_data");
    const parsed = enrollmentSchema.safeParse({
      studentId: formData.get("studentId"),
      classId: formData.get("classId"),
      academicYearId: formData.get("academicYearId"),
      status: formData.get("status"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali input enrollment.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    await createEnrollment(parsed.data);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(PATH);
  revalidatePath("/admin/siswa");
  redirect(target(formData, undefined, "Enrollment berhasil disimpan."));
}

export async function saveEnrollmentBulk(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let result: Awaited<ReturnType<typeof createEnrollmentsBulk>>;
  try {
    await assertPermission("manage:master_data");
    const parsed = enrollmentBulkSchema.safeParse({
      studentIds: formData.getAll("studentIds").map(String),
      classId: formData.get("classId"),
      academicYearId: formData.get("academicYearId"),
      status: formData.get("status"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message:
          parsed.error.issues[0]?.message ??
          "Periksa kembali pilihan enrollment massal.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    result = await createEnrollmentsBulk(parsed.data);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  const changed = result.created + result.reactivated;
  if (changed === 0) {
    const names = result.skipped
      .slice(0, 3)
      .map((row) => row.name)
      .join(", ");
    const rest =
      result.skipped.length > 3
        ? `, +${result.skipped.length - 3} lainnya`
        : "";
    return {
      status: "error",
      message: `Tidak ada enrollment baru. ${result.skipped.length} siswa dilewati${names ? `: ${names}${rest}` : ""}.`,
    };
  }

  revalidatePath(PATH);
  revalidatePath("/admin/siswa");

  const parts = [
    `${result.created} enrollment dibuat`,
    result.reactivated > 0
      ? `${result.reactivated} diaktifkan kembali`
      : undefined,
    result.skipped.length > 0
      ? `${result.skipped.length} dilewati`
      : undefined,
  ].filter(Boolean);

  redirect(target(formData, undefined, `${parts.join(", ")}.`));
}

export async function updateEnrollmentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPermission("manage:master_data");
    const parsed = enrollmentUpdateSchema.safeParse({
      id: formData.get("id"),
      classId: formData.get("classId"),
      status: formData.get("status"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Periksa kembali input enrollment.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    await updateEnrollment(parsed.data);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(PATH);
  revalidatePath("/admin/siswa");
  redirect(target(formData, undefined, "Enrollment berhasil diperbarui."));
}

export async function moveEnrollmentsBulk(formData: FormData) {
  let moved = 0;
  try {
    await assertPermission("manage:master_data");
    const parsed = enrollmentMoveSchema.safeParse({
      enrollmentIds: formData.getAll("enrollmentIds").map(String),
      targetClassId: formData.get("targetClassId"),
    });
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Pilih siswa dan kelas tujuan.",
      );
    }
    const result = await moveEnrollmentsBulkData(parsed.data);
    moved = result.moved;
  } catch (error) {
    redirect(target(formData, errorMessage(error)));
  }
  revalidatePath(PATH);
  revalidatePath("/admin/siswa");
  redirect(target(formData, undefined, `${moved} enrollment dipindahkan.`));
}

export async function bulkUpdateEnrollmentStatus(formData: FormData) {
  let updated = 0;
  try {
    await assertPermission("manage:master_data");
    const parsed = enrollmentBulkStatusSchema.safeParse({
      enrollmentIds: formData.getAll("enrollmentIds").map(String),
      status: formData.get("status"),
    });
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Pilih siswa dan status.",
      );
    }
    const result = await updateEnrollmentsStatusBulkData(parsed.data);
    updated = result.updated;
  } catch (error) {
    redirect(target(formData, errorMessage(error)));
  }
  revalidatePath(PATH);
  revalidatePath("/admin/siswa");
  redirect(target(formData, undefined, `${updated} enrollment diperbarui.`));
}

export async function removeEnrollment(formData: FormData) {
  try {
    await assertPermission("manage:master_data");
    await deleteEnrollment(String(formData.get("id")));
  } catch (error) {
    redirect(target(formData, errorMessage(error)));
  }
  revalidatePath(PATH);
  redirect(target(formData, undefined, "Enrollment dihapus."));
}
