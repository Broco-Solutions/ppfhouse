import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Page, PageHeader } from "@/components/patterns/page";
import { getClientDetail } from "@/modules/clients/application/client-service";
import { ClientForm } from "@/modules/clients/ui/client-form";
import styles from "@/modules/clients/ui/clients.module.css";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await getClientDetail(clientId);
  if (!client) notFound();
  return (
    <Page className={styles.formPage} size="narrow">
      <Link className={styles.backLink} href={`/app/clients/${client.id}`}>
        ← Volver a la ficha
      </Link>
      <PageHeader eyebrow="Cliente" title={`Editar ${client.displayName}`} />
      <ClientForm values={client} />
    </Page>
  );
}
