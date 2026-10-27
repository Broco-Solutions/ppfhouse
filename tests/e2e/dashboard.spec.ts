import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
  withTestPrisma,
} from "./auth.fixtures";

const marker = "Dashboard E2E";
let clientId = "";
let vehicleId = "";
let serviceCategoryId = "";
let serviceId = "";
let caseId = "";

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
      where: { notes: marker },
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
    await prisma.quote.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.appointmentEmployee.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointmentService.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: appointmentIds } },
    });
    await prisma.jobService.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.serviceCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.vehicle.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    await prisma.service.deleteMany({ where: { name: "M3 Protection E2E" } });
    await prisma.serviceCategory.deleteMany({
      where: { name: "Dashboard E2E Services" },
    });
  });
}

test.beforeAll(async () => {
  await cleanup();
  const prisma = createTestPrisma();
  try {
    clientId = (
      await prisma.client.create({
        data: { displayName: "Martín M3", notes: marker },
      })
    ).id;
    vehicleId = (
      await prisma.vehicle.create({
        data: { clientId, brand: "BMW", model: "M3 Competition", year: 2026 },
      })
    ).id;
    serviceCategoryId = (
      await prisma.serviceCategory.create({
        data: { name: "Dashboard E2E Services" },
      })
    ).id;
    serviceId = (
      await prisma.service.create({
        data: {
          categoryId: serviceCategoryId,
          name: "M3 Protection E2E",
          basePriceUsd: "850",
        },
      })
    ).id;
    caseId = (
      await prisma.serviceCase.create({
        data: { clientId, vehicleId, origin: "DIRECT_JOB" },
      })
    ).id;
    const appointmentStart = new Date();
    appointmentStart.setUTCHours(15, 0, 0, 0);
    await prisma.appointment.create({
      data: {
        serviceCaseId: caseId,
        startAt: appointmentStart,
        endAt: new Date(appointmentStart.getTime() + 3 * 60 * 60 * 1000),
        services: { create: { serviceId, nameSnapshot: "M3 Protection E2E" } },
      },
    });
    await prisma.job.create({
      data: {
        serviceCaseId: caseId,
        performedAt: new Date(),
        services: { create: { serviceId, nameSnapshot: "M3 Protection E2E" } },
      },
    });
    await prisma.quote.create({
      data: {
        clientId,
        vehicleId,
        number: "PRE-E2E-M3-DASH",
        status: "DRAFT",
        issuedOn: new Date("2026-10-03T00:00:00Z"),
        subtotalUsd: "850",
        sourceSubtotal: "850",
        sourceDiscount: "0",
        sourceTotal: "850",
        totalUsd: "850",
      },
    });
  } finally {
    await prisma.$disconnect();
  }
});

test.afterAll(cleanup);

test("dashboard and search adapt their projections to ADMIN and STAFF", async ({
  page,
  browser,
}) => {
  await login(page, "admin");
  await expect(
    page.getByRole("heading", { name: "¿Qué pasa hoy en Ferraro?" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Inicio/);
  await expect(page.getByText("Cobrado este mes")).toBeVisible();
  const adminAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(adminAxe.violations).toEqual([]);
  await page.keyboard.press("Control+k");
  const adminSearch = page.getByLabel("Buscar en Ferraro");
  await expect(adminSearch).toBeFocused();
  await adminSearch.fill("M3");
  await adminSearch.press("Enter");
  await expect(page).toHaveURL(/\/app\/search\?q=M3/);
  await expect(page.getByRole("heading", { name: "Vehículos" })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /BMW M3 Competition Martín M3 · 2026/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Presupuestos" }),
  ).toBeVisible();
  await expect(page.getByText("PRE-E2E-M3-DASH")).toBeVisible();

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await login(staffPage, "staff");
  await expect(
    staffPage.getByRole("heading", { name: "¿Qué pasa hoy en Ferraro?" }),
  ).toBeVisible();
  await expect(staffPage).toHaveTitle(/Inicio/);
  await expect(staffPage.getByText("Cobrado este mes")).toHaveCount(0);
  const staffAxe = await new AxeBuilder({ page: staffPage })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(staffAxe.violations).toEqual([]);
  await staffPage.getByLabel("Buscar en Ferraro").fill("M3");
  await staffPage.getByLabel("Buscar en Ferraro").press("Enter");
  await expect(
    staffPage.getByRole("link", {
      name: /BMW M3 Competition Martín M3 · 2026/,
    }),
  ).toBeVisible();
  await expect(staffPage.getByText("M3 Protection E2E")).toBeVisible();
  await expect(
    staffPage.getByRole("heading", { name: "Presupuestos" }),
  ).toHaveCount(0);
  await expect(staffPage.getByText("PRE-E2E-M3-DASH")).toHaveCount(0);
  await staffContext.close();
});
