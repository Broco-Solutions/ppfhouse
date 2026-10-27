import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { e2eUsers, resetE2EAuthRateLimit } from "./auth.fixtures";

async function loginAsAdmin(page: Page) {
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(e2eUsers.admin.email);
  await page
    .getByRole("textbox", { name: "Contraseña" })
    .fill(e2eUsers.admin.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

test("design system primitives preserve keyboard focus and modal behavior", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/app/design-system");

  const dialogTrigger = page.getByRole("button", { name: "Abrir dialog" });
  await dialogTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Detalle rápido" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Detalle rápido" }),
  ).toHaveCount(0);
  await expect(dialogTrigger).toBeFocused();

  await page.getByRole("button", { name: "Acción sensible" }).click();
  const alertDialog = page.getByRole("alertdialog", {
    name: "¿Eliminar esta evidencia?",
  });
  await expect(alertDialog).toBeVisible();
  await expect(
    alertDialog.getByRole("button", { name: "Cancelar" }),
  ).toBeFocused();
  await alertDialog.getByRole("button", { name: "Eliminar evidencia" }).click();
  await expect(page.getByText("Acción confirmada")).toBeVisible();

  await page.getByRole("button", { name: "Mostrar notificación" }).click();
  await expect(
    page.getByRole("region", { name: "Notificaciones" }).getByRole("status"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar notificación" }).click();
  await expect(
    page.getByText("El registro quedó actualizado correctamente."),
  ).toHaveCount(0);
});

test("design system has no automated WCAG A/AA violations", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/app/design-system");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
