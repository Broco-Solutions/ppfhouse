import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { requireUser } from "@/modules/identity/application/session";
import { recordManagerPath, type RecordKind } from "../domain/records";

export async function DeleteRecordLink({
  kind,
  id,
}: {
  kind: RecordKind;
  id: string;
}) {
  const session = await requireUser();
  if (session.user.role !== "ADMIN") return null;
  return (
    <Link
      className={buttonClassName("danger")}
      href={`${recordManagerPath(kind)}&q=${id}`}
    >
      Eliminar
    </Link>
  );
}
