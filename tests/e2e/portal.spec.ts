import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import { deletePrivateObject } from "../../src/infrastructure/storage/private-storage";
import {
  confirmPhotoUpload,
  createPhotoUploadIntent,
  storeLocalIntentUpload,
  updatePhotoVisibility,
} from "../../src/modules/photos/application/photo-service";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
  withTestPrisma,
} from "./auth.fixtures";

const marker = "Portal E2E";
let clientA = "";
let clientB = "";
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
      path: `${process.env.FE_EVIDENCE_DIR}/portal-${name}.png`,
    });
  }
}

async function login(page: Page, role: "admin" | "staff") {
  await resetE2EAuthRateLimit();
  await page.goto("/login");
  await page.getByLabel("Email").fill(e2eUsers[role].email);
  await page
    .getByRole("textbox", { name: "Contraseña" })
    .fill(e2eUsers[role].password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function cleanup() {
  await withTestPrisma(async (prisma) => {
    const clients = await prisma.client.findMany({
      where: { notes: { startsWith: marker } },
      select: { id: true },
    });
    const clientIds = clients.map((item) => item.id);
    const cases = await prisma.serviceCase.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true },
    });
    const caseIds = cases.map((item) => item.id);
    const jobs = await prisma.job.findMany({
      where: { serviceCaseId: { in: caseIds } },
      select: { id: true },
    });
    const jobIds = jobs.map((item) => item.id);
    const photos = await prisma.jobPhoto.findMany({
      where: { jobId: { in: jobIds } },
      select: { originalKey: true, previewKey: true, thumbnailKey: true },
    });
    const intents = await prisma.photoUploadIntent.findMany({
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
        ...intents.map((intent) => intent.objectKey),
      ].map(deletePrivateObject),
    );
    await prisma.rateLimit.deleteMany({
      where: { key: { startsWith: "portal:" } },
    });
    await prisma.clientShareLink.deleteMany({
      where: { clientId: { in: clientIds } },
    });
    await prisma.jobPhoto.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.photoUploadIntent.deleteMany({
      where: { jobId: { in: jobIds } },
    });
    await prisma.jobService.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.appointmentService.deleteMany({
      where: { appointment: { serviceCaseId: { in: caseIds } } },
    });
    await prisma.appointment.deleteMany({
      where: { serviceCaseId: { in: caseIds } },
    });
    await prisma.serviceCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.vehicle.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  });
}

async function seedClient(label: "A" | "B", actorId: string) {
  const prisma = createTestPrisma();
  try {
    const client = await prisma.client.create({
      data: {
        displayName: "Familia Ferraro",
        phone: "+54 341 555 1212",
        notes: `${marker} ${label} · secreto interno`,
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        clientId: client.id,
        brand: label === "A" ? "Porsche" : "Audi",
        model: label === "A" ? "911 GT3" : "RS 6",
        color: "Negro",
      },
    });
    const serviceCase = await prisma.serviceCase.create({
      data: {
        clientId: client.id,
        vehicleId: vehicle.id,
        origin: "DIRECT_JOB",
      },
    });
    await prisma.appointment.create({
      data: {
        serviceCaseId: serviceCase.id,
        startAt: new Date("2030-11-10T12:00:00Z"),
        endAt: new Date("2030-11-10T16:00:00Z"),
        visibleToClient: true,
        internalNotes: `nota turno ${label}`,
        services: { create: { nameSnapshot: `Turno público ${label}` } },
      },
    });
    await prisma.appointment.create({
      data: {
        serviceCaseId: serviceCase.id,
        startAt: new Date("2030-11-11T12:00:00Z"),
        endAt: new Date("2030-11-11T16:00:00Z"),
        visibleToClient: false,
        services: { create: { nameSnapshot: `Turno oculto ${label}` } },
      },
    });
    const job = await prisma.job.create({
      data: {
        serviceCaseId: serviceCase.id,
        performedAt: new Date("2029-10-01T12:00:00Z"),
        notes: `nota trabajo ${label}`,
        services: {
          create: {
            nameSnapshot: `Cerámico exclusivo ${label}`,
            descriptionSnapshot: `Protección aplicada ${label}`,
          },
        },
      },
    });
    const image = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background:
          label === "A" ? { r: 30, g: 30, b: 30 } : { r: 80, g: 20, b: 20 },
      },
    })
      .jpeg()
      .toBuffer();
    const intent = await createPhotoUploadIntent(
      {
        jobId: job.id,
        fileName: `${label}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: image.byteLength,
      },
      { id: actorId },
    );
    await storeLocalIntentUpload({
      intentId: intent.intentId,
      uploadToken: intent.uploadToken,
      mimeType: "image/jpeg",
      contents: image,
    });
    const photo = await confirmPhotoUpload(
      {
        intentId: intent.intentId,
        uploadToken: intent.uploadToken,
        stage: "AFTER",
      },
      { id: actorId },
    );
    await updatePhotoVisibility(photo.id, true, { id: actorId });
    return client.id;
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(async () => {
  await cleanup();
  const prisma = createTestPrisma();
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: e2eUsers.admin.email },
    select: { id: true },
  });
  await prisma.$disconnect();
  clientA = await seedClient("A", actor.id);
  clientB = await seedClient("B", actor.id);
});

test.afterAll(cleanup);

test("ADMIN shares an isolated portal and regeneration/revocation invalidate access", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(90_000);
  await login(page, "admin");
  await page.goto(`/app/clients/${clientA}`);
  await expect(
    page.getByRole("heading", { name: "Portal del cliente" }),
  ).toBeVisible();
  await page.getByLabel("Contraseña opcional").fill("GT3-Ferraro");
  await page.getByRole("button", { name: "Crear link privado" }).click();
  const linkInput = page.getByLabel("Link privado generado");
  await expect(linkInput).toBeVisible();
  const oldUrl = await linkInput.inputValue();

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  const portalResponse = await clientPage.goto(oldUrl);
  expect(portalResponse?.headers()["cache-control"]).toContain("no-store");
  expect(portalResponse?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(portalResponse?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(
    clientPage.getByRole("heading", { name: "Tu historial Ferraro." }),
  ).toBeVisible();
  await clientPage
    .getByRole("textbox", { name: "Contraseña" })
    .fill("GT3-Ferraro");
  await clientPage
    .getByRole("button", { name: "Ingresar a mi historial" })
    .click();
  await expect(
    clientPage.getByRole("heading", { name: "Tus vehículos" }),
  ).toBeVisible();
  await expect(
    clientPage.getByRole("heading", { name: "Porsche 911 GT3" }).first(),
  ).toBeVisible();
  await expect(clientPage.getByText("Cerámico exclusivo A")).toBeVisible();
  await expect(clientPage.getByText("Turno público A")).toBeVisible();
  await expect(clientPage.getByAltText("Foto 1 del trabajo")).toBeVisible();
  await expect(clientPage.getByText("Audi RS 6")).toHaveCount(0);
  await expect(clientPage.getByText("Turno oculto A")).toHaveCount(0);
  await expect(clientPage.getByText("secreto interno")).toHaveCount(0);
  await expect(clientPage.getByText("Costo directo")).toHaveCount(0);
  await expect(clientPage.getByText("Rentabilidad")).toHaveCount(0);
  await expect(clientPage.getByText(/ARS\/USD|Cotización ARS/)).toHaveCount(0);
  const photoSource = await clientPage
    .getByAltText("Foto 1 del trabajo")
    .getAttribute("src");
  expect((await request.get(photoSource!)).status()).toBe(401);
  const accessibility = await new AxeBuilder({ page: clientPage })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await clientPage
    .getByRole("button", { name: "Ampliar foto 1 del trabajo" })
    .click();
  await expect(clientPage.getByRole("dialog")).toBeVisible();
  await clientPage.keyboard.press("Escape");
  await captureEvidence(clientPage);

  await page.getByRole("button", { name: "Regenerar link" }).click();
  await expect(page.getByText(/Link regenerado/)).toBeVisible();
  const newUrl = await page.getByLabel("Link privado generado").inputValue();
  expect(newUrl).not.toBe(oldUrl);
  await clientPage.goto(oldUrl);
  await expect(
    clientPage.getByRole("heading", { name: /ya no está disponible/ }),
  ).toBeVisible();
  await clientPage.goto(newUrl);
  await clientPage
    .getByRole("textbox", { name: "Contraseña" })
    .fill("GT3-Ferraro");
  await clientPage
    .getByRole("button", { name: "Ingresar a mi historial" })
    .click();
  await expect(
    clientPage.getByRole("heading", { name: "Porsche 911 GT3" }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Revocar acceso" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Revocar acceso" })
    .click();
  await expect(page.getByText("Link revocado inmediatamente.")).toBeVisible();
  await clientPage.reload();
  await expect(
    clientPage.getByRole("heading", { name: /ya no está disponible/ }),
  ).toBeVisible();
  await clientContext.close();

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await login(staffPage, "staff");
  await staffPage.goto(`/app/clients/${clientB}`);
  await expect(
    staffPage.getByRole("heading", { name: "Portal del cliente" }),
  ).toHaveCount(0);
  await staffContext.close();
});
