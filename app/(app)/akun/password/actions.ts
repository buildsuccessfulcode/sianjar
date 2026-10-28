"use server";

import { changeOwnPassword } from "@/data-access/account";
import { getCurrentUser } from "@/lib/dal";
import { errorMessage } from "@/lib/errors";
import { changePasswordSchema } from "@/lib/validators/auth";
import type { ActionState } from "@/lib/validators/common";

export async function changePassword(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Periksa kembali input password.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await changeOwnPassword(
      user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  return {
    status: "success",
    message:
      "Password berhasil diubah. Gunakan password baru pada login berikutnya.",
  };
}
