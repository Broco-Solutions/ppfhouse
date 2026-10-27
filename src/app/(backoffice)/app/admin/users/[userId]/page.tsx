import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailHeader, Page } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Alert } from "@/components/ui/status";
import styles from "@/modules/clients/ui/clients.module.css";
import { requireRole } from "@/modules/identity/application/authorization";
import { setUserActiveAction } from "@/modules/users/application/actions";
import { getUser } from "@/modules/users/application/user-service";
import { PasswordResetForm } from "@/modules/users/ui/password-reset-form";
import { UserForm } from "@/modules/users/ui/user-form";
import {
  formatBusinessDate,
  formatBusinessDateTime,
} from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Usuario" };

const statusErrors: Record<string, string> = {
  SELF_LOCKOUT: "No podés desactivar tu propio usuario.",
  LAST_ADMIN: "Debe quedar al menos un ADMIN activo.",
  USER_NOT_FOUND: "El usuario ya no existe.",
};

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{
    saved?: string;
    statusChanged?: string;
    passwordReset?: string;
    error?: string;
  }>;
}

export default async function UserDetailPage({
  params,
  searchParams,
}: PageProps) {
  const session = await requireRole("ADMIN");
  const { userId } = await params;
  const notices = await searchParams;
  const user = await getUser(userId);
  if (!user) notFound();
  const isSelf = user.id === session.user.id;
  const statusError = notices.error ? statusErrors[notices.error] : undefined;

  return (
    <Page className={styles.detailPage} size="narrow">
      <Link className={styles.backLink} href="/app/admin/users">
        ← Usuarios
      </Link>

      {notices.saved || notices.statusChanged ? (
        <Alert intent="success" title="Cambios guardados">
          El acceso del usuario refleja la última configuración.
        </Alert>
      ) : null}
      {notices.passwordReset ? (
        <Alert intent="success" title="Contraseña restablecida">
          Se cerraron las sesiones abiertas del usuario.
        </Alert>
      ) : null}
      {statusError ? (
        <Alert intent="danger" title="No se aplicó el cambio">
          {statusError}
        </Alert>
      ) : null}
      {user.accounts.length === 0 ? (
        <Alert intent="warning" title="Sin contraseña">
          Este usuario no tiene credenciales. Definí una contraseña para que
          pueda ingresar.
        </Alert>
      ) : null}

      <DetailHeader
        actions={
          isSelf ? null : (
            <form action={setUserActiveAction}>
              <input name="id" type="hidden" value={user.id} />
              <input name="active" type="hidden" value={String(!user.active)} />
              {user.active ? (
                <ConfirmButton
                  className={buttonClassName("danger")}
                  message="El usuario no podrá ingresar y se cerrarán sus sesiones abiertas. Su historial se conserva."
                >
                  Desactivar
                </ConfirmButton>
              ) : (
                <button className={buttonClassName("secondary")} type="submit">
                  Reactivar
                </button>
              )}
            </form>
          )
        }
        description={user.email}
        eyebrow={user.active ? "Usuario activo" : "Usuario inactivo"}
        title={user.name}
      />

      <dl className={styles.detailSummary}>
        <div>
          <dt>Rol</dt>
          <dd>{user.role}</dd>
        </div>
        <div>
          <dt>Último acceso</dt>
          <dd>
            {user.lastLoginAt
              ? formatBusinessDateTime(user.lastLoginAt)
              : "Sin accesos"}
          </dd>
        </div>
        <div>
          <dt>Alta</dt>
          <dd>{formatBusinessDate(user.createdAt)}</dd>
        </div>
      </dl>

      <UserForm
        roleLocked={isSelf}
        values={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }}
      />
      <PasswordResetForm userId={user.id} />
    </Page>
  );
}
