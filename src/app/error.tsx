"use client";

import { useEffect } from "react";

import {
  StatePage,
  stateActionClassName,
} from "@/components/patterns/state-page";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route error", { digest: error.digest });
  }, [error]);

  return (
    <StatePage
      action={
        <button className={stateActionClassName} type="button" onClick={reset}>
          Reintentar
        </button>
      }
      code="Error recuperable"
      description="Intentá nuevamente. Si el problema continúa, avisá a un administrador."
      title="No pudimos cargar esta sección"
    />
  );
}
