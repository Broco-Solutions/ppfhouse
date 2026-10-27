"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import {
  saveSalaryAction,
  type SalaryFormState,
} from "@/modules/salaries/application/actions";

type Operation = "adjust" | "pay" | "stop" | "cancel" | "reverse";
interface Props {
  operation: Operation;
  salaryId?: string;
  version?: number;
  month: string;
  currentMonth: string;
  amount?: string;
  entryId?: string;
  occurredLocal?: string;
  idempotencyKey?: string;
  future?: boolean;
}
const initialState: SalaryFormState = { status: "idle" };
const labels: Record<Operation, string> = {
  adjust: "Guardar ajuste",
  pay: "Confirmar pago completo",
  stop: "Dejar de repetir",
  cancel: "Anular este mes",
  reverse: "Revertir pago",
};

export function SalaryForm(props: Props) {
  const [state, action, pending] = useActionState(
    saveSalaryAction,
    initialState,
  );
  const id = useId();
  const { operation } = props;
  const destructive = ["cancel", "reverse", "stop"].includes(operation);
  return (
    <form action={action} className="editor-form">
      <input type="hidden" name="operation" value={operation} />
      {props.salaryId ? (
        <input type="hidden" name="salaryId" value={props.salaryId} />
      ) : null}
      <input type="hidden" name="version" value={props.version ?? 0} />
      {props.entryId ? (
        <input type="hidden" name="entryId" value={props.entryId} />
      ) : null}
      {props.idempotencyKey ? (
        <input
          type="hidden"
          name="idempotencyKey"
          value={props.idempotencyKey}
        />
      ) : null}
      <div className="form-grid two-columns">
        {operation === "stop" ? (
          <label>
            <span>Último mes a incluir *</span>
            <input
              type="month"
              name="month"
              defaultValue={props.month}
              min={props.currentMonth}
              required
            />
          </label>
        ) : (
          <input type="hidden" name="month" value={props.month} />
        )}
        {operation === "adjust" ? (
          <label>
            <span>Importe mensual (USD) *</span>
            <input
              name="amount"
              inputMode="decimal"
              defaultValue={props.amount}
              required
              aria-describedby={`${id}-amount-help`}
            />
            <small id={`${id}-amount-help`}>
              Sin separadores de miles. Podés usar coma o punto decimal.
            </small>
          </label>
        ) : null}
        {operation === "adjust" ? (
          props.future ? (
            <input type="hidden" name="scope" value="RECURRING" />
          ) : (
            <label>
              <span>Aplicar ajuste *</span>
              <select name="scope" defaultValue="MONTH">
                <option value="MONTH">Solo este mes</option>
                <option value="RECURRING">Desde este mes en adelante</option>
              </select>
            </label>
          )
        ) : null}
        {operation === "pay" ? (
          <>
            <label>
              <span>Fecha y hora del pago *</span>
              <input
                type="datetime-local"
                name="occurredLocal"
                defaultValue={props.occurredLocal}
                max={props.occurredLocal}
                required
              />
            </label>
            <label>
              <span>Medio de pago *</span>
              <select name="paymentMethod" defaultValue="TRANSFER">
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
                <option value="OTHER">Otro</option>
              </select>
            </label>
          </>
        ) : null}
        {operation === "cancel" || operation === "reverse" ? (
          <label>
            <span>Motivo *</span>
            <textarea
              name="reason"
              minLength={3}
              maxLength={300}
              required
              rows={2}
            />
          </label>
        ) : null}
      </div>
      {operation === "adjust" ? (
        <p>
          {props.future
            ? "El nuevo importe se aplicará desde el próximo mes. Los meses anteriores conservan su importe."
            : "Un aumento permanente reemplaza los importes pendientes desde este mes y cualquier aumento futuro programado. Los meses pagados se conservan."}
        </p>
      ) : null}
      {operation === "pay" ? (
        <p>
          Se registrará el pago completo de USD {props.amount} y un único egreso
          en Finanzas.
        </p>
      ) : null}
      {operation === "stop" ? (
        <p>
          El último mes se incluye. Los sueldos ya generados y las deudas se
          conservan.
        </p>
      ) : null}
      {operation === "cancel" ? (
        <p>
          Este mes quedará anulado y fuera de los totales. El sueldo seguirá
          repitiéndose en los próximos meses.
        </p>
      ) : null}
      {operation === "reverse" ? (
        <p>
          Se creará un movimiento compensatorio en caja y el sueldo volverá a
          pendiente. Después podrás ajustar el importe y registrar el pago
          correcto.
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="form-actions">
        <Button
          type="submit"
          loading={pending}
          variant={destructive ? "danger" : "primary"}
        >
          {pending ? "Guardando…" : labels[operation]}
        </Button>
      </div>
    </form>
  );
}
