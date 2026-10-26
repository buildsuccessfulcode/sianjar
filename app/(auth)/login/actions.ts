"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/validators/auth";
import type { ActionState } from "@/lib/validators/common";

export async function login(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard?success=Selamat%20datang%20di%20SiJAR.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        status: "error",
        message: "Email atau password salah.",
      };
    }
    throw error;
  }

  return { status: "idle" };
}
