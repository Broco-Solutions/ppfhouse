"use client";

import { useActionState } from "react";

import { FormActions, FormGrid, FormSection } from "@/components/patterns/page";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import styles from "@/modules/clients/ui/clients.module.css";
import {
  resetUserPasswordAction,
  type FormActionState,
} from "@/modules/users/application/actions";

const initialState: FormActionState = { status: "idle" };

export function PasswordResetForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(
    resetUserPasswordAction,
    initialState,
  );

  return (
    <form action={action} className={styles.form}>
      <input name="id" type="hidden" value={userId} />
      {state.message ? (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      ) : null}
      <FormSection
        description="Reemplaza la contraseña actual y cierra todas las sesiones abiertas del usuario."
        title="Restablecer contraseña"
      >
        <FormGrid>
          <Field
            error={state.fields?.password}
            label="Nueva contraseña"
            required
          >
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
            label="Repetir nueva contraseña"
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
      <FormActions>
        <Button loading={pending} type="submit" variant="secondary">
          Restablecer contraseña
        </Button>
      </FormActions>
    </form>
  );
}
