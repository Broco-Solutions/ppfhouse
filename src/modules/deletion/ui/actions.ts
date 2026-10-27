"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/modules/identity/application/authorization";
import { logger } from "@/infrastructure/logging/logger";
import { deleteRecord, DeletionError } from "../application/delete-record";
import {
  recordManagerPath,
  recordKinds,
  type DeletionDependency,
} from "../domain/records";

export interface DeleteState {
  error?: string;
  dependencies?: DeletionDependency[];
}
export async function deleteRecordAction(
  _previous: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const session = await requireRole("ADMIN");
  const input = z
    .object({ kind: z.enum(recordKinds), id: z.uuid() })
    .safeParse({ kind: formData.get("kind"), id: formData.get("id") });
  if (!input.success) return { error: "El registro indicado no es válido." };
  try {
    await deleteRecord(input.data.kind, input.data.id, session.user.id);
  } catch (error) {
    if (error instanceof DeletionError)
      return { error: error.message, dependencies: error.dependencies };
    logger.error("record_deletion_failed", {
      kind: input.data.kind,
      recordId: input.data.id,
    });
    return { error: "No se pudo eliminar el registro. Volvé a intentar." };
  }
  revalidatePath("/app", "layout");
  redirect(`${recordManagerPath(input.data.kind)}&deleted=1`);
}
