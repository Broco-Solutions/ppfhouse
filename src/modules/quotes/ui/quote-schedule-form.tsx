"use client";

import { useActionState } from "react";

import {
  scheduleAcceptedQuoteAction,
  type QuoteFormState,
} from "@/modules/quotes/application/actions";

const initialState: QuoteFormState = { status: "idle" };

export function QuoteScheduleForm({
  quoteId,
  idempotencyKey,
  startLocal,
  endLocal,
  employees,
}: {
  quoteId: string;
  idempotencyKey: string;
  startLocal: string;
  endLocal: string;
  employees: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    scheduleAcceptedQuoteAction,
    initialState,
  );
  return (
    <form action={action} className="entity-form">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Horario</h2>
          <p>El pago no condiciona la reserva.</p>
        </div>
        <div className="form-grid">
          <label className="field-group">
            <span>Inicio *</span>
            <input
              type="datetime-local"
              name="startLocal"
              defaultValue={startLocal}
              required
            />
          </label>
          <label className="field-group">
            <span>Fin *</span>
            <input
              type="datetime-local"
              name="endLocal"
              defaultValue={endLocal}
              required
            />
          </label>
        </div>
      </section>
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Responsables</h2>
          <p>Asignación opcional.</p>
        </div>
        <div className="choice-grid">
          {employees.map((employee) => (
            <label className="choice-card" key={employee.id}>
              <input type="checkbox" name="employeeIds" value={employee.id} />
              <span>
                <strong>{employee.name}</strong>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Detalles</h2>
          <p>Las líneas aceptadas se copian como snapshot del turno.</p>
        </div>
        <div className="form-grid">
          <label className="field-group field-span-2">
            <span>Notas internas</span>
            <textarea name="internalNotes" rows={3} />
          </label>
          <label className="toggle-field field-span-2">
            <input type="checkbox" name="visibleToClient" defaultChecked />
            <span>Mostrar turno en portal cuando exista</span>
          </label>
        </div>
      </section>
      <div className="form-actions">
        <button className="primary-button" disabled={pending}>
          {pending ? "Agendando…" : "Crear turno"}
        </button>
      </div>
    </form>
  );
}
