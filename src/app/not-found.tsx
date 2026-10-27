import Link from "next/link";

import {
  StatePage,
  stateActionClassName,
} from "@/components/patterns/state-page";

export default function NotFoundPage() {
  return (
    <StatePage
      action={
        <Link className={stateActionClassName} href="/app">
          Volver al inicio
        </Link>
      }
      code="404"
      description="La dirección puede ser incorrecta o el contenido ya no está disponible."
      title="Esta página no existe"
    />
  );
}
