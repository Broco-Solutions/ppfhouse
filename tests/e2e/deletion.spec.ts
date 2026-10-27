import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

let clientId = "";
let vehicleId = "";
const label = `Borrado E2E ${randomUUID()}`;
async function login(page: Page, role: "admin" | "staff") {
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(e2eUsers[role].email);
  await page
    .getByRole("textbox", { name: "Contraseña" })
    .fill(e2eUsers[role].password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15000 });
}
test.beforeAll(async () => {
  const prisma = createTestPrisma();
  try {
    const client = await prisma.client.create({
      data: { displayName: label, active: false, archivedAt: new Date() },
    });
    clientId = client.id;
    vehicleId = (
      await prisma.vehicle.create({
        data: { clientId, brand: "Ford", model: "Fiesta" },
      })
    ).id;
  } finally {
    await prisma.$disconnect();
  }
});
test.afterAll(async () => {
  const prisma = createTestPrisma();
  try {
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.client.deleteMany({ where: { id: clientId } });
  } finally {
    await prisma.$disconnect();
  }
});

test("staff cannot see permanent deletion or access its management route", async ({
  page,
}) => {
  await login(page, "staff");
  await page.goto(`/app/clients/${clientId}`);
  await expect(page.getByRole("link", { name: "Eliminar" })).toHaveCount(0);
  await page.goto("/app/admin/records");
  await expect(
    page.getByRole("heading", { name: "No tenés acceso a esta sección" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
});

test("admin confirms actual deletion, sees dependencies and can remove an archived client in order", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto(`/app/clients/${clientId}`);
  const header = page.locator("main header").first();
  const remove = header.getByRole("link", { name: "Eliminar", exact: true });
  const edit = header.getByRole("link", { name: "Editar", exact: true });
  const restore = header.getByRole("button", {
    name: "Restaurar",
    exact: true,
  });
  await expect(remove).toBeVisible();
  const boxes = await Promise.all([
    remove.boundingBox(),
    edit.boundingBox(),
    restore.boundingBox(),
  ]);
  expect(boxes[0]?.height).toBe(boxes[1]?.height);
  expect(boxes[0]?.height).toBe(boxes[2]?.height);
  expect(boxes[0]?.y).toBe(boxes[1]?.y);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(remove).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/admin");
  await page
    .getByRole("article")
    .filter({ hasText: "Eliminar registros" })
    .getByRole("link", { name: "Ver registros" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Eliminar registros", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Buscar", exact: true })
    .fill(clientId);
  await page
    .getByRole("main")
    .getByRole("button", { name: "Buscar", exact: true })
    .click();
  await expect(
    page.getByRole("article").filter({ hasText: label }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("no se puede deshacer");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await dialog.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "registros asociados",
  );
  await page.getByRole("link", { name: "vehículo (1)", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("Ford Fiesta");
  await expect(page.getByLabel("Tipo de registro")).toHaveValue("vehicle");
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await dialog.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Registro eliminado");
  await page.goto(`/app/admin/records?kind=client&q=${clientId}`);
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await dialog.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Registro eliminado");
  const prisma = createTestPrisma();
  try {
    expect(
      await prisma.client.findUnique({ where: { id: clientId } }),
    ).toBeNull();
  } finally {
    await prisma.$disconnect();
  }
  await expect(page).toHaveTitle(/Eliminar registros/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
