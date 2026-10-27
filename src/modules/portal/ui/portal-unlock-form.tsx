"use client";

import { useActionState } from "react";

import {
  unlockPortalAction,
  type PortalUnlockState,
} from "@/modules/portal/application/actions";
import { PasswordInput } from "@/components/ui/password-input";

const initialState: PortalUnlockState = {};

export function PortalUnlockForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    unlockPortalAction,
    initialState,
  );
  return (
    <form action={action} className="portal-unlock-form">
      <input type="hidden" name="token" value={token} />
      <label>
        <span>Contraseña</span>
        <PasswordInput
          name="password"
          required
          maxLength={128}
          autoComplete="current-password"
          autoFocus
        />
      </label>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="portal-primary-button" disabled={pending}>
        {pending ? "Verificando…" : "Ingresar a mi historial"}
      </button>
    </form>
  );
}
