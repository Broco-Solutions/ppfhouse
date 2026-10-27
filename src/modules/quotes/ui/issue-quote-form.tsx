"use client";

import { useActionState } from "react";

import { ConfirmButton } from "@/components/ui/confirm-button";
import styles from "./quotes.module.css";
import {
  issueQuoteAction,
  type QuoteFormState,
} from "@/modules/quotes/application/actions";

const initialState: QuoteFormState = { status: "idle" };

export function IssueQuoteForm({
  quoteId,
  buttonClassName,
}: {
  quoteId: string;
  buttonClassName?: string;
}) {
  const [state, action, pending] = useActionState(
    issueQuoteAction,
    initialState,
  );

  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="quoteId" value={quoteId} />
      {state.message ? (
        <p className={styles.issueError} role="alert">
          {state.message}
        </p>
      ) : null}
      <ConfirmButton
        variant="primary"
        className={buttonClassName}
        disabled={pending}
        message="¿Emitir este presupuesto? Su contenido quedará bloqueado y se generará el PDF definitivo."
      >
        {pending ? "Emitiendo presupuesto…" : "Emitir presupuesto"}
      </ConfirmButton>
    </form>
  );
}
