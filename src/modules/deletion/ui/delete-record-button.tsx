"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Alert } from "@/components/ui/status";
import {
  deletionConsequences,
  recordLabels,
  type RecordKind,
} from "../domain/records";
import { deleteRecordAction, type DeleteState } from "./actions";

export function DeleteRecordButton({
  kind,
  id,
  label,
}: {
  kind: RecordKind;
  id: string;
  label: string;
}) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    deleteRecordAction,
    {},
  );
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <ConfirmButton
          disabled={pending}
          message={`¿Eliminar definitivamente este ${recordLabels[kind]}: «${label}»? Esta acción no se puede deshacer. ${deletionConsequences[kind] ?? ""} Si tiene registros asociados, primero deberás eliminarlos.`}
        >
          {pending ? "Eliminando…" : "Eliminar"}
        </ConfirmButton>
      </form>
      {state.error ? (
        <Alert intent="danger" title="No se pudo eliminar">
          {state.error}
        </Alert>
      ) : null}
      {state.dependencies?.length ? (
        <ul>
          {state.dependencies.map((dependency, index) => (
            <li key={`${dependency.href}-${index}`}>
              <Link href={dependency.href}>
                {dependency.label} ({dependency.count})
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
