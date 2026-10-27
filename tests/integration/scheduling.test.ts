import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import {
  cancelAppointment,
  createAppointment,
  createCalendarBlock,
  getCalendarRange,
  updateAppointment,
} from "@/modules/scheduling/application/scheduling-service";

const email = "build3-calendar@ferraro.test";
let actorId = "";
let clientId = "";
let vehicleId = "";
let alternateClientId = "";
let alternateVehicleId = "";
let categoryId = "";
let serviceId = "";
const appointmentIds: string[] = [];

describe("service cases and scheduling integration", () => {
  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: { name: "Agenda Test", email, role: UserRole.STAFF },
    });
    actorId = actor.id;
    const client = await prisma.client.create({
      data: { displayName: "Cliente Agenda Test" },
    });
    clientId = client.id;
    const vehicle = await prisma.vehicle.create({
      data: { clientId, brand: "BMW", model: "M3" },
    });
    vehicleId = vehicle.id;
    const alternateClient = await prisma.client.create({
      data: { displayName: "Cliente Reasignación Test" },
    });
    alternateClientId = alternateClient.id;
    alternateVehicleId = (
      await prisma.vehicle.create({
        data: {
          clientId: alternateClientId,
          brand: "Audi",
          model: "A3",
        },
      })
    ).id;
    const category = await prisma.serviceCategory.create({
      data: { name: `Agenda ${crypto.randomUUID()}` },
    });
    categoryId = category.id;
    const service = await prisma.service.create({
      data: {
        categoryId,
        name: "Cerámico agenda",
        estimatedDurationMinutes: 240,
      },
    });
    serviceId = service.id;
  });

  afterAll(async () => {
    await prisma.appointmentEmployee.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointmentService.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: appointmentIds } },
    });
    await prisma.calendarBlock.deleteMany({
      where: { reason: { startsWith: "Build 3" } },
    });
    await prisma.idempotencyKey.deleteMany({ where: { actorId } });
    const cases = await prisma.serviceCase.findMany({
      where: { clientId: { in: [clientId, alternateClientId] } },
      select: { id: true },
    });
    await prisma.financialEntry.deleteMany({
      where: { serviceCaseId: { in: cases.map((item) => item.id) } },
    });
    await prisma.serviceCase.deleteMany({
      where: { id: { in: cases.map((item) => item.id) } },
    });
    await prisma.service.deleteMany({ where: { id: serviceId } });
    await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.vehicle.deleteMany({ where: { id: alternateVehicleId } });
    await prisma.client.deleteMany({
      where: { id: { in: [clientId, alternateClientId] } },
    });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("creates an appointment and automatic case without payment or agreed amount", async () => {
    const key = crypto.randomUUID();
    const input = {
      clientId,
      vehicleId,
      startLocal: "2026-10-15T09:00",
      endLocal: "2026-10-15T13:00",
      serviceIds: [serviceId],
      employeeIds: [actorId],
      visibleToClient: true,
      idempotencyKey: key,
    };
    const first = await createAppointment(input, { id: actorId });
    appointmentIds.push(first.id);
    const replay = await createAppointment(input, { id: actorId });
    expect(replay).toEqual({ id: first.id, replayed: true });
    await expect(
      prisma.serviceCase.findFirst({
        where: { appointments: { some: { id: first.id } } },
      }),
    ).resolves.toMatchObject({
      agreedAmountUsd: null,
      origin: "DIRECT_APPOINTMENT",
    });
  });

  it("allows overlapping appointments and returns both by range", async () => {
    const overlap = await createAppointment(
      {
        clientId,
        vehicleId,
        startLocal: "2026-10-15T10:00",
        endLocal: "2026-10-15T12:00",
        serviceIds: [],
        employeeIds: [],
        visibleToClient: true,
        idempotencyKey: crypto.randomUUID(),
      },
      { id: actorId },
    );
    appointmentIds.push(overlap.id);
    const result = await getCalendarRange(
      new Date("2026-10-15T03:00:00Z"),
      new Date("2026-10-16T03:00:00Z"),
    );
    expect(
      result.appointments.filter((item) => appointmentIds.includes(item.id)),
    ).toHaveLength(2);
  });

  it("reassigns a safe direct appointment transactionally", async () => {
    const created = await createAppointment(
      {
        clientId,
        vehicleId,
        startLocal: "2026-10-18T09:00",
        endLocal: "2026-10-18T10:00",
        serviceIds: [serviceId],
        employeeIds: [],
        visibleToClient: true,
        idempotencyKey: crypto.randomUUID(),
      },
      { id: actorId },
    );
    appointmentIds.push(created.id);
    await updateAppointment(
      created.id,
      {
        clientId: alternateClientId,
        vehicleId: alternateVehicleId,
        startLocal: "2026-10-18T09:30",
        endLocal: "2026-10-18T10:30",
        serviceIds: [serviceId],
        employeeIds: [],
        visibleToClient: false,
      },
      { id: actorId },
    );
    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: created.id },
      include: { serviceCase: true },
    });
    expect(stored.serviceCase).toMatchObject({
      clientId: alternateClientId,
      vehicleId: alternateVehicleId,
    });
  });

  it("blocks reassignment when the case has financial history", async () => {
    const created = await createAppointment(
      {
        clientId,
        vehicleId,
        startLocal: "2026-10-19T09:00",
        endLocal: "2026-10-19T10:00",
        serviceIds: [],
        employeeIds: [],
        visibleToClient: true,
        idempotencyKey: crypto.randomUUID(),
      },
      { id: actorId },
    );
    appointmentIds.push(created.id);
    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: created.id },
      select: { serviceCaseId: true },
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
    await expect(
      updateAppointment(
        created.id,
        {
          clientId: alternateClientId,
          vehicleId: alternateVehicleId,
          startLocal: "2026-10-19T09:00",
          endLocal: "2026-10-19T10:00",
          serviceIds: [],
          employeeIds: [],
          visibleToClient: true,
        },
        { id: actorId },
      ),
    ).rejects.toThrow("APPOINTMENT_IDENTITY_LOCKED");
    const serviceCase = await prisma.serviceCase.findUniqueOrThrow({
      where: { id: appointment.serviceCaseId },
    });
    expect(serviceCase).toMatchObject({ clientId, vehicleId });
  });

  it("blocks new reservations but cancellation never creates a job", async () => {
    await createCalendarBlock(
      {
        reason: "Build 3 mantenimiento",
        startLocal: "2026-10-16T09:00",
        endLocal: "2026-10-16T18:00",
        allDay: false,
      },
      { id: actorId },
    );
    await expect(
      createAppointment(
        {
          clientId,
          vehicleId,
          startLocal: "2026-10-16T10:00",
          endLocal: "2026-10-16T11:00",
          serviceIds: [],
          employeeIds: [],
          visibleToClient: false,
          idempotencyKey: crypto.randomUUID(),
        },
        { id: actorId },
      ),
    ).rejects.toThrow("CALENDAR_BLOCKED");
    const appointmentId = appointmentIds[0];
    if (!appointmentId) throw new Error("Test appointment was not created");
    await cancelAppointment(appointmentId, { id: actorId });
    await expect(
      prisma.appointment.findUnique({ where: { id: appointmentId } }),
    ).resolves.toMatchObject({ status: "CANCELLED" });
  });
});
