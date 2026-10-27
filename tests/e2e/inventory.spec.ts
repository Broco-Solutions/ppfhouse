import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

const categoryName = "Films E2E";
const itemName = "PPF X E2E";

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
    const items = await prisma.inventoryItem.findMany({
      where: { name: itemName },
      select: { id: true },
    });
    const ids = items.map((item) => item.id);
    const movements = await prisma.inventoryMovement.findMany({
      where: { itemId: { in: ids } },
      select: { id: true },
    });
    await prisma.idempotencyKey.deleteMany({
      where: {
        resultReference: { in: movements.map((movement) => movement.id) },
      },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { itemId: { in: ids } },
    });
    await prisma.purchasePresentation.deleteMany({
      where: { itemId: { in: ids } },
    });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: ids } } });
    await prisma.inventoryCategory.deleteMany({
      where: { name: categoryName },
    });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

test("ADMIN configures traceable PPF stock and STAFF receives only the operational projection", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page, e2eUsers.admin);
  await page
    .getByRole("link", { name: "Inventario", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Categorías" }).click();
  await page.getByLabel("Nueva categoría").fill(categoryName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText(categoryName)).toBeVisible();
  await page
    .getByRole("link", { name: "Inventario", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Nuevo artículo" }).click();
  await page.getByLabel("Categoría *").selectOption({ label: categoryName });
  await page.getByLabel("Nombre *").fill(itemName);
  await page.getByLabel("SKU").fill("PPF-X-E2E");
  await page.getByLabel("Unidad base *").selectOption("meter");
  await page.getByLabel("Stock mínimo *").fill("5");
  await page.getByLabel("Costo orientativo USD").fill("40");
  await page.getByRole("button", { name: "Crear artículo" }).click();
  await expect(page.getByRole("heading", { name: itemName })).toBeVisible();

  await page.getByLabel("Cantidad en m *").fill("30");
  await page.getByLabel("Motivo *").fill("Conteo inicial E2E");
  await page.getByRole("button", { name: "Registrar ajuste" }).click();
  await expect(
    page.getByText("Ajuste registrado con trazabilidad."),
  ).toBeVisible();
  await expect(page.getByText("30.000", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Nombre", { exact: true }).fill("Rollo 15 m");
  await page.getByLabel("Factor a m").fill("15");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText("1 = 15 m")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login(page, e2eUsers.staff);
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await page.getByPlaceholder("Artículo, SKU o categoría").fill(itemName);
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.getByRole("link", { name: new RegExp(itemName) }).click();
  await expect(page.getByText("30.000", { exact: true })).toBeVisible();
  await expect(page.getByText("Costo orientativo USD")).toHaveCount(0);
  await expect(page.getByText("Ajustar stock")).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.goto("/app/inventory/new");
  await expect(page.getByText("403")).toBeVisible();
});
