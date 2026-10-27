import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

const managedEmail = "users-e2e-staff@ferraro.test";
const managedPassword = "Users-e2e-staff-password";

async function login(page: Page, user: { email: string; password: string }) {
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(user.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

async function removeManagedUser() {
  const prisma = createTestPrisma();
  try {
    await prisma.user.deleteMany({ where: { email: managedEmail } });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(removeManagedUser);
test.afterAll(removeManagedUser);

test("ADMIN creates a STAFF user, who can sign in until deactivated", async ({
  browser,
  page,
}) => {
  await login(page, e2eUsers.admin);
  await page.goto("/app/admin");
  await page.getByRole("link", { name: "Gestionar" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/users$/);
  await page.getByRole("link", { name: "Nuevo usuario" }).click();

  await page.getByLabel("Nombre").fill("Staff Gestionado E2E");
  await page.getByLabel("Email").fill(managedEmail);
  await page.getByLabel("Rol").selectOption("STAFF");
  await page
    .getByRole("textbox", { exact: true, name: "Contraseña" })
    .fill(managedPassword);
  await page
    .getByRole("textbox", { name: "Repetir contraseña" })
    .fill(managedPassword);
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await login(staffPage, { email: managedEmail, password: managedPassword });

  await page.getByRole("button", { name: "Desactivar" }).click();
  await page
    .getByRole("alertdialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Desactivar" })
    .click();
  await expect(page.getByText("Usuario inactivo")).toBeVisible();

  await staffPage.goto("/app");
  await expect(staffPage).toHaveURL(/\/login/);
  await staffContext.close();
});

test("STAFF receives 403 on user management", async ({ page }) => {
  await login(page, e2eUsers.staff);
  await page.goto("/app/admin/users");
  await expect(page.getByText("403")).toBeVisible();
});
