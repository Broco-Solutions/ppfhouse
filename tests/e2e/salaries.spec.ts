import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { getBusinessMonthKey } from "../../src/shared/date-time/business-time";
import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

const person = `Sueldos E2E ${randomUUID().slice(0, 8)}`;
const current = getBusinessMonthKey(new Date());
const previous = new Date(
  Date.UTC(Number(current.slice(0, 4)), Number(current.slice(5)) - 2, 1),
)
  .toISOString()
  .slice(0, 7);

async function login(page: Page, role: "admin" | "staff") {
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(e2eUsers[role].email);
  await page
    .getByRole("textbox", { name: "Contraseña" })
    .fill(e2eUsers[role].password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.afterAll(async () => {
  const db = createTestPrisma();
  try {
    const salaries = await db.salary.findMany({
      where: { name: person },
      select: { id: true },
    });
    const ids = salaries.map((item) => item.id);
    const entries = await db.financialEntry.findMany({
      where: { salaryMonth: { salaryId: { in: ids } } },
      select: { id: true },
    });
    await db.salaryMonth.updateMany({
      where: { salaryId: { in: ids } },
      data: { status: "PENDING", paymentEntryId: null },
    });
    await db.idempotencyKey.deleteMany({
      where: {
        resultReference: { in: [...ids, ...entries.map((item) => item.id)] },
      },
    });
    await db.financialEntry.deleteMany({
      where: { salaryMonth: { salaryId: { in: ids } }, type: "REVERSAL" },
    });
    await db.financialEntry.deleteMany({
      where: { salaryMonth: { salaryId: { in: ids } } },
    });
    await db.salaryEvent.deleteMany({ where: { salaryId: { in: ids } } });
    await db.salaryRate.deleteMany({ where: { salaryId: { in: ids } } });
    await db.salaryMonth.deleteMany({ where: { salaryId: { in: ids } } });
    await db.salary.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await db.$disconnect();
  }
});

test("ADMIN creates a recurring salary, adjusts, pays and reverses it from Finance", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/app/finance");
  const sidebar = page.getByRole("complementary", {
    name: "Navegación lateral",
  });
  await sidebar.getByRole("link", { name: "Sueldos", exact: true }).click();
  await expect(
    sidebar.getByRole("link", { name: "Sueldos", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    sidebar.getByRole("link", { name: "Finanzas", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Agregar sueldo" }).first().click();
  await page.getByLabel("Nombre de la persona").fill(person);
  await page.getByLabel("Mes de inicio").fill(previous);
  await page.getByLabel("Importe mensual").fill("1250,50");
  await page.getByRole("button", { name: "Agregar sueldo" }).click();
  await expect(page.getByRole("heading", { name: person })).toBeVisible();
  const detailUrl = page.url().split("?")[0];
  await page.getByLabel("Mes del sueldo").selectOption(current);
  await page.getByRole("button", { name: "Ver mes", exact: true }).click();
  await page
    .getByRole("link", { name: "Ajustar importe", exact: true })
    .click();
  await page.getByLabel("Importe mensual").fill("1300");
  await page.getByRole("button", { name: "Guardar ajuste" }).click();
  await expect(page.getByRole("status")).toContainText("guardaron");
  await page.getByRole("link", { name: "Registrar pago", exact: true }).click();
  await expect(page.getByLabel("Cotización ARS/USD")).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmar pago completo" }).click();
  await expect(page.getByText("Pagado", { exact: true })).toBeVisible();
  await expect(page.getByText(/USD 1300.00/)).toBeVisible();
  await page.getByRole("link", { name: "Ver en Finanzas" }).click();
  const row = page
    .locator("article")
    .filter({ hasText: `Sueldo de ${person}` });
  await row
    .getByLabel("Motivo para revertir Pago de sueldo")
    .fill("Carga de prueba incorrecta");
  await row.getByRole("button", { name: "Revertir", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Revertir", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("revertido");
  await page.goto(`${detailUrl}?month=${current}`);
  await expect(
    page.getByText("Pendiente de pagar", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Pago revertido ·/)).toBeVisible();
  await page.getByRole("link", { name: "Volver a sueldos" }).click();
  await expect(
    page.getByText(/sueldo\(s\) pendiente\(s\) de meses anteriores/),
  ).toBeVisible();
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/salaries-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("/app");
  await expect(
    page.getByText("Sueldos pendientes", { exact: true }),
  ).toBeVisible();
});

test("STAFF cannot open payroll list or creation forms", async ({ page }) => {
  await login(page, "staff");
  await expect(
    page.getByText("Sueldos pendientes", { exact: true }),
  ).toHaveCount(0);
  for (const route of [
    "/app/finance/salaries",
    "/app/finance/salaries/new",
    "/app/finance/salaries/f4dcd223-c714-499f-8466-68c5f742b01b",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: /permiso|acceso/i }),
    ).toBeVisible();
    await expect(page.getByText(person, { exact: true })).toHaveCount(0);
  }
});
