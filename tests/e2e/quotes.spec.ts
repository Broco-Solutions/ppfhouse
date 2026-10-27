import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

const clientName = "Presupuesto E2E Cliente";
const inlineClientName = "Presupuesto E2E Inline";
const serviceName = "PPF Frontal E2E";
const categoryName = "Presupuesto E2E Protección";
let clientId = "";
let serviceId = "";
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
      path: `${process.env.FE_EVIDENCE_DIR}/quote-detail-${name}.png`,
    });
  }
}

async function captureFormEvidence(page: Page) {
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
    await page.getByLabel("Resumen del presupuesto").scrollIntoViewIfNeeded();
    await page.screenshot({
      fullPage: true,
      path: `${process.env.FE_EVIDENCE_DIR}/quote-form-${name}.png`,
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
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

async function selectClientVehicle(
  page: Page,
  client: string,
  vehicle: string,
) {
  const clientPicker = page.getByRole("combobox", { name: "Cliente *" });
  await clientPicker.fill(client);
  await expect(clientPicker).toHaveAttribute("aria-busy", "true");
  await expect(clientPicker).not.toHaveAttribute("aria-busy", "true");
  await clientPicker.press("ArrowDown");
  await page.getByRole("option", { name: new RegExp(client, "i") }).click();
  const vehiclePicker = page.getByRole("combobox", { name: "Vehículo *" });
  await vehiclePicker.fill(vehicle);
  await expect(vehiclePicker).toHaveAttribute("aria-busy", "true");
  await expect(vehiclePicker).not.toHaveAttribute("aria-busy", "true");
  await vehiclePicker.press("ArrowDown");
  await page.getByRole("option", { name: new RegExp(vehicle, "i") }).click();
}

async function cleanup() {
  const prisma = createTestPrisma();
  try {
    const clients = await prisma.client.findMany({
      where: { displayName: { startsWith: "Presupuesto E2E" } },
      select: { id: true },
    });
    const clientIds = clients.map((item) => item.id);
    const quotes = await prisma.quote.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true },
    });
    const quoteIds = quotes.map((item) => item.id);
    const cases = await prisma.serviceCase.findMany({
      where: { acceptedQuoteId: { in: quoteIds } },
      select: { id: true },
    });
    const caseIds = cases.map((item) => item.id);
    const appointments = await prisma.appointment.findMany({
      where: { serviceCaseId: { in: caseIds } },
      select: { id: true },
    });
    const appointmentIds = appointments.map((item) => item.id);
    await prisma.appointmentEmployee.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointmentService.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.idempotencyKey.deleteMany({
      where: { resultReference: { in: appointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: appointmentIds } },
    });
    await prisma.serviceCaseAmountRevision.deleteMany({
      where: { serviceCaseId: { in: caseIds } },
    });
    await prisma.serviceCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
    await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } });
    for (const id of quoteIds) {
      await rm(path.resolve(process.cwd(), ".data/private/quotes", id), {
        recursive: true,
        force: true,
      });
    }
    const services = await prisma.service.findMany({
      where: { name: serviceName },
      select: { id: true },
    });
    await prisma.service.deleteMany({
      where: { id: { in: services.map((item) => item.id) } },
    });
    await prisma.serviceCategory.deleteMany({ where: { name: categoryName } });
    await prisma.vehicle.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
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
    await prisma.vehicle.create({
      data: {
        clientId,
        brand: "BMW",
        model: "M3",
        year: 2026,
        color: "Negro",
      },
    });
    await prisma.client.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        displayName: `Presupuesto E2E Escala ${String(index).padStart(2, "0")}`,
      })),
    });
    const category = await prisma.serviceCategory.create({
      data: { name: categoryName },
    });
    serviceId = (
      await prisma.service.create({
        data: {
          categoryId: category.id,
          name: serviceName,
          commercialDescription: "Protección de frente completo",
          basePriceUsd: "850",
        },
      })
    ).id;
  } finally {
    await prisma.$disconnect();
  }
});
test.afterAll(cleanup);

test("ADMIN creates, emits, accepts and converts a quote into the same case appointment", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page, e2eUsers.admin);
  await page.goto("/app/quotes/new");
  await selectClientVehicle(page, clientName, "BMW M3");
  await page.getByLabel("Desde catálogo").selectOption(serviceId);
  await expect(page.getByLabel("Nombre *")).toHaveValue(serviceName);
  await page.getByLabel("Descuento general (USD)").fill("50");
  await page.getByLabel("Observaciones").fill("Propuesta E2E premium");
  const summary = page.getByLabel("Resumen del presupuesto");
  await expect(summary.getByText("Subtotal estimado")).toBeVisible();
  await expect(summary.getByText("Descuento general (USD)")).toBeVisible();
  await expect(
    summary.getByText(/se descuenta una sola vez del subtotal completo/i),
  ).toBeVisible();
  await expect(summary.getByText("USD 850,00")).toBeVisible();
  await expect(summary.getByText("− USD 50,00")).toBeVisible();
  await expect(summary.getByText("USD 800,00")).toBeVisible();
  const formAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(formAccessibility.violations).toEqual([]);
  await captureFormEvidence(page);
  await page.getByRole("button", { name: "Crear presupuesto" }).click();
  await expect(page.getByText("El borrador quedó guardado.")).toBeVisible();
  await expect(page.getByText("USD 800.00").last()).toBeVisible();

  const previewHref = await page
    .getByRole("link", { name: "Preview PDF" })
    .getAttribute("href");
  expect(previewHref).toBeTruthy();
  const preview = await page.request.get(previewHref!);
  expect(preview.ok()).toBeTruthy();
  expect(preview.headers()["content-type"]).toContain("application/pdf");
  const previewBytes = await preview.body();
  expect(previewBytes.subarray(0, 4).toString()).toBe("%PDF");
  if (process.env.FE_EVIDENCE_DIR)
    await writeFile(
      `${process.env.FE_EVIDENCE_DIR}/quote-preview.pdf`,
      previewBytes,
    );

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await captureEvidence(page);

  if ((process.env.STORAGE_DRIVER ?? "local") === "local") {
    // A file in place of this quote's storage directory reproduces a write failure
    // without affecting any other quote or changing the running server's config.
    const draftId = new URL(page.url()).pathname.split("/").at(-1)!;
    const storageDirectory = path.resolve(
      process.cwd(),
      ".data/private/quotes",
    );
    const blockedPath = path.join(storageDirectory, draftId);
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(blockedPath, "storage failure fixture", { flag: "wx" });
    try {
      await page.getByRole("button", { name: "Emitir presupuesto" }).click();
      await page
        .getByRole("alertdialog", { name: "Confirmar acción" })
        .getByRole("button", { name: "Emitir presupuesto" })
        .click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "No pudimos emitir el presupuesto" }),
      ).toBeVisible();
      await expect(
        page.getByText("No pudimos cargar esta sección"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Emitir presupuesto" }),
      ).toBeEnabled();
      const prisma = createTestPrisma();
      try {
        const draft = await prisma.quote.findUniqueOrThrow({
          where: { id: draftId },
        });
        expect(draft.status).toBe("DRAFT");
        expect(draft.pdfArtifactKey).toBeNull();
      } finally {
        await prisma.$disconnect();
      }
    } finally {
      await unlink(blockedPath);
    }
  }

  await page.getByRole("button", { name: "Emitir presupuesto" }).click();
  await page
    .getByRole("alertdialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Emitir presupuesto" })
    .click();
  await expect(
    page.getByText("Presupuesto emitido y PDF congelado."),
  ).toBeVisible();
  const pdfHref = await page
    .getByRole("link", { name: "Descargar PDF" })
    .getAttribute("href");
  const pdf = await page.request.get(pdfHref!);
  const samePdf = await page.request.get(pdfHref!);
  expect(pdf.ok()).toBe(true);
  expect(samePdf.ok()).toBe(true);
  expect(await samePdf.body()).toEqual(await pdf.body());
  await page.getByRole("button", { name: "Marcar aceptado" }).click();
  await page
    .getByRole("alertdialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Marcar aceptado" })
    .click();
  await expect(
    page.getByText("El importe acordado quedó fijado."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Convertir en turno" }).click();
  await page.getByLabel("Inicio *").fill("2027-03-12T09:00");
  await page.getByLabel("Fin *").fill("2027-03-12T14:00");
  await page.getByRole("button", { name: "Crear turno" }).click();
  await expect(page.getByText("Turno confirmado")).toBeVisible();
  await expect(page.getByText("Turno agendado correctamente.")).toBeVisible();
  await expect(page.getByLabel("Inicio *")).toHaveCount(0);

  const prisma = createTestPrisma();
  try {
    const quote = await prisma.quote.findFirstOrThrow({
      where: { clientId },
      select: { id: true },
    });
    const serviceCase = await prisma.serviceCase.findUniqueOrThrow({
      where: { acceptedQuoteId: quote.id },
      select: { id: true, agreedAmountUsd: true },
    });
    const appointmentCount = await prisma.appointment.count({
      where: { serviceCaseId: serviceCase.id },
    });
    expect(serviceCase.agreedAmountUsd?.toFixed(2)).toBe("800.00");
    expect(appointmentCount).toBe(1);
  } finally {
    await prisma.$disconnect();
  }
});

test("inline client with two vehicles preserves quote lines and the new route avoids the recoverable boundary", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) serverErrors.push(response.url());
  });
  await login(page, e2eUsers.admin);
  await page.goto("/app/quotes/new");
  await expect(page.getByText("Error recuperable")).toHaveCount(0);
  await page.getByLabel("Desde catálogo").selectOption(serviceId);
  await page.getByLabel("Observaciones").fill("Debe conservarse inline");

  const clientPicker = page.getByRole("combobox", { name: "Cliente *" });
  await clientPicker.fill(inlineClientName);
  await expect(clientPicker).toHaveAttribute("aria-busy", "true");
  await expect(clientPicker).not.toHaveAttribute("aria-busy", "true");
  await clientPicker.press("ArrowDown");
  await page.getByRole("button", { name: "Nuevo cliente + vehículo" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Crear cliente y vehículos",
  });
  await expect(dialog.getByRole("textbox")).toHaveCount(4);
  await dialog.getByLabel("Marca *").fill("Mercedes-Benz");
  await dialog.getByLabel("Modelo *").fill("A200");
  await dialog.getByRole("button", { name: "Agregar otro" }).click();
  await dialog.getByLabel("Marca *").nth(1).fill("Volkswagen");
  await dialog.getByLabel("Modelo *").nth(1).fill("Golf GTI");
  await dialog.getByRole("button", { name: "Crear y continuar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Nombre *")).toHaveValue(serviceName);
  await expect(page.getByLabel("Observaciones")).toHaveValue(
    "Debe conservarse inline",
  );
  await expect(page.getByRole("combobox", { name: "Vehículo *" })).toHaveValue(
    /Mercedes-Benz.*A200/,
  );
  await page.getByRole("button", { name: "Crear presupuesto" }).click();
  await expect(page.getByText("El borrador quedó guardado.")).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(serverErrors).toEqual([]);

  const prisma = createTestPrisma();
  await expect(
    prisma.vehicle.count({
      where: { client: { displayName: inlineClientName } },
    }),
  ).resolves.toBe(2);
  await prisma.$disconnect();
});

test("STAFF cannot access quote data or its PDF route", async ({ page }) => {
  await login(page, e2eUsers.staff);
  await page.goto("/app/quotes");
  await expect(page.getByText("403")).toBeVisible();
  const prisma = createTestPrisma();
  const quote = await prisma.quote.findFirst({
    where: { clientId },
    select: { id: true },
  });
  await prisma.$disconnect();
  expect(quote).toBeTruthy();
  const response = await page.request.get(`/api/quotes/${quote!.id}/pdf`);
  expect(response.status()).toBe(403);
});

test("ADMIN issues an ARS quote and acceptance stores canonical USD on its case", async ({
  page,
}) => {
  await login(page, e2eUsers.admin);
  await page.goto("/app/quotes/new");
  await selectClientVehicle(page, clientName, "BMW M3");
  await page.getByLabel("Moneda del presupuesto").selectOption("ARS");
  await page.getByLabel("Cotización ARS/USD *").fill("1560");
  await page.getByLabel("Desde catálogo").selectOption(serviceId);
  await page.getByLabel("Precio unitario ARS *").fill("780000");
  await expect(
    page.getByLabel("Resumen del presupuesto").getByText("USD 500,00"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear presupuesto" }).click();
  await expect(page.getByText("El borrador quedó guardado.")).toBeVisible();
  await expect(page.getByText("ARS 780000.00").last()).toBeVisible();
  await page.getByRole("button", { name: "Emitir presupuesto" }).click();
  await page
    .getByRole("alertdialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Emitir presupuesto" })
    .click();
  await expect(
    page.getByText("Presupuesto emitido y PDF congelado."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Marcar aceptado" }).click();
  await page
    .getByRole("alertdialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Marcar aceptado" })
    .click();
  const prisma = createTestPrisma();
  try {
    const quote = await prisma.quote.findFirstOrThrow({
      where: { clientId, sourceCurrency: "ARS" },
    });
    const accepted = await prisma.serviceCase.findUniqueOrThrow({
      where: { acceptedQuoteId: quote.id },
    });
    expect(quote.totalUsd.toFixed(2)).toBe("500.00");
    expect(quote.sourceTotal.toFixed(2)).toBe("780000.00");
    expect(accepted.agreedAmountUsd?.toFixed(2)).toBe("500.00");
    expect(accepted.agreedSourceCurrency).toBe("ARS");
  } finally {
    await prisma.$disconnect();
  }
});
