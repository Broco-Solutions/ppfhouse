"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { FormActions, FormGrid, FormSection } from "@/components/patterns/page";
import { Button, buttonClassName } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/status";
import {
  saveSalaryAction,
  type SalaryFormState,
} from "@/modules/salaries/application/actions";

import { formatSalaryMonth } from "./format";
import styles from "./salary-create-form.module.css";

const initialState: SalaryFormState = { status: "idle" };

export function SalaryCreateForm({
  currentMonth,
  idempotencyKey,
}: {
  currentMonth: string;
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState(
    saveSalaryAction,
    initialState,
  );
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const hasPastMonths =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
    month >= "2000-01" &&
    month < currentMonth;
  const monthCount = hasPastMonths
    ? (Number(currentMonth.slice(0, 4)) - Number(month.slice(0, 4))) * 12 +
      Number(currentMonth.slice(5)) -
      Number(month.slice(5)) +
      1
    : 1;

  return (
    <form action={action} className={styles.form} aria-busy={pending}>
      <input type="hidden" name="operation" value="create" />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <FormSection title="Datos del sueldo">
        <FormGrid className={styles.fields}>
          <Field
            className={styles.fullWidth}
            label="Nombre de la persona"
            description="La persona no necesita tener una cuenta en el sistema."
            required
          >
            <Input
              name="name"
              autoComplete="name"
              placeholder="Nombre y apellido"
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <Field
            label="Importe mensual (USD)"
            description="Sin separadores de miles. Podés usar coma o punto decimal."
            required
          >
            <Input
              name="amount"
              inputMode="decimal"
              placeholder="Ej. 850"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </Field>
          <Field
            label="Mes de inicio"
            description="Primer mes al que corresponde el sueldo."
            required
          >
            <Input
              type="month"
              name="month"
              min="2000-01"
              max={currentMonth}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              required
            />
          </Field>
        </FormGrid>
      </FormSection>

      <aside className={styles.recurrence} aria-label="Repetición mensual">
        <ArrowClockwiseIcon aria-hidden size={20} />
        <div>
          <strong>Se repite todos los meses</strong>
          <p>Este sueldo se repetirá cada mes hasta que lo desactives.</p>
          <p
            className={styles.periodNotice}
            aria-live="polite"
            aria-atomic="true"
          >
            {hasPastMonths
              ? `Se cargarán ${monthCount} sueldos pendientes de pagar, desde ${formatSalaryMonth(month)} hasta ${formatSalaryMonth(currentMonth)}, inclusive.`
              : "Se cargará el sueldo de este mes como pendiente de pagar."}
          </p>
        </div>
      </aside>

      {state.status === "error" ? (
        <Alert intent="danger" title="No pudimos agregar el sueldo">
          {state.message}
        </Alert>
      ) : null}

      <FormActions>
        <Link
          href="/app/finance/salaries"
          className={buttonClassName("secondary", "lg")}
        >
          Cancelar
        </Link>
        <Button type="submit" size="lg" loading={pending}>
          {pending ? "Guardando…" : "Agregar sueldo"}
        </Button>
      </FormActions>
    </form>
  );
}
