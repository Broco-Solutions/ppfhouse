import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Page, PageHeader } from "@/components/patterns/page";
import { getVehicleDetail } from "@/modules/clients/application/client-service";
import styles from "@/modules/clients/ui/clients.module.css";
import { VehicleForm } from "@/modules/clients/ui/vehicle-form";

export const metadata: Metadata = { title: "Editar vehículo" };

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ clientId: string; vehicleId: string }>;
}) {
  const { clientId, vehicleId } = await params;
  const vehicle = await getVehicleDetail(clientId, vehicleId);
  if (!vehicle) notFound();
  return (
    <Page className={styles.formPage} size="narrow">
      <Link className={styles.backLink} href={`/app/clients/${clientId}`}>
        ← Volver a la ficha
      </Link>
      <PageHeader
        eyebrow="Vehículo"
        title={`Editar ${vehicle.brand} ${vehicle.model}`}
      />
      <VehicleForm clientId={clientId} values={vehicle} />
    </Page>
  );
}
