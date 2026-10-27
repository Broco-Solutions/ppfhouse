import { formatBusinessDateTime } from "@/shared/date-time/business-time";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Alert } from "@/components/ui/status";
import { Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { requireRole } from "@/modules/identity/application/authorization";
import { listDeletionRecords } from "@/modules/deletion/application/record-config";
import { recordKinds, recordLabels } from "@/modules/deletion/domain/records";
import { DeleteRecordButton } from "@/modules/deletion/ui/delete-record-button";
import styles from "./records.module.css";

export const metadata: Metadata = { title: "Eliminar registros" };
const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Emitido",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  POSTED: "Registrado",
  VOIDED: "Anulado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};
export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    q?: string;
    page?: string;
    deleted?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const kind = z.enum(recordKinds).catch("client").parse(params.kind);
  const query = (params.q ?? "").slice(0, 120);
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse(params.page);
  const records = await listDeletionRecords(kind, query, page);
  const pageUrl = (next: number) =>
    `/app/admin/records?${new URLSearchParams({ kind, q: query, page: String(next) })}`;
  return (
    <Page size="narrow">
      <PageHeader
        eyebrow="Sólo ADMIN"
        title="Eliminar registros"
        description="Borrado definitivo. Incluye registros activos, archivados y anulados. Si hay dependencias, primero deberás eliminarlas."
      />
      {params.deleted === "1" ? (
        <Alert intent="success" title="Registro eliminado">
          El registro se eliminó definitivamente.
        </Alert>
      ) : null}
      <form key={`${kind}:${query}`} method="get" className={styles.filters}>
        <label>
          Tipo de registro
          <select name="kind" defaultValue={kind}>
            {recordKinds.map((value) => (
              <option key={value} value={value}>
                {recordLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Nombre, número o ID"
          />
        </label>
        <button className={buttonClassName("secondary")} type="submit">
          Buscar
        </button>
      </form>
      <p>
        Los ítems, fotos, archivos y movimientos propios se eliminan junto con
        su registro, según se indica al confirmar. No se borran otros clientes,
        vehículos ni trabajos en cadena.
      </p>
      <section
        aria-label={`Registros: ${recordLabels[kind]}`}
        className={styles.records}
      >
        {records.slice(0, 25).map((record) => (
          <article key={record.id} className={styles.record}>
            <div>
              <strong>
                {record.label}
                {record.eventAt
                  ? ` · ${formatBusinessDateTime(record.eventAt)}`
                  : ""}
              </strong>
              {record.status ? (
                <p className={styles.meta}>
                  {statusLabels[record.status] ?? record.status}
                </p>
              ) : null}
              <p className={styles.meta}>ID: {record.id}</p>
              <p className={styles.meta}>
                Creado:{" "}
                {record.createdAt.toLocaleDateString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                })}
              </p>
            </div>
            <DeleteRecordButton
              kind={kind}
              id={record.id}
              label={record.label}
            />
          </article>
        ))}
        {!records.length ? (
          <p>No hay registros que coincidan con la búsqueda.</p>
        ) : null}
      </section>
      <nav aria-label="Páginas de registros" className={styles.pagination}>
        {page > 1 ? <Link href={pageUrl(page - 1)}>Anterior</Link> : null}
        <span>Página {page}</span>
        {records.length > 25 ? (
          <Link href={pageUrl(page + 1)}>Siguiente</Link>
        ) : null}
      </nav>
    </Page>
  );
}
