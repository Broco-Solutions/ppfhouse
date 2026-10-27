"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/modules/identity/application/authorization";
import { reverseFinancialEntry } from "@/modules/finance/application/finance-service";
import {
  adjustSalary,
  cancelSalaryMonth,
  createSalary,
  paySalary,
  stopSalary,
} from "./salary-service";

export interface SalaryFormState {
  status: "idle" | "error";
  message?: string;
}

export async function saveSalaryAction(
  _state: SalaryFormState,
  formData: FormData,
): Promise<SalaryFormState> {
  const session = await requireRole("ADMIN");
  const data = Object.fromEntries(formData.entries());
  let salaryId = typeof data.salaryId === "string" ? data.salaryId : "";
  try {
    switch (data.operation) {
      case "create":
        salaryId = (await createSalary(data, session.user)).id;
        break;
      case "adjust":
        await adjustSalary(data, session.user);
        break;
      case "pay":
        await paySalary(data, session.user);
        break;
      case "stop":
        await stopSalary(data, session.user);
        break;
      case "cancel":
        await cancelSalaryMonth(data, session.user);
        break;
      case "reverse": {
        const reverse = z
          .object({
            entryId: z.string().uuid(),
            salaryId: z.string().uuid(),
            reason: z
              .string()
              .trim()
              .min(3, "Indicá el motivo de la reversión.")
              .max(300),
          })
          .parse(data);
        await reverseFinancialEntry(
          { entryId: reverse.entryId, reason: reverse.reason },
          session.user,
        );
        break;
      }
      default:
        throw new Error("INVALID_OPERATION");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      SALARY_CONFLICT:
        "El sueldo cambió desde que abriste esta pantalla. Recargá para ver los datos actuales.",
      SALARY_NOT_PENDING:
        "Este mes ya está pagado o anulado. Recargá la pantalla antes de continuar.",
      SALARY_INACTIVE: "Ese mes está fuera del período activo del sueldo.",
      SALARY_FUTURE_MONTH:
        "Solo podés operar meses hasta el actual; los aumentos pueden programarse para el próximo mes.",
      SALARY_INVALID_END:
        "El último mes debe ser el actual o uno posterior. Las deudas anteriores se conservan.",
      SALARY_FUTURE_PAYMENT:
        "La fecha de un pago realizado no puede estar en el futuro.",
      IDEMPOTENCY_CONFLICT:
        "Los datos cambiaron después del primer envío. Recargá el formulario para intentarlo de nuevo.",
    };
    return {
      status: "error",
      message:
        error instanceof z.ZodError
          ? error.issues[0]?.message
          : (messages[message] ??
            "No pudimos guardar el sueldo. Revisá los datos e intentá nuevamente."),
    };
  }
  revalidatePath("/app");
  revalidatePath("/app/finance");
  revalidatePath("/app/finance/salaries", "layout");
  // Construct destinations only from validated identifiers, never a submitted return URL.
  if (!z.string().uuid().safeParse(salaryId).success)
    redirect("/app/finance/salaries?saved=1");
  const month =
    typeof data.month === "string" && /^\d{4}-\d{2}$/.test(data.month)
      ? `&month=${data.month}`
      : "";
  redirect(`/app/finance/salaries/${salaryId}?saved=1${month}`);
}
