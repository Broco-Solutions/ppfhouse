import Link from "next/link";

import {
  StatePage,
  stateActionClassName,
} from "@/components/patterns/state-page";

export default function ForbiddenPage() {
  return (
    <StatePage
      action={
        <Link className={stateActionClassName} href="/app">
          Volver al inicio
        </Link>
      }
      code="403"
      description="Tu sesión es válida, pero tu rol no permite realizar esta acción."
      title="No tenés acceso a esta sección"
    />
  );
}
