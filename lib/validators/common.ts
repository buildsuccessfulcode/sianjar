import { z } from "zod";

export const uuidSchema = z.string().uuid("ID tidak valid");

export const optionalUuid = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => !value || z.string().uuid().safeParse(value).success, {
    message: "ID tidak valid",
  });

export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Format email tidak valid"));

export const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter");

export type ActionState = {
  status?: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialActionState: ActionState = { status: "idle" };
