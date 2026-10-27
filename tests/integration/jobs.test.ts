import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresAdapter } from "@/infrastructure/db/adapter";
import {
  completeAppointment,
  createDirectJob,
  voidJob,
} from "@/modules/jobs/application/job-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: createPostgresAdapter(connectionString),
});
const suffix = randomUUID().slice(0, 8);
let actorId = "";
let clientId = "";
let vehicleId = "";
let serviceId = "";
let appointmentId = "";
const jobIds: string[] = [];
const caseIds: string[] = [];

describe("jobs integration", () => {
  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: {
        name: `Jobs actor ${suffix}`,
        email: `jobs-${suffix}@ferraro.test`,
        emailVerified: true,
      },
    });
    actorId = actor.id;
    const client = await prisma.client.create({
      data: { displayName: `Jobs client ${suffix}` },
    });
    clientId = client.id;
    const vehicle = await prisma.vehicle.create({
      data: { clientId, brand: "Porsche", model: "911", year: 2025 },
    });
    vehicleId = vehicle.id;
    const category = await prisma.serviceCategory.create({
      data: { name: `Jobs category ${suffix}` },
    });
    const service = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Pulido ${suffix}`,
        commercialDescription: "Corrección fina de pintura",
      },
    });
    serviceId = service.id;
    const serviceCase = await prisma.serviceCase.create({
      data: {
        clientId,
        vehicleId,
        origin: "DIRECT_APPOINTMENT",
        createdById: actorId,
      },
    });
    caseIds.push(serviceCase.id);
    const appointment = await prisma.appointment.create({
      data: {
        serviceCaseId: serviceCase.id,
        startAt: new Date("2026-10-20T12:00:00Z"),
        endAt: new Date("2026-10-20T16:00:00Z"),
        services: {
          create: { serviceId, nameSnapshot: service.name, sortOrder: 0 },
        },
      },
    });
    appointmentId = appointment.id;
  });

  afterAll(async () => {
    await prisma.jobEmployee.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.jobService.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.idempotencyKey.deleteMany({
      where: { resultReference: { in: jobIds } },
    });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.appointmentService.deleteMany({ where: { appointmentId } });
    await prisma.appointment.deleteMany({ where: { id: appointmentId } });
    await prisma.serviceCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.service.deleteMany({ where: { id: serviceId } });
    await prisma.serviceCategory.deleteMany({
      where: { name: `Jobs category ${suffix}` },
    });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.client.deleteMany({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("atomically completes an appointment and preserves service snapshots", async () => {
    const first = await completeAppointment(
      {
        appointmentId,
        performedLocal: "2026-10-20T13:30",
        serviceIds: [serviceId],
        employeeIds: [actorId],
        notes: "Terminación verificada",
      },
      { id: actorId },
    );
    jobIds.push(first.id);
    const replay = await completeAppointment(
      {
        appointmentId,
        performedLocal: "2026-10-20T13:30",
        serviceIds: [serviceId],
        employeeIds: [actorId],
        notes: "Terminación verificada",
      },
      { id: actorId },
    );
    expect(replay).toEqual({ id: first.id, replayed: true });
    await prisma.service.update({
      where: { id: serviceId },
      data: { name: `Renombrado ${suffix}` },
    });
    const job = await prisma.job.findUniqueOrThrow({
      where: { id: first.id },
      include: { services: true, originAppointment: true },
    });
    expect(job.services[0]?.nameSnapshot).toBe(`Pulido ${suffix}`);
    expect(job.services[0]?.descriptionSnapshot).toBe(
      "Corrección fina de pintura",
    );
    expect(job.originAppointment?.status).toBe("COMPLETED");
  });

  it("creates a direct job and automatic case without any payment", async () => {
    const input = {
      clientId,
      vehicleId,
      performedLocal: "2026-10-21T09:00",
      serviceIds: [],
      employeeIds: [],
      idempotencyKey: randomUUID(),
    };
    const result = await createDirectJob(input, { id: actorId });
    jobIds.push(result.id);
    const replay = await createDirectJob(input, { id: actorId });
    expect(replay).toEqual({ id: result.id, replayed: true });
    const job = await prisma.job.findUniqueOrThrow({
      where: { id: result.id },
      include: { serviceCase: true },
    });
    caseIds.push(job.serviceCaseId);
    expect(job.originAppointmentId).toBeNull();
    expect(job.serviceCase).toMatchObject({
      origin: "DIRECT_JOB",
      agreedAmountUsd: null,
    });
  });

  it("voids without deleting the historical fact", async () => {
    const id = jobIds[1];
    if (!id) throw new Error("Direct job fixture missing");
    await voidJob({ jobId: id, reason: "Carga duplicada" }, { id: actorId });
    await expect(
      prisma.job.findUnique({ where: { id } }),
    ).resolves.toMatchObject({ voidReason: "Carga duplicada" });
  });
});
