import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailHeader, Page } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Badge } from "@/components/ui/status";
import { reverseConsumptionAction } from "@/modules/job-consumptions/application/actions";
import { listConsumptionOptions } from "@/modules/job-consumptions/application/consumption-service";
import {
  ConsumptionCorrectionForm,
  ConsumptionForm,
} from "@/modules/job-consumptions/ui/consumption-forms";
import { voidJobAction } from "@/modules/jobs/application/actions";
import { getJobDetail } from "@/modules/jobs/application/job-service";
import { setDirectCostAction } from "@/modules/finance/application/actions";
import { profitability } from "@/modules/money/domain/money";
import { MoneyField } from "@/modules/money/ui/money-field";
import styles from "@/modules/jobs/ui/jobs.module.css";
import { requireRole } from "@/modules/identity/application/authorization";
import { PhotoGallery } from "@/modules/photos/ui/photo-gallery";
import { PhotoUploader } from "@/modules/photos/ui/photo-uploader";
import { formatBusinessDateTime } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Detalle de trabajo" };

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{
    saved?: string;
    voided?: string;
    consumed?: string;
    corrected?: string;
    consumptionReversed?: string;
  }>;
}) {
  const [{ jobId }, notices] = await Promise.all([params, searchParams]);
  const session = await requireRole("ADMIN", "STAFF");
  const [job, inventoryItems] = await Promise.all([
    getJobDetail(jobId, session.user.role === "ADMIN"),
    listConsumptionOptions(),
  ]);
  if (!job) notFound();
  const vehicle = job.serviceCase.vehicle;
  return (
    <Page className={styles.page} size="wide">
      <Link href="/app/jobs" className="back-link">
        ← Trabajos
      </Link>
      {notices.saved ? (
        <p className="success-banner" role="status">
          El trabajo quedó registrado.
        </p>
      ) : null}
      {notices.voided ? (
        <p className="warning-banner" role="status">
          El trabajo quedó anulado y se conserva en el historial.
        </p>
      ) : null}
      {notices.consumed || notices.corrected || notices.consumptionReversed ? (
        <p className="success-banner" role="status">
          {notices.consumed
            ? "El consumo quedó registrado y el stock fue actualizado."
            : notices.corrected
              ? "La corrección quedó registrada con sus movimientos compensatorios."
              : "El consumo quedó anulado y el stock fue restituido."}
        </p>
      ) : null}
      <DetailHeader
        eyebrow={job.voidedAt ? "Trabajo anulado" : "Trabajo realizado"}
        title={`${vehicle.brand} ${vehicle.model}`}
        description={`${job.serviceCase.client.displayName} · ${formatBusinessDateTime(job.performedAt)}`}
        actions={
          <>
            {session.user.role === "ADMIN" ? (
              <Link
                href={`/app/finance/cases/${job.serviceCaseId}`}
                className={buttonClassName("primary")}
              >
                Ver cobros
              </Link>
            ) : null}
            {job.originAppointment ? (
              <Link
                href={`/app/calendar/${job.originAppointment.id}`}
                className={buttonClassName("secondary")}
              >
                Ver turno
              </Link>
            ) : null}
            <DeleteRecordLink kind="job" id={job.id} />
          </>
        }
      />

      <section className={styles.summary} aria-label="Resumen del trabajo">
        <div>
          <span>Origen</span>
          <strong>
            {job.originAppointment ? "Desde turno" : "Carga directa"}
          </strong>
        </div>
        <div>
          <span>Estado</span>
          <strong>{job.voidedAt ? "Anulado" : "Realizado"}</strong>
        </div>
        <div>
          <span>Equipo</span>
          <strong>
            {job.employees.map((item) => item.user.name).join(", ") ||
              "Sin asignar"}
          </strong>
        </div>
      </section>
      {session.user.role === "ADMIN"
        ? (() => {
            const agreed = job.serviceCase.agreedAmountUsd ?? null;
            const directCost = job.serviceCase.directCostUsd ?? null;
            const margin = profitability(agreed, directCost);
            return (
              <section
                className={styles.section}
                aria-label="Rentabilidad del caso"
              >
                <div className={styles.sectionHeader}>
                  <div>
                    <p className="eyebrow">Administración</p>
                    <h2>Rentabilidad</h2>
                  </div>
                </div>
                <dl className="case-profitability">
                  <div>
                    <dt>Monto acordado</dt>
                    <dd>
                      {agreed === null
                        ? "Por definir"
                        : `USD ${agreed.toFixed(2)}`}
                      {job.serviceCase.agreedSourceCurrency === "ARS" ? (
                        <small>
                          ARS {job.serviceCase.agreedSourceAmount?.toFixed(2)} ·
                          1 USD = ARS{" "}
                          {job.serviceCase.agreedExchangeRateArsPerUsd?.toString()}
                        </small>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Costo directo</dt>
                    <dd>
                      {directCost === null
                        ? "Sin imputar"
                        : `USD ${directCost.toFixed(2)}`}
                      {job.serviceCase.directCostSourceCurrency === "ARS" ? (
                        <small>
                          ARS{" "}
                          {job.serviceCase.directCostSourceAmount?.toFixed(2)}·
                          1 USD = ARS{" "}
                          {job.serviceCase.directCostExchangeRateArsPerUsd?.toString()}
                        </small>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Margen</dt>
                    <dd>
                      {margin ? `USD ${margin.marginUsd.toFixed(2)}` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Margen porcentual</dt>
                    <dd>
                      {margin?.marginPercent
                        ? `${margin.marginPercent.toFixed(2)}%`
                        : margin?.marginPercent?.isZero()
                          ? "0,00%"
                          : "—"}
                    </dd>
                  </div>
                </dl>
                <form
                  action={setDirectCostAction}
                  className="inline-create-form"
                >
                  <input
                    type="hidden"
                    name="serviceCaseId"
                    value={job.serviceCaseId}
                  />
                  <MoneyField
                    amountLabel="Costo directo"
                    required={false}
                    initialCurrency={
                      job.serviceCase.directCostSourceCurrency ?? "USD"
                    }
                    initialAmount={
                      job.serviceCase.directCostSourceAmount?.toString() ?? ""
                    }
                    initialRate={
                      job.serviceCase.directCostExchangeRateArsPerUsd?.toString() ??
                      ""
                    }
                  />
                  <button className="ghost-button">Guardar costo</button>
                  <small>
                    Opcional. Dejá el importe vacío para quitar la imputación.
                    Cero registra un costo real de cero.
                  </small>
                </form>
              </section>
            );
          })()
        : null}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Snapshot</p>
            <h2>Servicios realizados</h2>
          </div>
          <span className={styles.count}>{job.services.length}</span>
        </div>
        {job.services.length ? (
          <div className={styles.servicesList}>
            {job.services.map((service) => (
              <article key={service.id}>
                <strong>{service.nameSnapshot}</strong>
                {service.descriptionSnapshot ? (
                  <p>{service.descriptionSnapshot}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="inline-empty">
            <strong>Sin servicios detallados</strong>
            <p>El trabajo igualmente queda registrado en el historial.</p>
          </div>
        )}
      </section>
      {job.notes ? (
        <section className={styles.notes}>
          <div>
            <p className="eyebrow">Notas internas</p>
            <h2>Detalle operativo</h2>
          </div>
          <p>{job.notes}</p>
        </section>
      ) : null}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Materiales</p>
            <h2>Consumos del trabajo</h2>
          </div>
          <span className={styles.count}>
            {job.materialConsumptions.length}
          </span>
        </div>
        {!job.voidedAt ? (
          inventoryItems.length ? (
            <details
              className={styles.disclosure}
              open={!job.materialConsumptions.length}
            >
              <summary>Registrar consumo</summary>
              <div className={styles.disclosureBody}>
                <ConsumptionForm
                  jobId={job.id}
                  items={inventoryItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    baseUnit: item.baseUnit,
                    currentStock: item.currentStock.toFixed(3),
                    category: item.category.name,
                  }))}
                />
              </div>
            </details>
          ) : (
            <div className="inline-empty">
              <strong>No hay insumos activos</strong>
              <p>Un ADMIN debe configurar el inventario antes de consumir.</p>
            </div>
          )
        ) : null}
        {job.materialConsumptions.length ? (
          <div className={styles.consumptions}>
            {job.materialConsumptions.map((consumption) => {
              const reversed = Boolean(consumption.movement?.reversedBy);
              const replaced = Boolean(consumption.replacedBy);
              const active = !reversed && !replaced && !job.voidedAt;
              return (
                <article
                  className={`${styles.consumption} ${active ? "" : styles.inactive}`}
                  key={consumption.id}
                >
                  <div className={styles.consumptionMain}>
                    <strong>{consumption.item.name}</strong>
                    <span>
                      {consumption.quantityBase.toFixed(3)}{" "}
                      {consumption.unitSnapshot}
                    </span>
                  </div>
                  <Badge intent={active ? "success" : "neutral"} withIcon>
                    {replaced ? "Corregido" : reversed ? "Anulado" : "Activo"}
                  </Badge>
                  {consumption.note ? <p>{consumption.note}</p> : null}
                  {active ? (
                    <details className="inline-disclosure">
                      <summary>Corregir o anular</summary>
                      <div className="consumption-actions">
                        <ConsumptionCorrectionForm
                          jobId={job.id}
                          consumptionId={consumption.id}
                          unit={consumption.unitSnapshot}
                          currentQuantity={consumption.quantityBase.toFixed(3)}
                        />
                        <form
                          action={reverseConsumptionAction}
                          className="compact-form"
                        >
                          <input type="hidden" name="jobId" value={job.id} />
                          <input
                            type="hidden"
                            name="consumptionId"
                            value={consumption.id}
                          />
                          <label className="field-group">
                            <span>Motivo de anulación *</span>
                            <input
                              name="reason"
                              minLength={3}
                              maxLength={300}
                              required
                            />
                          </label>
                          <ConfirmButton
                            className="danger-button"
                            message="¿Anular este consumo y restituir el stock?"
                          >
                            Anular consumo
                          </ConfirmButton>
                        </form>
                      </div>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="inline-empty">
            <strong>Sin materiales registrados</strong>
            <p>Agregalos cuando el trabajo haya consumido stock real.</p>
          </div>
        )}
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Registro visual</p>
            <h2>Fotos del trabajo</h2>
          </div>
          <span className={styles.count}>{job.photos.length}</span>
        </div>
        {!job.voidedAt ? (
          <details className={styles.disclosure} open={!job.photos.length}>
            <summary>Subir fotos</summary>
            <div className={styles.disclosureBody}>
              <PhotoUploader jobId={job.id} />
            </div>
          </details>
        ) : null}
        <PhotoGallery jobId={job.id} photos={job.photos} />
      </section>
      {job.voidedAt ? (
        <section className="warning-panel">
          <strong>Anulado el {formatBusinessDateTime(job.voidedAt)}</strong>
          <p>{job.voidReason}</p>
        </section>
      ) : (
        <details className={`${styles.disclosure} danger-disclosure`}>
          <summary>Anular trabajo</summary>
          <form
            action={voidJobAction}
            className={`${styles.disclosureBody} compact-form`}
          >
            <input type="hidden" name="jobId" value={job.id} />
            <label className="field-group">
              <span>Motivo *</span>
              <textarea name="reason" minLength={4} maxLength={500} required />
            </label>
            <ConfirmButton
              className="danger-button"
              message="¿Anular este trabajo? El registro seguirá visible en el historial."
            >
              Confirmar anulación
            </ConfirmButton>
          </form>
        </details>
      )}
    </Page>
  );
}
