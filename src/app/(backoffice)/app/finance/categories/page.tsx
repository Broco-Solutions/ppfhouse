import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import type { Metadata } from "next";
import Link from "next/link";

import {
  createFinancialCategoryAction,
  toggleFinancialCategoryAction,
} from "@/modules/finance/application/actions";
import { listFinancialCategories } from "@/modules/finance/application/finance-service";
import { requireRole } from "@/modules/identity/application/authorization";

export const metadata: Metadata = { title: "Categorías financieras" };

export default async function FinancialCategoriesPage() {
  await requireRole("ADMIN");
  const categories = await listFinancialCategories();
  return (
    <div className="page-stack narrow-page">
      <Link href="/app/finance" className="back-link">
        ← Finanzas
      </Link>
      <header className="page-header">
        <p className="eyebrow">Configuración simple</p>
        <h1>Categorías financieras</h1>
        <p className="page-description">
          Se usan sólo para ingresos y egresos manuales; los cobros ya conocen
          su caso.
        </p>
      </header>
      <form
        action={createFinancialCategoryAction}
        className="inline-create-form finance-inline-form"
      >
        <label>
          <span>Nombre *</span>
          <input name="name" required maxLength={80} />
        </label>
        <label>
          <span>Dirección *</span>
          <select name="direction" defaultValue="OUTFLOW">
            <option value="OUTFLOW">Egreso</option>
            <option value="INFLOW">Ingreso</option>
          </select>
        </label>
        <button className="primary-button">Agregar</button>
      </form>
      {categories.length ? (
        <section className="entity-list" aria-label="Categorías financieras">
          {categories.map((category) => (
            <article className="category-row" key={category.id}>
              <div>
                <strong>{category.name}</strong>
                <small>
                  {category.direction === "INFLOW" ? "Ingreso" : "Egreso"} ·{" "}
                  {category._count.entries} movimientos
                </small>
              </div>
              <span
                className={
                  category.active
                    ? "status-badge status-active"
                    : "status-badge"
                }
              >
                {category.active ? "Activa" : "Archivada"}
              </span>
              <div className="header-actions">
                <form action={toggleFinancialCategoryAction}>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={category.active ? "false" : "true"}
                  />
                  <button className="text-button">
                    {category.active ? "Archivar" : "Reactivar"}
                  </button>
                </form>
                <DeleteRecordLink kind="financialCategory" id={category.id} />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state compact-empty">
          <h2>No hay categorías manuales.</h2>
          <p>Creá sólo las que Ferraro use realmente.</p>
        </section>
      )}
    </div>
  );
}
