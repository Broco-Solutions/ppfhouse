"use client";

import { useActionState, useState } from "react";

import { ClientVehiclePicker } from "@/modules/clients/ui/client-vehicle-picker";
import {
  saveAppointmentAction,
  type SchedulingFormState,
} from "@/modules/scheduling/application/actions";
import {
  APPOINTMENT_TONE_LABELS,
  APPOINTMENT_TONES,
  resolveAppointmentTone,
} from "@/modules/scheduling/domain/appointment-tones";
import styles from "@/modules/scheduling/ui/calendar.module.css";
import {
  formatDuration,
  minutesBetween,
  SchedulePicker,
  ScheduleSummary,
} from "@/modules/scheduling/ui/schedule-picker";
import { getBusinessDateKey } from "@/shared/date-time/business-time";

const initialState: SchedulingFormState = { status: "idle" };

interface OptionData {
  clients: {
    id: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    vehicleCount: number;
  }[];
  vehicles: {
    id: string;
    clientId: string;
    brand: string;
    model: string;
    version: string | null;
    year: number | null;
    color: string | null;
    vehicleClass: "SEDAN" | "SUV" | "PICKUP" | "OTHER" | null;
  }[];
  services: {
    id: string;
    name: string;
    estimatedDurationMinutes: number | null;
    category: { name: string };
  }[];
  employees: { id: string; name: string }[];
}

interface AppointmentValues {
  id?: string;
  clientId?: string;
  vehicleId?: string;
  clientLabel?: string;
  vehicleLabel?: string;
  startLocal: string;
  endLocal: string;
  serviceIds?: string[];
  employeeIds?: string[];
  internalNotes?: string | null;
  visibleToClient?: boolean;
  color?: string | null;
}

export function AppointmentForm({
  options,
  values,
  idempotencyKey,
  identityReassignment,
}: {
  options: OptionData;
  values: AppointmentValues;
  idempotencyKey?: string;
  identityReassignment?: { allowed: boolean; reason: string | null };
}) {
  const [state, action, pending] = useActionState(
    saveAppointmentAction,
    initialState,
  );
  const isEdit = Boolean(values.id);
  const identityLocked = isEdit && identityReassignment?.allowed === false;
  const [schedule, setSchedule] = useState({
    start: values.startLocal,
    end: values.endLocal,
  });
  const [tone, setTone] = useState(() =>
    resolveAppointmentTone(
      values.color,
      values.id ?? idempotencyKey ?? values.startLocal,
    ),
  );
  const minutes = minutesBetween(schedule);

  return (
    <form action={action} className={styles.appointmentForm}>
      <div className={styles.form}>
        {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
        {idempotencyKey ? (
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        ) : null}
        {state.message ? (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        ) : null}
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <h2>Cliente y vehículo</h2>
            {isEdit ? (
              <p>
                La identidad sólo puede cambiar cuando el caso todavía no tiene
                historial comercial.
              </p>
            ) : null}
          </div>
          {identityLocked ? (
            <>
              <input name="clientId" type="hidden" value={values.clientId} />
              <input name="vehicleId" type="hidden" value={values.vehicleId} />
              <div className={styles.identity}>
                <strong>{values.clientLabel}</strong>
                <span>{values.vehicleLabel}</span>
              </div>
              <p className={styles.identityNotice} role="note">
                {identityReassignment?.reason}
              </p>
            </>
          ) : (
            <ClientVehiclePicker
              initialClientId={values.clientId}
              initialClients={options.clients}
              initialVehicleId={values.vehicleId}
              initialVehicles={options.vehicles}
            />
          )}
        </section>
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <h2>Horario</h2>
            <p>
              Elegí el día, la hora de entrada y cuánto tiempo queda el
              vehículo.
            </p>
          </div>
          <SchedulePicker
            onChange={setSchedule}
            showSummary={false}
            today={getBusinessDateKey(new Date())}
            value={schedule}
          />
        </section>
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <h2>Servicios</h2>
            <p>Opcionales; se guardan como snapshot del turno.</p>
          </div>
          <div className={styles.choiceGrid}>
            {options.services.length ? (
              options.services.map((service) => (
                <label className={styles.choice} key={service.id}>
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={service.id}
                    defaultChecked={values.serviceIds?.includes(service.id)}
                  />
                  <span>
                    <strong>{service.name}</strong>
                    <small>
                      {service.category.name}
                      {service.estimatedDurationMinutes
                        ? ` · ${service.estimatedDurationMinutes} min`
                        : ""}
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p className={`${styles.muted} ${styles.fieldSpan}`}>
                No hay servicios activos. Podés agendar igual.
              </p>
            )}
          </div>
        </section>
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <h2>Responsables</h2>
            <p>Asignación opcional del equipo.</p>
          </div>
          <div className={styles.choiceGrid}>
            {options.employees.map((employee) => (
              <label className={styles.choice} key={employee.id}>
                <input
                  type="checkbox"
                  name="employeeIds"
                  value={employee.id}
                  defaultChecked={values.employeeIds?.includes(employee.id)}
                />
                <span>
                  <strong>{employee.name}</strong>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <h2>Detalles</h2>
            <p>Las notas son siempre internas.</p>
          </div>
          <div className={styles.formGrid}>
            <label className={`${styles.field} ${styles.fieldSpan}`}>
              <span>Notas internas</span>
              <textarea
                name="internalNotes"
                defaultValue={values.internalNotes ?? ""}
                rows={4}
              />
            </label>
            <label className={`${styles.toggle} ${styles.fieldSpan}`}>
              <input
                type="checkbox"
                name="visibleToClient"
                defaultChecked={values.visibleToClient ?? true}
              />
              <span>Mostrar este turno en el portal cuando exista</span>
            </label>
          </div>
        </section>
      </div>
      <aside aria-label="Resumen del turno" className={styles.formAside}>
        <div className={styles.asidePanel}>
          <h2 className={styles.asideTitle}>Resumen</h2>
          <p aria-live="polite" className={styles.asideSchedule}>
            <ScheduleSummary value={schedule} />
          </p>
          <fieldset className={styles.toneField}>
            <legend>Color en la agenda</legend>
            <div className={styles.toneSwatches}>
              {APPOINTMENT_TONES.map((item) => (
                <label
                  className={`${styles.toneSwatch} ${styles.toned}`}
                  data-tone={item}
                  key={item}
                  title={APPOINTMENT_TONE_LABELS[item]}
                >
                  <input
                    checked={tone === item}
                    name="color"
                    onChange={() => setTone(item)}
                    type="radio"
                    value={item}
                  />
                  <span className="sr-only">
                    {APPOINTMENT_TONE_LABELS[item]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div
            aria-hidden
            className={`${styles.tonePreview} ${styles.toned}`}
            data-tone={tone}
          >
            <span className={styles.eventTopline}>
              <span>
                {schedule.start.slice(11)}–{schedule.end.slice(11)}
              </span>
              <span>{minutes > 0 ? formatDuration(minutes) : "—"}</span>
            </span>
            <strong>{values.vehicleLabel ?? "Nuevo turno"}</strong>
            <span className={styles.tonePreviewMeta}>
              Así se verá en la agenda · {APPOINTMENT_TONE_LABELS[tone]}
            </span>
          </div>
          <button className={styles.submit} disabled={pending}>
            {pending ? "Guardando…" : isEdit ? "Guardar turno" : "Crear turno"}
          </button>
        </div>
      </aside>
    </form>
  );
}
