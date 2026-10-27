import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

const categoryName = "Protección E2E";
const serviceName = "Cerámico E2E";

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
    const services = await prisma.service.findMany({
      where: { name: serviceName },
      select: { id: true },
    });
    await prisma.serviceVariant.deleteMany({
      where: { serviceId: { in: services.map((service) => service.id) } },
    });
    await prisma.service.deleteMany({
      where: { id: { in: services.map((service) => service.id) } },
    });
    await prisma.serviceCategory.deleteMany({ where: { name: categoryName } });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

test("ADMIN creates a service and a model exception; STAFF is denied", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page, e2eUsers.admin);
  await page.getByRole("link", { name: "Servicios" }).click();
  await page.getByLabel("Nueva categoría").fill(categoryName);
  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByRole("link", { name: "Nuevo servicio" }).click();
  await expect(page).toHaveURL(/\/app\/services\/new$/);
  await page.getByLabel("Categoría *").selectOption({ label: categoryName });
  await page.getByLabel("Nombre *").fill(serviceName);
  await page.getByLabel("Precio base USD").fill("450");
  await page.getByLabel("Duración estimada (min)").fill("480");
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByRole("heading", { name: serviceName })).toBeVisible();
  await page.locator("summary").filter({ hasText: "Agregar variante" }).click();
  await page.getByLabel("Tipo *").selectOption("MODEL_EXCEPTION");
  await page.getByLabel("Etiqueta *").fill("Ford Raptor");
  await page.getByLabel("Marca exacta *").fill("Ford");
  await page.getByLabel("Modelo exacto *").fill("Raptor");
  await page.getByLabel("Precio USD *").fill("720");
  await page.getByRole("button", { name: "Agregar variante" }).click();
  await expect(page.getByText("USD 720.00")).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, e2eUsers.staff);
  await expect(page.getByRole("link", { name: "Servicios" })).toHaveCount(0);
  await page.goto("/app/services");
  await expect(page.getByText("403")).toBeVisible();
});
