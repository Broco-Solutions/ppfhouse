import { expect, test, type Page } from "@playwright/test";

import { e2eUsers, resetE2EAuthRateLimit } from "./auth.fixtures";

async function login(
  page: Page,
  user: (typeof e2eUsers)[keyof typeof e2eUsers],
) {
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(user.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

test("a protected route redirects an anonymous visitor", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?from=%2Fapp$/);
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeEnabled();
  await page.getByLabel("Email").focus();
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("textbox", { name: "Contraseña" }),
  ).toBeFocused();
});

test("ADMIN can sign in, enter the protected admin route and sign out", async ({
  page,
}) => {
  await login(page, e2eUsers.admin);
  await page.getByRole("link", { name: "Administración" }).click();
  await expect(
    page.getByRole("heading", { name: "Administración" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("STAFF has operational navigation and receives 403 on an ADMIN route", async ({
  page,
}) => {
  await login(page, e2eUsers.staff);
  await expect(page.getByText("Staff E2E")).toBeVisible();
  await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(
    0,
  );
  await page.goto("/app/admin");
  await expect(page.getByText("403")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No tenés acceso a esta sección" }),
  ).toBeVisible();
});

test("mobile navigation closes after changing route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, e2eUsers.staff);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  const menu = page.getByRole("dialog", { name: "Menú" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Agenda" }).click();
  await expect(page).toHaveURL(/\/app\/calendar/);
  await expect(menu).toHaveCount(0);
});
