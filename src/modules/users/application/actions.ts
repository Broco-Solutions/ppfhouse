"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
  UserServiceError,
  type UserServiceErrorCode,
} from "@/modules/users/application/user-service";
import {
  passwordResetSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/modules/users/domain/user-schema";

export interface FormActionState {
  status: "idle" | "error";
  message?: string;
  fields?: Record<string, string>;
}

const errorMessages: Record<UserServiceErrorCode, FormActionState> = {
  USER_NOT_FOUND: { status: "error", message: "El usuario ya no existe." },
  EMAIL_TAKEN: {
    status: "error",
    message: "Revisá los campos marcados.",
    fields: { email: "Ya existe un usuario con este email." },
  },
  SELF_LOCKOUT: {
    status: "error",
    message: "No podés quitarte el rol ADMIN ni desactivar tu propio usuario.",
  },
  LAST_ADMIN: {
    status: "error",
    message: "Debe quedar al menos un ADMIN activo.",
  },
};

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function validationState(error: {
  issues: readonly { path: PropertyKey[]; message: string }[];
}) {
  return {
    status: "error" as const,
    message: "Revisá los campos marcados.",
    fields: Object.fromEntries(
      error.issues.map((issue) => [String(issue.path[0]), issue.message]),
    ),
  };
}

function failureState(error: unknown, fallback: string): FormActionState {
  if (error && typeof error === "object" && "digest" in error) throw error;
  if (error instanceof UserServiceError) return errorMessages[error.code];
  return { status: "error", message: fallback };
}

export async function saveUserAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const session = await requireRole("ADMIN");
  const id = stringValue(formData, "id");
  const values = {
    name: stringValue(formData, "name"),
    email: stringValue(formData, "email"),
    role: stringValue(formData, "role"),
  };

  try {
    let userId = id;
    if (id) {
      const parsed = userUpdateSchema.safeParse(values);
      if (!parsed.success) return validationState(parsed.error);
      await updateUser(id, parsed.data, session.user);
    } else {
      const parsed = userCreateSchema.safeParse({
        ...values,
        password: stringValue(formData, "password"),
        passwordConfirmation: stringValue(formData, "passwordConfirmation"),
      });
      if (!parsed.success) return validationState(parsed.error);
      userId = (await createUser(parsed.data)).id;
    }
    revalidatePath("/app/admin/users");
    redirect(`/app/admin/users/${userId}?saved=1`);
  } catch (error) {
    return failureState(
      error,
      "No pudimos guardar el usuario. Intentá nuevamente.",
    );
  }
}

export async function resetUserPasswordAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireRole("ADMIN");
  const id = stringValue(formData, "id");
  if (!id) return { status: "error", message: "Falta identificar el usuario." };
  const parsed = passwordResetSchema.safeParse({
    password: stringValue(formData, "password"),
    passwordConfirmation: stringValue(formData, "passwordConfirmation"),
  });
  if (!parsed.success) return validationState(parsed.error);

  try {
    await resetUserPassword(id, parsed.data);
    redirect(`/app/admin/users/${id}?passwordReset=1`);
  } catch (error) {
    return failureState(
      error,
      "No pudimos restablecer la contraseña. Intentá nuevamente.",
    );
  }
}

export async function setUserActiveAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const id = stringValue(formData, "id");
  const active = stringValue(formData, "active") === "true";
  if (!id) return;

  try {
    await setUserActive(id, active, session.user);
  } catch (error) {
    if (error instanceof UserServiceError) {
      redirect(`/app/admin/users/${id}?error=${error.code}`);
    }
    throw error;
  }
  revalidatePath("/app/admin/users");
  revalidatePath(`/app/admin/users/${id}`);
  redirect(`/app/admin/users/${id}?statusChanged=1`);
}
