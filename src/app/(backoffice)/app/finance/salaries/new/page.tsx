import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Page, PageHeader } from "@/components/patterns/page";
import { requireRole } from "@/modules/identity/application/authorization";
import { SalaryCreateForm } from "@/modules/salaries/ui/salary-create-form";
import styles from "@/modules/salaries/ui/salary-create-form.module.css";
import { getBusinessMonthKey } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Agregar sueldo" };
export default async function NewSalaryPage() {
  await requireRole("ADMIN");
  const month = getBusinessMonthKey(new Date());
  return (
    <Page size="narrow">
      <Link href="/app/finance/salaries" className={styles.backLink}>
        <ArrowLeftIcon aria-hidden size={16} />
        Sueldos
      </Link>
      <PageHeader
        title="Agregar sueldo"
        description="Definí el importe mensual y desde cuándo se repite."
      />
      <SalaryCreateForm currentMonth={month} idempotencyKey={randomUUID()} />
    </Page>
  );
}
