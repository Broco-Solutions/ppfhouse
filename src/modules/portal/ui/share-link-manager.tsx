"use client";

import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/ui/overlays";
import { PasswordInput } from "@/components/ui/password-input";
import {
  createShareLinkAction,
  regenerateShareLinkAction,
  revokeShareLinkAction,
  updateShareLinkPasswordAction,
  type ShareLinkActionResult,
} from "@/modules/portal/application/actions";
import { formatBusinessDateTime } from "@/shared/date-time/business-time";

interface LinkSummary {
  id: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastAccessAt: Date | null;
  passwordProtected: boolean;
  createdAt: Date;
}

export function ShareLinkManager({
  clientId,
  initialLink,
}: {
  clientId: string;
  initialLink: LinkSummary | null;
}) {
  const [result, setResult] = useState<ShareLinkActionResult>();
  const [password, setPassword] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [pending, startTransition] = useTransition();
  const active = initialLink && !initialLink.revokedAt;

  function run(operation: () => Promise<ShareLinkActionResult>) {
    setResult(undefined);
    startTransition(async () => setResult(await operation()));
  }

  return (
    <section className="portal-admin-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Acceso privado</p>
          <h2>Portal del cliente</h2>
        </div>
        <span>{active ? "Activo" : "Sin acceso"}</span>
      </div>
      <p className="section-intro">
        Comparte historial y fotos publicadas. Nunca expone notas, precios ni
        información de otros clientes.
      </p>

      {initialLink ? (
        <dl className="portal-link-status">
          <div>
            <dt>Protección</dt>
            <dd>
              {initialLink.passwordProtected ? "Con contraseña" : "Sólo link"}
            </dd>
          </div>
          <div>
            <dt>Vencimiento</dt>
            <dd>
              {initialLink.expiresAt
                ? formatBusinessDateTime(initialLink.expiresAt)
                : "Sin vencimiento"}
            </dd>
          </div>
          <div>
            <dt>Último acceso</dt>
            <dd>
              {initialLink.lastAccessAt
                ? formatBusinessDateTime(initialLink.lastAccessAt)
                : "Todavía no ingresó"}
            </dd>
          </div>
        </dl>
      ) : null}

      {!initialLink ? (
        <div className="portal-link-form">
          <label className="field-group">
            <span>Contraseña opcional</span>
            <PasswordInput
              value={password}
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          <label className="field-group">
            <span>Vence al finalizar el día (opcional)</span>
            <input
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={pending}
            onClick={() =>
              run(() =>
                createShareLinkAction({ clientId, password, expiresOn }),
              )
            }
          >
            {pending ? "Creando…" : "Crear link privado"}
          </button>
        </div>
      ) : (
        <div className="portal-link-actions">
          <label className="field-group">
            <span>Nueva contraseña</span>
            <PasswordInput
              value={password}
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Vacío para quitarla"
            />
          </label>
          <button
            className="ghost-button"
            disabled={pending}
            onClick={() =>
              run(() => updateShareLinkPasswordAction(clientId, password))
            }
          >
            Guardar contraseña
          </button>
          <button
            className="ghost-button"
            disabled={pending}
            onClick={() => run(() => regenerateShareLinkAction(clientId))}
          >
            {active ? "Regenerar link" : "Reactivar con link nuevo"}
          </button>
          {active ? (
            <ConfirmDialog
              confirmLabel="Revocar acceso"
              description="El cliente perderá acceso inmediatamente. El historial y las fotos no se eliminan."
              onConfirm={() => run(() => revokeShareLinkAction(clientId))}
              title="¿Revocar el acceso privado?"
              triggerLabel={pending ? "Procesando…" : "Revocar acceso"}
            />
          ) : null}
        </div>
      )}

      {result ? (
        <div
          className={result.ok ? "success-banner" : "error-banner"}
          role="status"
        >
          <p>{result.message}</p>
          {result.ok && result.url ? (
            <div className="share-url-row">
              <input
                aria-label="Link privado generado"
                readOnly
                value={result.url}
              />
              <button
                className="ghost-button"
                onClick={() => navigator.clipboard.writeText(result.url!)}
              >
                Copiar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
