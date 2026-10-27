import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

const clientName = "Sofía Alvarado — E2E";

async function login(page: Page) {
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(e2eUsers.staff.email);
  await page
    .getByRole("textbox", { name: "Contraseña" })
    .fill(e2eUsers.staff.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.afterAll(async () => {
  const prisma = createTestPrisma();
  try {
    const clients = await prisma.client.findMany({
      where: { displayName: clientName },
      select: { id: true },
    });
    await prisma.vehicle.deleteMany({
      where: { clientId: { in: clients.map((client) => client.id) } },
    });
    await prisma.client.deleteMany({
      where: { id: { in: clients.map((client) => client.id) } },
    });
  } finally {
    await prisma.$disconnect();
  }
});

test("STAFF creates a client, adds a vehicle and finds it by model", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Clientes" }).first().click();
  await page.getByRole("link", { name: "Nuevo cliente" }).click();
  await page.getByLabel("Nombre identificatorio *").fill(clientName);
  await page.getByLabel("Teléfono").fill("+54 9 341 555 0198");
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page.getByRole("heading", { name: clientName })).toBeVisible();

  await page.getByLabel("Marca *").fill("Audi");
  await page.getByLabel("Modelo *").fill("RS3");
  await expect(page.getByLabel("Año")).toHaveCount(0);
  await expect(page.getByLabel("Color")).toHaveCount(0);
  await expect(page.getByLabel("Versión")).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar vehículo" }).click();
  await expect(page.getByRole("heading", { name: "Audi RS3" })).toBeVisible();

  const prisma = createTestPrisma();
  try {
    const vehicle = await prisma.vehicle.findFirstOrThrow({
      where: {
        client: { displayName: clientName },
        brand: "Audi",
        model: "RS3",
      },
    });
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        version: "Sportback",
        year: 2025,
        color: "Gris Daytona",
        vehicleClass: "SEDAN",
        notes: "Dato histórico",
      },
    });
    await page.goto(
      `/app/clients/${vehicle.clientId}/vehicles/${vehicle.id}/edit`,
    );
    await expect(page.getByLabel("Color")).toHaveCount(0);
    await page.getByLabel("Modelo *").fill("RS3 actualizado");
    await page.getByRole("button", { name: "Guardar vehículo" }).click();
    await expect(
      page.getByRole("heading", { name: "Audi RS3 actualizado" }),
    ).toBeVisible();
    const saved = await prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicle.id },
    });
    expect(saved).toMatchObject({
      model: "RS3 actualizado",
      version: "Sportback",
      year: 2025,
      color: "Gris Daytona",
      vehicleClass: "SEDAN",
      notes: "Dato histórico",
    });
  } finally {
    await prisma.$disconnect();
  }

  await page.getByRole("link", { name: "Clientes" }).first().click();
  await page.getByPlaceholder("Nombre, teléfono o vehículo").fill("RS3");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText(clientName)).toBeVisible();
  await expect(page.getByText("Audi RS3 actualizado")).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
