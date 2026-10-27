"use client";

import {
  StatePage,
  stateActionClassName,
} from "@/components/patterns/state-page";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="es-AR">
      <body>
        <StatePage
          action={
            <button
              className={stateActionClassName}
              type="button"
              onClick={reset}
            >
              Reintentar
            </button>
          }
          code="Error global"
          description="Reintentá. Si persiste, contactá al responsable técnico."
          title="PPF HOUSE no pudo iniciar"
        />
      </body>
    </html>
  );
}
