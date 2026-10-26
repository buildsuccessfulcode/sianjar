"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  cancelPromotionBatch,
  commitPromotion,
} from "@/data-access/promotions";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { redirectWithFlash, resolveReturnTo } from "@/lib/redirect";
import { promotionSchema } from "@/lib/validators/schedule";
import type { ActionState } from "@/lib/validators/common";

const PATH = "/promosi";

function revalidate() {
  revalidatePath(PATH);
  revalidatePath("/admin/enrollment");
  revalidatePath("/admin/siswa");
  revalidatePath("/dashboard");
}

export async function runPromotion(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let batchId = "";

  try {
    const user = await assertPermission("execute:promotion");
    if (formData.get("confirm") !== "on") {
      return {
        status: "error",
        message: "Centang konfirmasi setelah memeriksa pratinjau.",
      };
    }
    const parsed = promotionSchema.safeParse({
      fromAcademicYearId: formData.get("fromAcademicYearId"),
      toAcademicYearId: formData.get("toAcademicYearId"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Pilih tahun ajaran asal dan tujuan yang berbeda.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const { batch } = await commitPromotion(
      parsed.data.fromAcademicYearId,
      parsed.data.toAcademicYearId,
      user.id,
    );
    batchId = batch.id;
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidate();
  const url = new URL(resolveReturnTo(formData, PATH), "http://localhost");
  url.searchParams.set("batch", batchId);
  url.searchParams.delete("success");
  url.searchParams.delete("error");
  url.searchParams.set("success", "Promosi berhasil dijalankan.");
  redirect(`${url.pathname}${url.search}`);
}

export async function cancelBatch(formData: FormData) {
  try {
    const user = await assertPermission("cancel:promotion_batch");
    await cancelPromotionBatch(String(formData.get("id")), user.id);
  } catch (error) {
    redirect(redirectWithFlash(formData, PATH, "error", errorMessage(error)));
  }
  revalidate();
  redirect(
    redirectWithFlash(formData, PATH, "success", "Batch promosi dibatalkan."),
  );
}
