import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

const clientName = "Finanzas E2E Cliente";
let clientId = "";
let vehicleId = "";
let caseId = "";
const evidenceViewports = [
  ["1440x900", 1440, 900],
  ["1280x800", 1280, 800],
  ["1024x768", 1024, 768],
  ["820x1180", 820, 1180],
  ["768x1024", 768, 1024],
  ["390x844", 390, 844],
] as const;

async function captureEvidence(page: Page) {
  if (!process.env.FE_EVIDENCE_DIR) return;
  for (const [name, width, height] of evidenceViewports) {
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
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `${process.env.FE_EVIDENCE_DIR}/finance-case-${name}.png`,
    });
  }
}

async function login(
  page: Page,
  user: (typeof e2eUsers)[keyof typeof e2eUsers],
) {
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(user.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function cleanup() {
  const prisma = createTestPrisma();
  try {
    const clients = await prisma.client.findMany({
      where: { displayName: clientName },
      select: { id: true },
    });
    const ids = clients.map((client) => client.id);
    const cases = await prisma.serviceCase.findMany({
      where: { clientId: { in: ids } },
      select: { id: true },
    });
    const caseIds = cases.map((item) => item.id);
    const entries = await prisma.financialEntry.findMany({
      where: { serviceCaseId: { in: caseIds } },
      select: { id: true },
    });
    await prisma.idempotencyKey.deleteMany({
      where: { resultReference: { in: entries.map((entry) => entry.id) } },
    });
    await prisma.financialEntry.deleteMany({
      where: { serviceCaseId: { in: caseIds } },
    });
    await prisma.serviceCaseAmountRevision.deleteMany({
      where: { serviceCaseId: { in: caseIds } },
    });
    await prisma.serviceCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.vehicle.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.client.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(async () => {
  await cleanup();
  const prisma = createTestPrisma();
  try {
    clientId = (
      await prisma.client.create({ data: { displayName: clientName } })
    ).id;
    vehicleId = (
      await prisma.vehicle.create({
        data: { clientId, brand: "Porsche", model: "911", year: 2026 },
      })
    ).id;
    caseId = (
      await prisma.serviceCase.create({
        data: { clientId, vehicleId, origin: "DIRECT_APPOINTMENT" },
      })
    ).id;
  } finally {
    await prisma.$disconnect();
  }
});

test.afterAll(cleanup);

test("ADMIN sets an agreed amount and records a deposit without operational state", async ({
  page,
}) => {
  await login(page, e2eUsers.admin);
  await page.goto(`/app/finance/cases/${caseId}`);
  await expect(
    page.locator('[data-money-field][data-hydrated="true"]').first(),
  ).toBeVisible();
  await expect(page.getByText("Importe por definir")).toBeVisible();
  await page.getByLabel("Nuevo importe (USD) *").fill("1000");
  await page.getByLabel("Motivo *").fill("Alcance acordado E2E");
  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect(page.getByText("Importe acordado actualizado.")).toBeVisible();
  await page.getByRole("link", { name: "Registrar cobro" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/app/finance/new\\?caseId=${caseId}$`),
  );
  await expect(
    page.locator('[data-money-field][data-hydrated="true"]'),
  ).toBeVisible();
  const paymentAmount = page.getByLabel("Importe (USD) *");
  await paymentAmount.fill("250");
  await expect(paymentAmount).toHaveValue("250");
  await page.getByLabel("Método").selectOption("TRANSFER");
  await expect(paymentAmount).toHaveValue("250");
  await page.getByRole("button", { name: "Registrar movimiento" }).click();
  await expect(
    page.getByText(
      "Movimiento registrado sin modificar la agenda ni el trabajo.",
    ),
  ).toBeVisible();
  if (process.env.FE_EVIDENCE_DIR) {
    for (const [name, width, height] of evidenceViewports) {
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
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `${process.env.FE_EVIDENCE_DIR}/finance-list-${name}.png`,
      });
    }
  }
  await page.getByRole("link", { name: "Ver saldo" }).click();
  await expect(page.getByText("USD 750.00")).toBeVisible();
  await expect(page.getByText("USD 250.00", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await captureEvidence(page);
});

test("ADMIN records ARS and sees the canonical USD equivalent", async ({
  page,
}) => {
  await login(page, e2eUsers.admin);
  await page.goto(`/app/finance/new?caseId=${caseId}`);
  const currency = page.getByLabel("Moneda");
  await currency.selectOption("ARS");
  await expect(currency).toHaveValue("ARS");
  await expect(page.getByLabel("Cotización ARS/USD *")).toBeVisible();
  await currency.selectOption("USD");
  await expect(currency).toHaveValue("USD");
  await expect(page.getByLabel("Cotización ARS/USD *")).toBeHidden();
  await currency.selectOption("ARS");
  await page.getByLabel("Importe (ARS) *").fill("780000");
  await page.getByLabel("Cotización ARS/USD *").fill("1560");
  await expect(page.getByText("≈ USD 500,00")).toBeVisible();
  await page.setViewportSize({ width: 640, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Registrar movimiento" }).click();
  await expect(page.getByText("+ USD 500.00", { exact: true })).toBeVisible();
  await expect(
    page.getByText("ARS 780000.00 · 1 USD = ARS 1560"),
  ).toBeVisible();
});

test("STAFF is denied finance routes and receives no financial navigation", async ({
  page,
}) => {
  await login(page, e2eUsers.staff);
  await expect(page.getByRole("link", { name: "Finanzas" })).toHaveCount(0);
  await page.goto("/app/finance");
  await expect(page.getByText("403")).toBeVisible();
  await page.goto(`/app/finance/cases/${caseId}`);
  await expect(page.getByText("403")).toBeVisible();
});
