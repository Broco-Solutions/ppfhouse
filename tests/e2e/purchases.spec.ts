import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

const categoryName = "Compras E2E";
const itemName = "PPF Compra E2E";
const supplierName = "Proveedor E2E";
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
      path: `${process.env.FE_EVIDENCE_DIR}/purchase-detail-${name}.png`,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
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
    const purchases = await prisma.purchase.findMany({
      where: { supplier: { name: supplierName } },
      select: { id: true },
    });
    const purchaseIds = purchases.map((purchase) => purchase.id);
    const purchaseItems = await prisma.purchaseItem.findMany({
      where: { purchaseId: { in: purchaseIds } },
      select: { id: true, itemId: true },
    });
    const itemIds = [...new Set(purchaseItems.map((item) => item.itemId))];
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        OR: [
          { purchaseItemId: { in: purchaseItems.map((item) => item.id) } },
          { itemId: { in: itemIds } },
        ],
      },
      select: { id: true },
    });
    await prisma.idempotencyKey.deleteMany({
      where: {
        OR: [
          { resultReference: { in: purchaseIds } },
          { resultReference: { in: movements.map((movement) => movement.id) } },
        ],
      },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { reversalOfId: { not: null }, itemId: { in: itemIds } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { itemId: { in: itemIds } },
    });
    const financial = await prisma.financialEntry.findMany({
      where: {
        OR: [
          { purchaseId: { in: purchaseIds } },
          { reversalOf: { purchaseId: { in: purchaseIds } } },
        ],
      },
      select: { id: true, reversalOfId: true },
    });
    await prisma.financialEntry.deleteMany({
      where: {
        id: {
          in: financial
            .filter((entry) => entry.reversalOfId)
            .map((entry) => entry.id),
        },
      },
    });
    await prisma.financialEntry.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    });
    await prisma.purchaseItem.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    });
    await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { name: itemName },
      select: { id: true },
    });
    const inventoryIds = inventoryItems.map((item) => item.id);
    await prisma.purchasePresentation.deleteMany({
      where: { itemId: { in: inventoryIds } },
    });
    await prisma.inventoryItem.deleteMany({
      where: { id: { in: inventoryIds } },
    });
    await prisma.inventoryCategory.deleteMany({
      where: { name: categoryName },
    });
    await prisma.supplier.deleteMany({ where: { name: supplierName } });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(async () => {
  await cleanup();
  const prisma = createTestPrisma();
  try {
    const category = await prisma.inventoryCategory.create({
      data: { name: categoryName },
    });
    const item = await prisma.inventoryItem.create({
      data: {
        categoryId: category.id,
        name: itemName,
        sku: "BUY-E2E",
        baseUnit: "meter",
        minimumStock: "5",
      },
    });
    await prisma.purchasePresentation.create({
      data: { itemId: item.id, name: "Rollo 15 m", factorToBase: "15" },
    });
  } finally {
    await prisma.$disconnect();
  }
});
test.afterAll(cleanup);

test("ADMIN posts one purchase into stock and cash while STAFF is denied", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page, e2eUsers.admin);
  await page.getByRole("link", { name: "Compras", exact: true }).click();
  await page.getByRole("link", { name: "Proveedores" }).click();
  await page.getByLabel("Nombre *").fill(supplierName);
  await page.getByRole("button", { name: "Agregar proveedor" }).click();
  await expect(page.getByText(supplierName)).toBeVisible();
  await page.getByRole("link", { name: "← Compras" }).click();
  await page.getByRole("link", { name: "Nueva compra" }).click();
  await page.getByLabel("Proveedor *").selectOption({ label: supplierName });
  await page.getByLabel("Artículo *").selectOption({ label: itemName });
  await page.getByLabel("Presentación *").selectOption({ label: "Rollo 15 m" });
  await page.getByLabel("Cantidad *").fill("2");
  await page.getByLabel("Costo unitario USD *").fill("600");
  await page.getByRole("button", { name: "Registrar compra" }).click();
  await expect(
    page.getByText("Compra registrada: stock y egreso se actualizaron juntos."),
  ).toBeVisible();
  await expect(page.getByText("+30.000 m")).toBeVisible();
  await expect(page.getByText("Egreso USD 1200.00")).toBeVisible();
  await expect(page).toHaveTitle(/Detalle de compra/);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await captureEvidence(page);
  await page.goto("/app/purchases/new");
  await page.getByLabel("Proveedor *").selectOption({ label: supplierName });
  await page.getByLabel("Artículo *").selectOption({ label: itemName });
  await page.getByLabel("Cantidad *").fill("1");
  await page.getByLabel("Moneda de compra").selectOption("ARS");
  await page.getByLabel("Cotización ARS/USD *").fill("1560");
  await page.getByLabel("Costo unitario ARS *").fill("780000");
  await page.getByRole("button", { name: "Registrar compra" }).click();
  await expect(page.getByText("Egreso USD 500.00")).toBeVisible();
  const prisma = createTestPrisma();
  try {
    const purchase = await prisma.purchase.findFirstOrThrow({
      where: { supplier: { name: supplierName }, sourceCurrency: "ARS" },
      include: { items: true },
    });
    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { name: itemName },
    });
    const entry = await prisma.financialEntry.findUniqueOrThrow({
      where: { purchaseId: purchase.id },
    });
    expect(purchase.totalUsd.toFixed(2)).toBe("500.00");
    expect(purchase.sourceTotal.toFixed(2)).toBe("780000.00");
    expect(purchase.items[0]?.sourceUnitCost.toFixed(2)).toBe("780000.00");
    expect(entry.amountUsd.toFixed(2)).toBe("500.00");
    expect(item.currentStock.toFixed(3)).toBe("31.000");
  } finally {
    await prisma.$disconnect();
  }
  await page.getByRole("button", { name: "Cerrar sesión" }).click();

  await login(page, e2eUsers.staff);
  await expect(
    page.getByRole("link", { name: "Compras", exact: true }),
  ).toHaveCount(0);
  await page.goto("/app/purchases");
  await expect(page.getByText("403")).toBeVisible();
});
