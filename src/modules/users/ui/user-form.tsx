"use client";

import { useActionState } from "react";

import { FormActions, FormGrid, FormSection } from "@/components/patterns/page";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import styles from "@/modules/clients/ui/clients.module.css";
import type { UserRole } from "@/modules/identity/domain/roles";
import {
  saveUserAction,
  type FormActionState,
} from "@/modules/users/application/actions";

const initialState: FormActionState = { status: "idle" };

interface UserValues {
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
}

export function UserForm({
  values = {},
  roleLocked = false,
}: {
  values?: UserValues;
  roleLocked?: boolean;
}) {
  const [state, action, pending] = useActionState(saveUserAction, initialState);

  return (
    <form action={action} className={styles.form}>
      {values.id ? <input name="id" type="hidden" value={values.id} /> : null}
      {roleLocked ? (
        <input name="role" type="hidden" value={values.role} />
      ) : null}
      {state.message ? (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      ) : null}

      <FormSection
        description="El email es el usuario con el que se inicia sesión."
        title="Datos de acceso"
      >
        <FormGrid>
          <Field error={state.fields?.name} label="Nombre" required>
            <Input
              autoComplete="off"
              autoFocus={!values.id}
              defaultValue={values.name}
              maxLength={120}
              name="name"
              required
            />
          </Field>
          <Field error={state.fields?.email} label="Email" required>
            <Input
              autoComplete="off"
              defaultValue={values.email}
              maxLength={160}
              name="email"
              required
              type="email"
            />
          </Field>
          <Field
            description={
              roleLocked
                ? "No podés cambiar tu propio rol."
                : "ADMIN accede a finanzas, compras, presupuestos y administración."
            }
            error={state.fields?.role}
            label="Rol"
            required
          >
            <Select
              defaultValue={values.role ?? "STAFF"}
              disabled={roleLocked}
              name={roleLocked ? undefined : "role"}
            >
              <option value="STAFF">STAFF</option>
              <option value="ADMIN">ADMIN</option>
            </Select>
          </Field>
        </FormGrid>
      </FormSection>

      {values.id ? null : (
        <FormSection
          description="Mínimo 12 caracteres. Compartila con la persona por un canal seguro."
          title="Contraseña inicial"
        >
          <FormGrid>
            <Field error={state.fields?.password} label="Contraseña" required>
              <PasswordInput
                autoComplete="new-password"
                maxLength={128}
                minLength={12}
                name="password"
                required
              />
            </Field>
            <Field
              error={state.fields?.passwordConfirmation}
              label="Repetir contraseña"
              required
            >
              <PasswordInput
                autoComplete="new-password"
                maxLength={128}
                minLength={12}
                name="passwordConfirmation"
                required
              />
            </Field>
          </FormGrid>
        </FormSection>
      )}

      <FormActions>
        <Button loading={pending} size="lg" type="submit">
          {values.id ? "Guardar cambios" : "Crear usuario"}
        </Button>
      </FormActions>
    </form>
  );
}
