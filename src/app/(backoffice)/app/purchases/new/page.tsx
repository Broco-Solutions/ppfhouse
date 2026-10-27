import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/modules/identity/application/authorization";
import { listPurchaseOptions } from "@/modules/purchases/application/purchase-service";
import { PurchaseForm } from "@/modules/purchases/ui/purchase-form";
import { getBusinessDateKey } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Nueva compra" };

export default async function NewPurchasePage() {
  await requireRole("ADMIN");
  const options = await listPurchaseOptions();
  return (
    <div className="page-stack">
      <Link href="/app/purchases" className="back-link">
        ← Compras
      </Link>
      <header className="page-header">
        <p className="eyebrow">Carga atómica</p>
        <h1>Nueva compra</h1>
        <p className="page-description">
          Revisá la conversión a unidad base antes de registrar.
        </p>
      </header>
      {options.suppliers.length && options.items.length ? (
        <PurchaseForm
          defaultBusinessDate={getBusinessDateKey(new Date())}
          suppliers={options.suppliers.map(({ id, name }) => ({ id, name }))}
          items={options.items.map((item) => ({
            ...item,
            presentations: item.presentations.map((presentation) => ({
              ...presentation,
              factorToBase: presentation.factorToBase.toString(),
            })),
          }))}
        />
      ) : (
        <section className="empty-state">
          <h2>Falta configuración básica.</h2>
          <p>
            Necesitás al menos un proveedor activo y un artículo de inventario.
          </p>
          <div className="button-cluster">
            <Link
              href="/app/purchases/suppliers"
              className="ghost-button button-link"
            >
              Proveedores
            </Link>
            <Link href="/app/inventory" className="ghost-button button-link">
              Inventario
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
