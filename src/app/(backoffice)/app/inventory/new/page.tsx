import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/modules/identity/application/authorization";
import { listInventoryCategories } from "@/modules/inventory/application/inventory-service";
import { InventoryItemForm } from "@/modules/inventory/ui/inventory-forms";

export const metadata: Metadata = { title: "Nuevo artículo" };

export default async function NewInventoryItemPage() {
  await requireRole("ADMIN");
  const categories = await listInventoryCategories(true);
  return (
    <div className="page-stack">
      <Link href="/app/inventory" className="back-link">
        ← Inventario
      </Link>
      <header className="page-header">
        <p className="eyebrow">Alta de stock</p>
        <h1>Nuevo artículo</h1>
        <p className="page-description">
          Definí primero cómo se mide. Las presentaciones de compra se agregan
          después.
        </p>
      </header>
      {categories.length ? (
        <InventoryItemForm categories={categories} />
      ) : (
        <section className="empty-state">
          <h2>Primero necesitás una categoría.</h2>
          <p>Las categorías mantienen el inventario fácil de filtrar.</p>
          <Link
            href="/app/inventory/categories"
            className="primary-button button-link"
          >
            Crear categoría
          </Link>
        </section>
      )}
    </div>
  );
}
