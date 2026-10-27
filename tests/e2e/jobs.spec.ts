import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import { deletePrivateObject } from "../../src/infrastructure/storage/private-storage";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
  withTestPrisma,
} from "./auth.fixtures";

const clientName = "Trabajo E2E Cliente";
const serviceName = "Trabajo E2E Cerámico";
const inventoryCategoryName = "Trabajo E2E Films";
const inventoryItemName = "Trabajo E2E PPF";
const evidenceViewports = [
  ["1440x900", 1440, 900],
  ["1280x800", 1280, 800],
  ["1024x768", 1024, 768],
  ["820x1180", 820, 1180],
  ["768x1024", 768, 1024],
  ["390x844", 390, 844],
] as const;
let appointmentId = "";
let caseId = "";
let clientId = "";
let vehicleId = "";
let categoryId = "";
let serviceId = "";
let inventoryCategoryId = "";
let inventoryItemId = "";

async function login(page: Page) {
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(e2eUsers.staff.email);
  await page
    .getByRole("textbox", { name: "Contraseña" })
    .fill(e2eUsers.staff.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

async function captureEvidence(page: Page) {
  const directory = process.env.FE_EVIDENCE_DIR;
  if (!directory) return;
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
    await page.screenshot({ path: `${directory}/job-detail-${name}.png` });
  }
}

async function cleanup() {
  await withTestPrisma(async (prisma) => {
    const clients = await prisma.client.findMany({
      where: { displayName: clientName },
      select: { id: true },
    });
    const clientIds = clients.map((item) => item.id);
    const cases = await prisma.serviceCase.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true },
    });
    const caseIds = cases.map((item) => item.id);
    const appointments = await prisma.appointment.findMany({
      where: { serviceCaseId: { in: caseIds } },
      select: { id: true },
    });
    const appointmentIds = appointments.map((item) => item.id);
    const jobs = await prisma.job.findMany({
      where: { serviceCaseId: { in: caseIds } },
      select: { id: true },
    });
    const jobIds = jobs.map((item) => item.id);
    const photos = await prisma.jobPhoto.findMany({
      where: { jobId: { in: jobIds } },
      select: { originalKey: true, previewKey: true, thumbnailKey: true },
    });
    const photoIntents = await prisma.photoUploadIntent.findMany({
      where: { jobId: { in: jobIds } },
      select: { objectKey: true },
    });
    await Promise.all(
      [
        ...photos.flatMap((photo) => [
          photo.originalKey,
          photo.previewKey,
          photo.thumbnailKey,
        ]),
        ...photoIntents.map((intent) => intent.objectKey),
      ].map((key) => deletePrivateObject(key)),
    );
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { name: inventoryItemName },
      select: { id: true },
    });
    const inventoryItemIds = inventoryItems.map((item) => item.id);
    const consumptions = await prisma.jobMaterialConsumption.findMany({
      where: { jobId: { in: jobIds } },
      select: { id: true },
    });
    await prisma.idempotencyKey.deleteMany({
      where: {
        resultReference: { in: consumptions.map((item) => item.id) },
      },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { itemId: { in: inventoryItemIds } },
    });
    await prisma.jobMaterialConsumption.deleteMany({
      where: { jobId: { in: jobIds } },
    });
    await prisma.jobPhoto.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.photoUploadIntent.deleteMany({
      where: { jobId: { in: jobIds } },
    });
    await prisma.jobEmployee.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.jobService.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.appointmentEmployee.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointmentService.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: appointmentIds } },
    });
    await prisma.serviceCaseAmountRevision.deleteMany({
      where: { serviceCaseId: { in: caseIds } },
    });
    await prisma.serviceCase.deleteMany({ where: { id: { in: caseIds } } });
    const services = await prisma.service.findMany({
      where: { name: serviceName },
      select: { id: true },
    });
    await prisma.service.deleteMany({
      where: { id: { in: services.map((item) => item.id) } },
    });
    await prisma.serviceCategory.deleteMany({
      where: { name: "Trabajo E2E Categoría" },
    });
    await prisma.inventoryItem.deleteMany({
      where: { id: { in: inventoryItemIds } },
    });
    await prisma.inventoryCategory.deleteMany({
      where: { name: inventoryCategoryName },
    });
    await prisma.vehicle.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  });
}

test.beforeAll(async () => {
  await cleanup();
  const prisma = createTestPrisma();
  try {
    const client = await prisma.client.create({
      data: { displayName: clientName },
    });
    clientId = client.id;
    const vehicle = await prisma.vehicle.create({
      data: { clientId, brand: "Mercedes-Benz", model: "AMG GT", year: 2025 },
    });
    vehicleId = vehicle.id;
    const category = await prisma.serviceCategory.create({
      data: { name: "Trabajo E2E Categoría" },
    });
    categoryId = category.id;
    const service = await prisma.service.create({
      data: { categoryId, name: serviceName },
    });
    serviceId = service.id;
    const inventoryCategory = await prisma.inventoryCategory.create({
      data: { name: inventoryCategoryName },
    });
    inventoryCategoryId = inventoryCategory.id;
    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        categoryId: inventoryCategoryId,
        name: inventoryItemName,
        baseUnit: "meter",
        currentStock: "10",
      },
    });
    inventoryItemId = inventoryItem.id;
    await prisma.inventoryMovement.create({
      data: {
        itemId: inventoryItemId,
        type: "ADJUSTMENT_IN",
        signedQuantityBase: "10",
        unitSnapshot: "meter",
        occurredAt: new Date(),
        note: "Saldo E2E",
      },
    });
    const serviceCase = await prisma.serviceCase.create({
      data: { clientId, vehicleId, origin: "DIRECT_APPOINTMENT" },
    });
    caseId = serviceCase.id;
    const appointment = await prisma.appointment.create({
      data: {
        serviceCaseId: caseId,
        startAt: new Date("2026-10-22T12:00:00Z"),
        endAt: new Date("2026-10-22T16:00:00Z"),
        services: { create: { serviceId, nameSnapshot: serviceName } },
      },
    });
    appointmentId = appointment.id;
  } finally {
    await prisma.$disconnect();
  }
});
test.afterAll(cleanup);

test("STAFF converts a confirmed appointment into a separate job", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/app/calendar/${appointmentId}`);
  await page.getByRole("link", { name: "Marcar realizado" }).click();
  await expect(
    page.getByRole("heading", { name: "Marcar como realizado" }),
  ).toBeVisible();
  await expect(page.getByText(clientName)).toBeVisible();
  await expect(page.getByText(serviceName)).toBeVisible();
  await page.getByLabel("Notas del trabajo").fill("Control final E2E completo");
  await page
    .getByRole("button", { name: "Confirmar trabajo realizado" })
    .click();
  await expect(page.getByText("El trabajo quedó registrado.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mercedes-Benz AMG GT" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ver turno" }).click();
  await expect(page.getByText("Trabajo realizado").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver trabajo" })).toBeVisible();
});

test("STAFF records consumptions and private photos from the job", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await login(page);
  const prisma = createTestPrisma();
  const job = await prisma.job.findFirstOrThrow({
    where: { serviceCaseId: caseId },
    select: { id: true },
  });
  await prisma.$disconnect();
  await page.goto(`/app/jobs/${job.id}`);
  await expect(
    page.getByRole("heading", { name: "Consumos del trabajo" }),
  ).toBeVisible();
  const itemSearch = page.getByLabel("Buscar insumo");
  if (!(await itemSearch.isVisible()))
    await page
      .locator("summary")
      .filter({ hasText: "Registrar consumo" })
      .click();
  await itemSearch.fill(inventoryItemName);
  await page.getByLabel("Insumo *").selectOption(inventoryItemId);
  await page.getByLabel("Cantidad en meter *").fill("3.2");
  await page.getByLabel("Nota").fill("Frontal E2E");
  await page.getByRole("button", { name: "Registrar consumo" }).click();
  await expect(
    page.getByText("El consumo quedó registrado y el stock fue actualizado."),
  ).toBeVisible();
  await expect(page.getByText("3.200 meter")).toBeVisible();
  await page.getByText("Corregir o anular").click();
  await page.getByLabel("Nueva cantidad en meter *").fill("2.4");
  await page.getByLabel("Motivo *").first().fill("Medición final E2E");
  await page.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(
    page.getByText(
      "La corrección quedó registrada con sus movimientos compensatorios.",
    ),
  ).toBeVisible();
  await expect(page.getByText("2.400 meter")).toBeVisible();
  const image = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 35, g: 35, b: 35 },
    },
  })
    .jpeg()
    .toBuffer();
  await expect(
    page.getByRole("heading", { name: "Fotos del trabajo" }),
  ).toBeVisible();
  const fileInput = page.locator('input[type="file"]');
  if (!(await fileInput.isVisible()))
    await page.locator("summary").filter({ hasText: "Subir fotos" }).click();
  await fileInput.setInputFiles({
    name: "amg-after.jpg",
    mimeType: "image/jpeg",
    buffer: image,
  });
  await page.getByLabel("Etapa opcional").selectOption("AFTER");
  await page.getByRole("button", { name: "Subir fotos" }).click();
  const thumbnail = page.getByAltText("Foto 1 del trabajo");
  await expect(thumbnail).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publicar al cliente" }),
  ).toBeVisible();
  const source = await thumbnail.getAttribute("src");
  expect(source).toBeTruthy();
  const anonymousResponse = await request.get(source!);
  expect(anonymousResponse.status()).toBe(401);
  await page.getByRole("button", { name: "Publicar al cliente" }).click();
  await expect(
    page.getByRole("button", { name: "Ocultar al cliente" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ampliar foto 1 del trabajo" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Foto 1 del trabajo" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await captureEvidence(page);
});

test("ADMIN records optional ARS direct cost and STAFF never receives profitability", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(e2eUsers.admin.email);
  await page
    .getByRole("textbox", { name: "Contraseña" })
    .fill(e2eUsers.admin.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
  const prisma = createTestPrisma();
  const job = await prisma.job.findFirstOrThrow({
    where: { serviceCaseId: caseId },
    select: { id: true },
  });
  await prisma.$disconnect();

  await page.goto(`/app/finance/cases/${caseId}`);
  await page.getByLabel("Nuevo importe (USD) *").fill("1000");
  await page.getByLabel("Motivo *").fill("Importe acordado E2E");
  await page.getByRole("button", { name: "Actualizar" }).click();
  await page.goto(`/app/jobs/${job.id}`);
  await page.getByLabel("Costo directo (USD)").fill("1000");
  await page.getByRole("button", { name: "Guardar costo" }).click();
  await expect(page.getByText("USD 0.00")).toBeVisible();
  await expect(page.getByText("0.00%")).toBeVisible();
  await page.getByLabel("Moneda").selectOption("ARS");
  await page.getByLabel("Costo directo (ARS)").fill("1872000");
  await page.getByLabel("Cotización ARS/USD *").fill("1560");
  await page.getByRole("button", { name: "Guardar costo" }).click();
  await expect(page.getByLabel("Moneda")).toHaveValue("ARS");
  await expect(page.getByText("USD -200.00")).toBeVisible();
  await expect(page.getByText("-20.00%")).toBeVisible();
  await captureEvidence(page);
  await expect(page.getByLabel("Moneda")).toHaveValue("ARS");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByLabel("Costo directo (ARS)").fill("");
  await page.getByRole("button", { name: "Guardar costo" }).click();
  await expect(page.getByText("Sin imputar")).toBeVisible();
  await expect(
    page
      .getByText("Margen", { exact: true })
      .locator("..")
      .getByText("—", { exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login(page);
  await page.goto(`/app/jobs/${job.id}`);
  await expect(page.getByText("Rentabilidad")).toHaveCount(0);
  await expect(page.getByText("Costo directo")).toHaveCount(0);
});
