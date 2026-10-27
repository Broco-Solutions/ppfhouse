import type { Metadata } from "next";
import Link from "next/link";

import { Page, PageHeader } from "@/components/patterns/page";
import styles from "@/modules/clients/ui/clients.module.css";
import { requireRole } from "@/modules/identity/application/authorization";
import { UserForm } from "@/modules/users/ui/user-form";

export const metadata: Metadata = { title: "Nuevo usuario" };

export default async function NewUserPage() {
  await requireRole("ADMIN");

  return (
    <Page className={styles.formPage} size="narrow">
      <Link className={styles.backLink} href="/app/admin/users">
        ← Usuarios
      </Link>
      <PageHeader
        description="El usuario podrá ingresar con su email y la contraseña que definas."
        eyebrow="Alta"
        title="Nuevo usuario"
      />
      <UserForm />
    </Page>
  );
}
