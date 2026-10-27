import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createTestPrisma,
  e2eUsers,
  resetE2EAuthRateLimit,
} from "./auth.fixtures";

const clientName = "Agenda E2E Cliente";
const alternateClientName = "Agenda E2E Alternativo";
const emptyClientName = "Agenda E2E Sin Vehículo";
const quickClientName = "Agenda E2E Inline";
const categoryName = "Agenda E2E Categoría";
let clientId = "";
let alternateClientId = "";
let alternateVehicleId = "";

async function captureCalendarEvidence(page: Page, name: string) {
  if (!process.env.FE_EVIDENCE_DIR) return;
  for (const [viewport, width, height] of [
    ["1440x900", 1440, 900],
    ["390x844", 390, 844],
  ] as const) {
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
    await page.screenshot({
      fullPage: true,
      path: `${process.env.FE_EVIDENCE_DIR}/${name}-${viewport}.png`,
    });
  }
}

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

async function selectClient(page: Page, client: string) {
  const clientPicker = page.getByRole("combobox", { name: "Cliente *" });
  await clientPicker.fill(client);
  await expect(clientPicker).toHaveAttribute("aria-busy", "true");
  await expect(clientPicker).not.toHaveAttribute("aria-busy", "true");
  await clientPicker.press("ArrowDown");
  await page.getByRole("option", { name: new RegExp(client, "i") }).click();
}

async function cleanup() {
  const prisma = createTestPrisma();
  try {
    const clients = await prisma.client.findMany({
      where: {
        displayName: {
          in: [
            clientName,
            alternateClientName,
            emptyClientName,
            quickClientName,
          ],
        },
      },
      select: { id: true },
    });
    const ids = clients.map((client) => client.id);
    const cases = await prisma.serviceCase.findMany({
      where: { clientId: { in: ids } },
      select: { id: true },
    });
    const caseIds = cases.map((item) => item.id);
    const appointments = await prisma.appointment.findMany({
      where: { serviceCaseId: { in: caseIds } },
      select: { id: true },
    });
    const appointmentIds = appointments.map((item) => item.id);
    await prisma.financialEntry.deleteMany({
      where: { serviceCaseId: { in: caseIds } },
    });
    await prisma.appointmentEmployee.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointmentService.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: appointmentIds } },
    });
    await prisma.idempotencyKey.deleteMany({
      where: { resultReference: { in: appointmentIds } },
    });
    await prisma.serviceCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.vehicle.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.client.deleteMany({ where: { id: { in: ids } } });
    await prisma.calendarBlock.deleteMany({
      where: { reason: "Agenda E2E bloqueo" },
    });
    const categories = await prisma.serviceCategory.findMany({
      where: { name: categoryName },
      select: { id: true },
    });
    await prisma.service.deleteMany({
      where: { categoryId: { in: categories.map((category) => category.id) } },
    });
    await prisma.serviceCategory.deleteMany({
      where: { id: { in: categories.map((category) => category.id) } },
    });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(async () => {
  await cleanup();
  const prisma = createTestPrisma();
  try {
    const client = await prisma.client.create({
      data: {
        displayName: clientName,
        phone: "+54 341 555 0101",
        normalizedPhone: "543415550101",
        email: "agenda-existing@ferraro.test",
      },
    });
    clientId = client.id;
    await prisma.vehicle.create({
      data: { clientId, brand: "BMW", model: "M3", year: 2024 },
    });
    alternateClientId = (
      await prisma.client.create({ data: { displayName: alternateClientName } })
    ).id;
    alternateVehicleId = (
      await prisma.vehicle.create({
        data: {
          clientId: alternateClientId,
          brand: "Audi",
          model: "A3",
          year: 2025,
        },
      })
    ).id;
    await prisma.client.create({ data: { displayName: emptyClientName } });
    const category = await prisma.serviceCategory.create({
      data: { name: categoryName },
    });
    await prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Cerámico Agenda E2E",
        estimatedDurationMinutes: 240,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
});
test.afterAll(cleanup);

test("STAFF schedules overlapping cars and a block prevents a new reservation", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);
  await page.goto("/app/calendar/new?date=2026-10-15");
  await selectClientVehicle(page, clientName, "BMW M3");
  await page.getByLabel("Hora de inicio").fill("09:00");
  await page.getByLabel("Hora de fin").fill("13:00");
  await page.getByText("Cerámico Agenda E2E").click();
  await page.getByRole("button", { name: "Crear turno" }).click();
  await expect(page.getByText("Turno confirmado")).toBeVisible();
  await expect(page.getByText("Turno agendado correctamente.")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/calendar\/[^/?]+\?created=1$/);
  await expect(page.getByLabel("Hora de inicio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Crear turno" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Editar turno" })).toBeVisible();

  await page.goto("/app/calendar/new?date=2026-10-15");
  await selectClientVehicle(page, clientName, "BMW M3");
  await page.getByLabel("Hora de inicio").fill("10:00");
  await page.getByLabel("Hora de fin").fill("12:00");
  await page.getByRole("button", { name: "Crear turno" }).click();
  await expect(page.getByText("Turno confirmado")).toBeVisible();
  await expect(page.getByText("Turno agendado correctamente.")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/calendar\/[^/?]+\?created=1$/);
  await expect(page.getByLabel("Hora de inicio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Crear turno" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Editar turno" })).toBeVisible();

  await page.goto("/app/calendar/blocks/new?date=2026-10-16");
  await page.getByLabel("Motivo *").fill("Agenda E2E bloqueo");
  await page.getByLabel("Hora de inicio").fill("09:00");
  await page.getByLabel("Hora de fin").fill("18:00");
  await page.getByRole("button", { name: "Crear bloqueo" }).click();
  await expect(page.getByText("Bloqueo creado correctamente.")).toBeVisible();

  await page.goto("/app/calendar/new?date=2026-10-16");
  await selectClientVehicle(page, clientName, "BMW M3");
  await page.getByLabel("Hora de inicio").fill("10:00");
  await page.getByLabel("Hora de fin").fill("12:00");
  await page.getByRole("button", { name: "Crear turno" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "horario está bloqueado" }),
  ).toBeVisible();
});

test("quick-create keeps appointment state, creates two vehicles and avoids a strong duplicate", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/app/calendar/new?date=2026-10-20");
  await page.getByLabel("Hora de inicio").fill("10:15");
  await page.getByLabel("Hora de fin").fill("14:15");
  await page.getByText("Cerámico Agenda E2E").click();

  const clientPicker = page.getByRole("combobox", { name: "Cliente *" });
  await page.getByRole("button", { name: "Nuevo cliente + vehículo" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByLabel("Hora de inicio")).toHaveValue("10:15");
  await page.getByRole("button", { name: "Nuevo cliente + vehículo" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Crear cliente y vehículos",
  });
  await expect(dialog.getByRole("textbox")).toHaveCount(4);
  await dialog.getByLabel("Nombre *").fill(quickClientName);
  await dialog.getByLabel("Teléfono").fill("+54 341 555 0202");
  await dialog.getByLabel("Marca *").fill("BMW");
  await dialog.getByLabel("Modelo *").fill("M4");
  await dialog.getByRole("button", { name: "Agregar otro" }).click();
  await dialog.getByLabel("Marca *").nth(1).fill("Porsche");
  await dialog.getByLabel("Modelo *").nth(1).fill("Macan");
  const dialogAxe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(dialogAxe.violations).toEqual([]);
  if (process.env.FE_EVIDENCE_DIR) {
    await page.setViewportSize({ width: 390, height: 844 });
    await dialog
      .getByRole("heading", { name: "Crear cliente y vehículos" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${process.env.FE_EVIDENCE_DIR}/calendar-quick-create-top-390x844.png`,
    });
  }
  await dialog.getByRole("button", { name: "Crear y continuar" }).click();
  await expect(dialog).toBeHidden();
  await expect(clientPicker).toHaveValue(quickClientName);
  await expect(page.getByRole("combobox", { name: "Vehículo *" })).toHaveValue(
    /BMW.*M4/,
  );
  await expect(page.getByLabel("Hora de inicio")).toHaveValue("10:15");
  await expect(
    page.getByRole("checkbox", { name: /Cerámico Agenda E2E/ }),
  ).toBeChecked();
  await captureCalendarEvidence(page, "calendar-new-preserved");
  await page.getByRole("button", { name: "Crear turno" }).click();
  await expect(page.getByText("Turno confirmado")).toBeVisible();
  await expect(page.getByText("Turno agendado correctamente.")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/calendar\/[^/?]+\?created=1$/);
  await expect(page.getByLabel("Hora de inicio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Crear turno" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Editar turno" })).toBeVisible();
  const detailAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(detailAxe.violations).toEqual([]);
  await captureCalendarEvidence(page, "calendar-detail");

  await page.goto("/app/calendar/new?date=2026-10-21");
  const duplicatePicker = page.getByRole("combobox", { name: "Cliente *" });
  await duplicatePicker.fill("Duplicado");
  await expect(duplicatePicker).toHaveAttribute("aria-busy", "true");
  await expect(duplicatePicker).not.toHaveAttribute("aria-busy", "true");
  await duplicatePicker.press("ArrowDown");
  await page.getByRole("button", { name: "Nuevo cliente + vehículo" }).click();
  const duplicateDialog = page.getByRole("dialog", {
    name: "Crear cliente y vehículos",
  });
  await duplicateDialog.getByLabel("Teléfono").fill("+54 341 555 0101");
  await duplicateDialog.getByLabel("Marca *").fill("Ford");
  await duplicateDialog.getByLabel("Modelo *").fill("Focus");
  await duplicateDialog
    .getByRole("button", { name: "Crear y continuar" })
    .click();
  await expect(
    duplicateDialog.getByText("Ya existe un cliente con estos datos."),
  ).toBeVisible();
  await duplicateDialog
    .getByRole("button", { name: "Usar este cliente" })
    .click();
  await expect(page.getByRole("combobox", { name: "Cliente *" })).toHaveValue(
    clientName,
  );
  const prisma = createTestPrisma();
  await expect(
    prisma.client.count({ where: { normalizedPhone: "543415550101" } }),
  ).resolves.toBe(1);
  await prisma.$disconnect();
});

test("an existing client without a vehicle can add one inline", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/calendar/new?date=2026-10-22");
  await selectClient(page, emptyClientName);
  const vehiclePicker = page.getByRole("combobox", { name: "Vehículo *" });
  await expect(vehiclePicker).not.toHaveAttribute("aria-busy", "true");
  await expect(
    page.getByText("Este cliente todavía no tiene vehículos."),
  ).toBeVisible();
  await page
    .getByText("Este cliente todavía no tiene vehículos.")
    .locator("..")
    .getByRole("button", { name: "Agregar vehículo" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Agregar vehículo" });
  await dialog.getByLabel("Marca *").fill("Toyota");
  await dialog.getByLabel("Modelo *").fill("Corolla");
  await dialog.getByRole("button", { name: "Agregar y seleccionar" }).click();
  await expect(vehiclePicker).toHaveValue(/Toyota.*Corolla/);
});

test("calendar views, date control and status labels remain keyboard accessible", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/calendar?view=day&date=2026-10-15");

  await expect(page.getByLabel(/BMW M3, Confirmado/)).toHaveCount(2);
  const dayAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(dayAxe.violations).toEqual([]);

  const weekView = page.getByRole("link", { name: "Semana" });
  await weekView.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/view=week&date=2026-10-15/);
  await expect(
    page.getByRole("region", { name: "Semana desplazable" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Elegir fecha" }).click();
  await page
    .getByRole("button", { name: /viernes, 16 de octubre de 2026/i })
    .click();
  await expect(page).toHaveURL(/view=week&date=2026-10-16/);
  await expect(page.getByText("Agenda E2E bloqueo")).toBeVisible();

  await page.getByRole("link", { name: "Mes" }).click();
  await expect(page).toHaveURL(/view=month&date=2026-10-16/);
  await expect(
    page.getByRole("region", { name: /viernes, 16 de octubre de 2026/i }),
  ).toBeVisible();
});

test("appointment identity can change only before commercial history exists", async ({
  page,
}) => {
  await login(page);
  const lookup = createTestPrisma();
  const serviceCase = await lookup.serviceCase.create({
    data: {
      clientId,
      vehicleId: (
        await lookup.vehicle.findFirstOrThrow({
          where: { clientId, brand: "BMW", model: "M3" },
          select: { id: true },
        })
      ).id,
      origin: "DIRECT_APPOINTMENT",
    },
  });
  const safeAppointmentId = (
    await lookup.appointment.create({
      data: {
        serviceCaseId: serviceCase.id,
        startAt: new Date("2026-10-24T12:00:00.000Z"),
        endAt: new Date("2026-10-24T13:00:00.000Z"),
        status: "CONFIRMED",
      },
      select: { id: true },
    })
  ).id;
  await lookup.$disconnect();
  await page.goto(`/app/calendar/${safeAppointmentId}`);
  await expect(page.getByLabel("Hora de inicio")).toHaveCount(0);
  await page.getByRole("link", { name: "Editar turno" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/app/calendar/${safeAppointmentId}/edit$`),
  );
  await selectClientVehicle(page, alternateClientName, "Audi A3");
  await page.getByRole("button", { name: "Guardar turno" }).click();
  await expect(
    page.getByText("El turno se actualizó correctamente."),
  ).toBeVisible();

  const prisma = createTestPrisma();
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: safeAppointmentId },
    select: { serviceCaseId: true },
  });
  await expect(
    prisma.serviceCase.findUniqueOrThrow({
      where: { id: appointment.serviceCaseId },
    }),
  ).resolves.toMatchObject({
    clientId: alternateClientId,
    vehicleId: alternateVehicleId,
  });
  await prisma.financialEntry.create({
    data: {
      direction: "INFLOW",
      type: "CUSTOMER_PAYMENT",
      amountUsd: "100",
      sourceCurrency: "USD",
      sourceAmount: "100",
      occurredAt: new Date(),
      serviceCaseId: appointment.serviceCaseId,
    },
  });
  await prisma.$disconnect();

  await page.reload();
  await page.getByRole("link", { name: "Editar turno" }).click();
  await expect(
    page.getByText(/información comercial o histórica/),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Cliente *" })).toHaveCount(
    0,
  );
});

test("late, early and overnight appointments remain reachable with wheel, keyboard and mobile scrolling", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto("/app/calendar/new?date=2026-10-25");
  await selectClientVehicle(page, clientName, "BMW M3");
  await page.getByLabel("Hora de inicio").fill("20:00");
  await page.getByLabel("Hora de fin").fill("21:00");
  await page.getByRole("button", { name: "Crear turno" }).click();
  await expect(page.getByText("Turno agendado correctamente.")).toBeVisible();

  const prisma = createTestPrisma();
  try {
    const vehicle = await prisma.vehicle.findFirstOrThrow({
      where: { clientId, brand: "BMW", model: "M3" },
    });
    await prisma.serviceCase.create({
      data: {
        clientId,
        vehicleId: vehicle.id,
        origin: "DIRECT_APPOINTMENT",
        appointments: {
          create: [
            {
              startAt: new Date("2026-10-25T09:00:00Z"),
              endAt: new Date("2026-10-25T09:30:00Z"),
            },
            {
              startAt: new Date("2026-10-26T02:45:00Z"),
              endAt: new Date("2026-10-26T03:15:00Z"),
            },
            {
              startAt: new Date("2026-10-26T02:55:00Z"),
              endAt: new Date("2026-10-26T02:59:00Z"),
            },
          ],
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  await page.getByRole("link", { name: "← Agenda", exact: true }).click();
  await expect(page).toHaveURL(/view=day&date=2026-10-25/);
  const scroller = page.getByRole("region", {
    name: "Horarios del 2026-10-25",
  });
  const evening = scroller.getByRole("link", { name: /20:00 a 21:00/ });
  const overnight = scroller.getByRole("link", { name: /23:45 a 00:15/ });
  const lastMinutes = scroller.getByRole("link", { name: /23:55 a 23:59/ });
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  const initialScroll = await scroller.evaluate((element) => element.scrollTop);
  await scroller.scrollIntoViewIfNeeded();
  await scroller.hover();
  await page.mouse.wheel(0, 1800);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialScroll);
  await expect(evening).toBeInViewport({ ratio: 1 });
  await expect(overnight).toBeInViewport({ ratio: 1 });
  await expect(lastMinutes).toBeInViewport({ ratio: 1 });

  await scroller.focus();
  await scroller.press("Home");
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(
    scroller.getByRole("link", { name: /06:00 a 06:30/ }),
  ).toBeInViewport({ ratio: 1 });
  await scroller.press("End");
  await expect(lastMinutes).toBeInViewport({ ratio: 1 });
  if (process.env.FE_EVIDENCE_DIR) {
    await page.screenshot({
      path: `${process.env.FE_EVIDENCE_DIR}/calendar-late-desktop.png`,
      fullPage: true,
    });
  }
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await evening.click();
  await expect(
    page.getByRole("heading", { name: "Detalle del turno" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/calendar?view=day&date=2026-10-25");
  await expect
    .poll(() =>
      scroller.evaluate(
        (element) => element.scrollHeight - element.clientHeight,
      ),
    )
    .toBeLessThanOrEqual(1);
  await lastMinutes.scrollIntoViewIfNeeded();
  await expect(lastMinutes).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  if (process.env.FE_EVIDENCE_DIR) {
    await page.screenshot({
      path: `${process.env.FE_EVIDENCE_DIR}/calendar-late-mobile.png`,
      fullPage: true,
    });
  }
  await overnight.click();
  await expect(
    page.getByRole("heading", { name: "Detalle del turno" }),
  ).toBeVisible();
  await page.goto("/app/calendar?view=day&date=2026-10-26");
  const nextDay = page.getByRole("region", { name: "Horarios del 2026-10-26" });
  await expect(
    nextDay.getByRole("link", { name: /23:45 a 00:15/ }),
  ).toBeVisible();
});
