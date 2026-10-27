"use client";

import { useActionState } from "react";

import { FormActions, FormGrid, FormSection } from "@/components/patterns/page";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import {
  saveClientAction,
  type FormActionState,
} from "@/modules/clients/application/actions";

import styles from "./clients.module.css";

const initialState: FormActionState = { status: "idle" };

interface ClientValues {
  id?: string;
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  instagram?: string | null;
  notes?: string | null;
}

export function ClientForm({ values = {} }: { values?: ClientValues }) {
  const [state, action, pending] = useActionState(
    saveClientAction,
    initialState,
  );

  return (
    <form action={action} className={styles.form}>
      {values.id ? <input name="id" type="hidden" value={values.id} /> : null}
      {state.message ? (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      ) : null}

      <FormSection
        description="Usá el nombre con el que el equipo reconoce al cliente."
        title="Identificación"
      >
        <FormGrid>
          <Field
            className={styles.fieldSpan}
            error={state.fields?.displayName}
            label="Nombre identificatorio"
            required
          >
            <Input
              autoFocus
              defaultValue={values.displayName}
              maxLength={120}
              name="displayName"
              required
            />
          </Field>
          <Field label="Nombre" optional>
            <Input
              autoComplete="given-name"
              defaultValue={values.firstName ?? ""}
              maxLength={80}
              name="firstName"
            />
          </Field>
          <Field label="Apellido" optional>
            <Input
              autoComplete="family-name"
              defaultValue={values.lastName ?? ""}
              maxLength={80}
              name="lastName"
            />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection
        description="Completá sólo los canales que realmente use."
        title="Contacto"
      >
        <FormGrid>
          <Field label="Teléfono" optional>
            <Input
              autoComplete="tel"
              defaultValue={values.phone ?? ""}
              name="phone"
              type="tel"
            />
          </Field>
          <Field label="WhatsApp" optional>
            <Input
              defaultValue={values.whatsapp ?? ""}
              name="whatsapp"
              type="tel"
            />
          </Field>
          <Field error={state.fields?.email} label="Email" optional>
            <Input
              autoComplete="email"
              defaultValue={values.email ?? ""}
              name="email"
              type="email"
            />
          </Field>
          <Field label="Instagram" optional>
            <Input
              defaultValue={values.instagram ?? ""}
              name="instagram"
              placeholder="@usuario"
            />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection
        description="Sólo visible para el equipo Ferraro."
        title="Contexto interno"
      >
        <Field label="Notas internas" optional>
          <Textarea
            defaultValue={values.notes ?? ""}
            maxLength={2000}
            name="notes"
            rows={5}
          />
        </Field>
      </FormSection>

      <FormActions>
        <Button loading={pending} size="lg" type="submit">
          {values.id ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </FormActions>
    </form>
  );
}
