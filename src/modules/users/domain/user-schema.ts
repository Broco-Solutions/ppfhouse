import { z } from "zod";

import { userRoles } from "@/modules/identity/domain/roles";

const name = z.string().trim().min(2, "Ingresá el nombre.").max(120);
const email = z
  .string()
  .trim()
  .email("Ingresá un email válido.")
  .max(160)
  .transform((value) => value.toLowerCase());
const role = z.enum(userRoles, { message: "Elegí un rol válido." });
const password = z
  .string()
  .min(12, "La contraseña debe tener al menos 12 caracteres.")
  .max(128, "La contraseña no puede superar 128 caracteres.");

function passwordsMatch(
  value: { password: string; passwordConfirmation: string },
  context: z.RefinementCtx,
) {
  if (value.password !== value.passwordConfirmation) {
    context.addIssue({
      code: "custom",
      path: ["passwordConfirmation"],
      message: "Las contraseñas no coinciden.",
    });
  }
}

export const userUpdateSchema = z.object({ name, email, role });

export const userCreateSchema = userUpdateSchema
  .extend({ password, passwordConfirmation: z.string() })
  .superRefine(passwordsMatch);

export const passwordResetSchema = z
  .object({ password, passwordConfirmation: z.string() })
  .superRefine(passwordsMatch);

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
