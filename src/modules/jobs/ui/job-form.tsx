"use client";

import { useActionState, useState } from "react";

import {
  saveJobAction,
  type JobFormState,
} from "@/modules/jobs/application/actions";

import styles from "./jobs.module.css";

const initialState: JobFormState = { status: "idle" };

interface JobOptions {
  clients: {
    id: string;
    displayName: string;
    vehicles: {
      id: string;
      brand: string;
      model: string;
      year: number | null;
    }[];
  }[];
  services: { id: string; name: string; category: { name: string } }[];
  employees: { id: string; name: string }[];
}

interface JobValues {
  appointmentId?: string;
  clientId?: string;
  vehicleId?: string;
  clientLabel?: string;
  vehicleLabel?: string;
  performedLocal: string;
  serviceIds?: string[];
  employeeIds?: string[];
  notes?: string | null;
}

export function JobForm({
  options,
  values,
  idempotencyKey,
}: {
  options: JobOptions;
  values: JobValues;
  idempotencyKey?: string;
}) {
  const [state, action, pending] = useActionState(saveJobAction, initialState);
  const firstClientId = values.clientId ?? options.clients[0]?.id ?? "";
  const [clientId, setClientId] = useState(firstClientId);
  const selectedClient = options.clients.find((item) => item.id === clientId);
  const [vehicleId, setVehicleId] = useState(
    values.vehicleId ?? selectedClient?.vehicles[0]?.id ?? "",
  );
  const fromAppointment = Boolean(values.appointmentId);

  return (
    <form action={action} className={`entity-form job-form ${styles.form}`}>
      {values.appointmentId ? (
        <input
          type="hidden"
          name="appointmentId"
          value={values.appointmentId}
        />
      ) : null}
      {idempotencyKey ? (
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      ) : null}
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Vehículo</h2>
          <p>
            {fromAppointment
              ? "Precargado desde el turno."
              : "El caso se crea automáticamente."}
          </p>
        </div>
        {fromAppointment ? (
          <div className="appointment-identity">
            <strong>{values.clientLabel}</strong>
            <span>{values.vehicleLabel}</span>
          </div>
        ) : (
          <div className="form-grid">
            <label className="field-group">
              <span>Cliente *</span>
              <select
                name="clientId"
                value={clientId}
                onChange={(event) => {
                  const next = event.target.value;
                  setClientId(next);
                  setVehicleId(
                    options.clients.find((item) => item.id === next)
                      ?.vehicles[0]?.id ?? "",
                  );
                }}
                required
              >
                {options.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Vehículo *</span>
              <select
                name="vehicleId"
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
                required
              >
                {selectedClient?.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model}
                    {vehicle.year ? ` · ${vehicle.year}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Realización</h2>
          <p>Esto registra lo efectivamente hecho, no lo planificado.</p>
        </div>
        <label className="field-group">
          <span>Fecha y hora *</span>
          <input
            type="datetime-local"
            name="performedLocal"
            defaultValue={values.performedLocal}
            required
          />
        </label>
      </section>
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Servicios realizados</h2>
          <p>Confirmá la selección; queda guardada como snapshot histórico.</p>
        </div>
        <div className="choice-grid">
          {options.services.length ? (
            options.services.map((service) => (
              <label className="choice-card" key={service.id}>
                <input
                  type="checkbox"
                  name="serviceIds"
                  value={service.id}
                  defaultChecked={values.serviceIds?.includes(service.id)}
                />
                <span>
                  <strong>{service.name}</strong>
                  <small>{service.category.name}</small>
                </span>
              </label>
            ))
          ) : (
            <p className="muted-copy">
              No hay servicios activos. Podés registrar el trabajo igual.
            </p>
          )}
        </div>
      </section>
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Equipo</h2>
          <p>Asignación opcional, sin control horario.</p>
        </div>
        <div className="choice-grid">
          {options.employees.map((employee) => (
            <label className="choice-card" key={employee.id}>
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
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Notas</h2>
          <p>Información operativa interna.</p>
        </div>
        <label className="field-group">
          <span>Notas del trabajo</span>
          <textarea name="notes" defaultValue={values.notes ?? ""} rows={4} />
        </label>
      </section>
      <div className={styles.formActions}>
        <button className="primary-button" disabled={pending}>
          {pending
            ? "Guardando…"
            : fromAppointment
              ? "Confirmar trabajo realizado"
              : "Registrar trabajo"}
        </button>
      </div>
    </form>
  );
}
