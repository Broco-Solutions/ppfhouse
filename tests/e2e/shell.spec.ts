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

test("ADMIN navigation marks the route and persists the collapsed sidebar", async ({
  page,
}) => {
  await login(page, e2eUsers.admin);
  await expect(
    page.getByRole("link", { exact: true, name: "Inicio" }).first(),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Contraer navegación" }).click();
  await expect(
    page.getByRole("button", { name: "Expandir navegación" }),
  ).toBeVisible();
  const sidebar = page.getByRole("complementary", {
    name: "Navegación lateral",
  });
  const mark = sidebar.locator('a[aria-label="Ir al inicio"] img').last();
  const expandButton = sidebar.getByRole("button", {
    name: "Expandir navegación",
  });
  const markBox = await mark.boundingBox();
  const toggleBox = await expandButton.boundingBox();
  expect(markBox).not.toBeNull();
  expect(toggleBox).not.toBeNull();
  expect(markBox!.y + markBox!.height).toBeLessThanOrEqual(toggleBox!.y);
  expect(toggleBox!.width).toBeGreaterThanOrEqual(44);
  expect(toggleBox!.height).toBeGreaterThanOrEqual(44);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("ferraro:sidebar-collapsed")),
    )
    .toBe("true");

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expandir navegación" }),
  ).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Agenda" }).first().focus();
  await expect(page.getByRole("tooltip", { name: "Agenda" })).toBeVisible();

  await page
    .getByRole("link", { exact: true, name: "Clientes" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/clients$/);
  await expect(
    page.getByRole("link", { exact: true, name: "Clientes" }).first(),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Migas de pan" }),
  ).toBeVisible();
});

test("STAFF mobile drawer and no-JS links preserve role boundaries", async ({
  browser,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, e2eUsers.staff);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  const drawer = page.getByRole("dialog", { name: "Menú" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Finanzas" })).toHaveCount(0);
  await expect(
    drawer.getByRole("link", { name: "Administración" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Accesos rápidos" }).getByRole("link"),
  ).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();

  const noJsContext = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  const noJsPage = await noJsContext.newPage();
  await noJsPage.goto("/app/clients");
  await expect(
    noJsPage.getByRole("link", { exact: true, name: "Agenda" }).first(),
  ).toHaveAttribute("href", "/app/calendar");
  await expect(noJsPage.getByRole("link", { name: "Finanzas" })).toHaveCount(0);
  await noJsContext.close();
});
