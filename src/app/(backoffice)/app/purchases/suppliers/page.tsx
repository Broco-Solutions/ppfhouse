import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  createSupplierAction,
  toggleSupplierAction,
} from "@/modules/purchases/application/actions";
import { listSuppliers } from "@/modules/purchases/application/purchase-service";

export const metadata: Metadata = { title: "Proveedores" };

export default async function SuppliersPage() {
  await requireRole("ADMIN");
  const suppliers = await listSuppliers();
  return (
    <div className="page-stack">
      <Link href="/app/purchases" className="back-link">
        ← Compras
      </Link>
      <header className="page-header">
        <p className="eyebrow">Abastecimiento</p>
        <h1>Proveedores</h1>
        <p className="page-description">
          Sólo los datos necesarios para registrar compras.
        </p>
      </header>
      <form
        action={createSupplierAction}
        className="supplier-form form-section"
      >
        <div className="form-grid">
          <label className="field-group">
            <span>Nombre *</span>
            <input name="name" required />
          </label>
          <label className="field-group">
            <span>Contacto</span>
            <input name="contactName" />
          </label>
          <label className="field-group">
            <span>Teléfono</span>
            <input name="phone" inputMode="tel" />
          </label>
          <label className="field-group">
            <span>Email</span>
            <input name="email" type="email" />
          </label>
          <label className="field-group field-span-2">
            <span>Notas</span>
            <input name="notes" />
          </label>
        </div>
        <button className="primary-button">Agregar proveedor</button>
      </form>
      {suppliers.length ? (
        <section className="settings-list">
          {suppliers.map((supplier) => (
            <article className="setting-row" key={supplier.id}>
              <div>
                <strong>{supplier.name}</strong>
                <small>
                  {supplier.contactName ||
                    supplier.phone ||
                    supplier.email ||
                    "Sin contacto"}{" "}
                  · {supplier._count.purchases} compras
                </small>
              </div>
              <span
                className={
                  supplier.active
                    ? "status-badge status-active"
                    : "status-badge"
                }
              >
                {supplier.active ? "Activo" : "Inactivo"}
              </span>
              <div className="header-actions">
                <form action={toggleSupplierAction}>
                  <input type="hidden" name="supplierId" value={supplier.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={String(!supplier.active)}
                  />
                  <button className="text-button">
                    {supplier.active ? "Desactivar" : "Activar"}
                  </button>
                </form>
                <DeleteRecordLink kind="supplier" id={supplier.id} />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>Sin proveedores.</h2>
          <p>Agregá el primero arriba.</p>
        </section>
      )}
    </div>
  );
}
