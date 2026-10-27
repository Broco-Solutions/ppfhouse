import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  createInventoryCategoryAction,
  toggleInventoryCategoryAction,
} from "@/modules/inventory/application/actions";
import { listInventoryCategories } from "@/modules/inventory/application/inventory-service";

export const metadata: Metadata = { title: "Categorías de inventario" };

export default async function InventoryCategoriesPage() {
  await requireRole("ADMIN");
  const categories = await listInventoryCategories();
  return (
    <div className="page-stack">
      <Link href="/app/inventory" className="back-link">
        ← Inventario
      </Link>
      <header className="page-header">
        <p className="eyebrow">Configuración simple</p>
        <h1>Categorías</h1>
        <p className="page-description">
          Agrupá insumos para encontrarlos rápido, sin crear una taxonomía
          compleja.
        </p>
      </header>
      <form
        action={createInventoryCategoryAction}
        className="inline-create-form"
      >
        <label className="field-group">
          <span>Nueva categoría</span>
          <input
            name="name"
            placeholder="Ej. Films y PPF"
            minLength={2}
            required
          />
        </label>
        <button className="primary-button">Agregar</button>
      </form>
      {categories.length ? (
        <section className="settings-list">
          {categories.map((category) => (
            <article className="setting-row" key={category.id}>
              <div>
                <strong>{category.name}</strong>
                <small>
                  {category._count.items}{" "}
                  {category._count.items === 1 ? "artículo" : "artículos"}
                </small>
              </div>
              <span
                className={
                  category.active
                    ? "status-badge status-active"
                    : "status-badge"
                }
              >
                {category.active ? "Activa" : "Inactiva"}
              </span>
              <div className="header-actions">
                <form action={toggleInventoryCategoryAction}>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={String(!category.active)}
                  />
                  <button className="text-button">
                    {category.active ? "Desactivar" : "Activar"}
                  </button>
                </form>
                <DeleteRecordLink kind="inventoryCategory" id={category.id} />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>Sin categorías todavía.</h2>
          <p>Creá la primera arriba.</p>
        </section>
      )}
    </div>
  );
}
