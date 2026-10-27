"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  authenticatePortalLink,
  createClientShareLink,
  regenerateClientShareLink,
  revokeClientShareLink,
  updateClientShareLinkPassword,
} from "@/modules/portal/application/portal-service";
import { setPortalSession } from "@/modules/portal/application/portal-session";

export type ShareLinkActionResult =
  { ok: true; message: string; url?: string } | { ok: false; message: string };

export async function createShareLinkAction(input: {
  clientId: string;
  password: string;
  expiresOn: string;
}): Promise<ShareLinkActionResult> {
  const session = await requireRole("ADMIN");
  try {
    const result = await createClientShareLink(input, session.user);
    revalidatePath(`/app/clients/${input.clientId}`);
    return {
      ok: true,
      message:
        "Link privado creado. Copialo ahora: por seguridad no se guarda en texto plano.",
      url: result.url,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message === "PORTAL_PASSWORD_TOO_SHORT"
          ? "La contraseña debe tener al menos 6 caracteres."
          : error instanceof Error &&
              error.message === "PORTAL_EXPIRATION_INVALID"
            ? "Elegí una fecha de vencimiento futura."
            : "No pudimos crear el link privado.",
    };
  }
}

export async function regenerateShareLinkAction(
  clientId: string,
): Promise<ShareLinkActionResult> {
  const session = await requireRole("ADMIN");
  try {
    const result = await regenerateClientShareLink(clientId, session.user);
    revalidatePath(`/app/clients/${clientId}`);
    return {
      ok: true,
      message:
        "Link regenerado. El anterior y sus sesiones dejaron de funcionar.",
      url: result.url,
    };
  } catch {
    return { ok: false, message: "No pudimos regenerar el link." };
  }
}

export async function updateShareLinkPasswordAction(
  clientId: string,
  password: string,
): Promise<ShareLinkActionResult> {
  const session = await requireRole("ADMIN");
  try {
    await updateClientShareLinkPassword({ clientId, password }, session.user);
    revalidatePath(`/app/clients/${clientId}`);
    return {
      ok: true,
      message: password
        ? "Contraseña actualizada."
        : "El link ya no requiere contraseña.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message === "PORTAL_PASSWORD_TOO_SHORT"
          ? "La contraseña debe tener al menos 6 caracteres."
          : "No pudimos actualizar la contraseña.",
    };
  }
}

export async function revokeShareLinkAction(
  clientId: string,
): Promise<ShareLinkActionResult> {
  const session = await requireRole("ADMIN");
  try {
    await revokeClientShareLink(clientId, session.user);
    revalidatePath(`/app/clients/${clientId}`);
    return { ok: true, message: "Link revocado inmediatamente." };
  } catch {
    return { ok: false, message: "No pudimos revocar el link." };
  }
}

export interface PortalUnlockState {
  error?: string;
}

export async function unlockPortalAction(
  _state: PortalUnlockState,
  formData: FormData,
): Promise<PortalUnlockState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const requestHeaders = await headers();
  const fingerprint =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  try {
    const link = await authenticatePortalLink({ token, password }, fingerprint);
    await setPortalSession(link);
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message === "PORTAL_RATE_LIMITED"
          ? "Demasiados intentos. Esperá unos minutos antes de volver a probar."
          : "No pudimos validar el acceso. Revisá la contraseña.",
    };
  }
  redirect(`/client/${token}`);
}
