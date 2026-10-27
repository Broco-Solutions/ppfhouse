import type { Metadata } from "next";
import Link from "next/link";

import { Page, PageHeader } from "@/components/patterns/page";
import { ClientForm } from "@/modules/clients/ui/client-form";
import styles from "@/modules/clients/ui/clients.module.css";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default function NewClientPage() {
  return (
    <Page className={styles.formPage} size="narrow">
      <Link className={styles.backLink} href="/app/clients">
        ← Clientes
      </Link>
      <PageHeader
        description="Sólo pedimos lo necesario. Podés agregar el vehículo al guardar."
        eyebrow="Alta rápida"
        title="Nuevo cliente"
      />
      <ClientForm />
    </Page>
  );
}
