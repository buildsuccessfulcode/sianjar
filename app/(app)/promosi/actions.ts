"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  cancelPromotionBatch,
  commitPromotion,
} from "@/data-access/promotions";
import { assertPermission } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
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
  redirect(
    `${PATH}?batch=${batchId}&success=${encodeURIComponent("Promosi berhasil dijalankan.")}`,
  );
}

export async function cancelBatch(formData: FormData) {
  try {
    const user = await assertPermission("cancel:promotion_batch");
    await cancelPromotionBatch(String(formData.get("id")), user.id);
  } catch (error) {
    redirect(`${PATH}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidate();
  redirect(
    `${PATH}?success=${encodeURIComponent("Batch promosi dibatalkan.")}`,
  );
}
