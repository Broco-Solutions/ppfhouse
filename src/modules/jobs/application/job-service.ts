import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import {
  completeAppointmentSchema,
  directJobSchema,
  voidJobSchema,
  type CompleteAppointmentInput,
  type DirectJobInput,
} from "@/modules/jobs/domain/job-schema";
import { businessLocalDateTimeToUtc } from "@/shared/date-time/business-time";

interface Actor {
  id: string;
}

function requestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function jobRelations(
  tx: Prisma.TransactionClient,
  serviceIds: string[],
  employeeIds: string[],
) {
  const [services, employees] = await Promise.all([
    tx.service.findMany({
      where: {
        id: { in: serviceIds },
        active: true,
        category: { active: true },
      },
      select: { id: true, name: true, commercialDescription: true },
    }),
    tx.user.findMany({
      where: { id: { in: employeeIds }, active: true },
      select: { id: true },
    }),
  ]);
  if (services.length !== new Set(serviceIds).size)
    throw new Error("SERVICE_NOT_AVAILABLE");
  if (employees.length !== new Set(employeeIds).size)
    throw new Error("EMPLOYEE_NOT_AVAILABLE");
  return { services, employees };
}

function nestedJobData(relations: Awaited<ReturnType<typeof jobRelations>>) {
  return {
    services: {
      create: relations.services.map((service, index) => ({
        serviceId: service.id,
        nameSnapshot: service.name,
        descriptionSnapshot: service.commercialDescription,
        sortOrder: index,
      })),
    },
    employees: {
      create: relations.employees.map((employee) => ({ userId: employee.id })),
    },
  };
}

export async function completeAppointment(
  input: CompleteAppointmentInput,
  actor: Actor,
) {
  const data = completeAppointmentSchema.parse(input);
  const performedAt = businessLocalDateTimeToUtc(data.performedLocal);
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: data.appointmentId },
      select: {
        id: true,
        status: true,
        serviceCaseId: true,
        job: { select: { id: true } },
      },
    });
    if (!appointment) throw new Error("APPOINTMENT_NOT_FOUND");
    if (appointment.job) return { id: appointment.job.id, replayed: true };
    if (appointment.status !== "CONFIRMED")
      throw new Error("APPOINTMENT_NOT_COMPLETABLE");
    const relations = await jobRelations(tx, data.serviceIds, data.employeeIds);
    const job = await tx.job.create({
      data: {
        serviceCaseId: appointment.serviceCaseId,
        originAppointmentId: appointment.id,
        performedAt,
        notes: data.notes,
        createdById: actor.id,
        updatedById: actor.id,
        ...nestedJobData(relations),
      },
      select: { id: true },
    });
    const updated = await tx.appointment.updateMany({
      where: { id: appointment.id, status: "CONFIRMED" },
      data: { status: "COMPLETED", updatedById: actor.id },
    });
    if (updated.count !== 1) throw new Error("APPOINTMENT_NOT_COMPLETABLE");
    return { id: job.id, replayed: false };
  });
}

export async function createDirectJob(input: DirectJobInput, actor: Actor) {
  const data = directJobSchema.parse(input);
  const hash = requestHash(data);
  const performedAt = businessLocalDateTimeToUtc(data.performedLocal);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.idempotencyKey.findUnique({
      where: {
        operation_key: {
          operation: "CREATE_DIRECT_JOB",
          key: data.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestHash !== hash)
        throw new Error("IDEMPOTENCY_CONFLICT");
      if (!existing.resultReference) throw new Error("IDEMPOTENCY_INCOMPLETE");
      return { id: existing.resultReference, replayed: true };
    }
    const vehicle = await tx.vehicle.findFirst({
      where: {
        id: data.vehicleId,
        clientId: data.clientId,
        active: true,
        client: { active: true },
      },
      select: { id: true },
    });
    if (!vehicle) throw new Error("VEHICLE_CLIENT_MISMATCH");
    const relations = await jobRelations(tx, data.serviceIds, data.employeeIds);
    const serviceCase = await tx.serviceCase.create({
      data: {
        clientId: data.clientId,
        vehicleId: data.vehicleId,
        origin: "DIRECT_JOB",
        createdById: actor.id,
      },
      select: { id: true },
    });
    const job = await tx.job.create({
      data: {
        serviceCaseId: serviceCase.id,
        performedAt,
        notes: data.notes,
        createdById: actor.id,
        updatedById: actor.id,
        ...nestedJobData(relations),
      },
      select: { id: true },
    });
    await tx.idempotencyKey.create({
      data: {
        operation: "CREATE_DIRECT_JOB",
        key: data.idempotencyKey,
        actorId: actor.id,
        requestHash: hash,
        resultReference: job.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    });
    return { id: job.id, replayed: false };
  });
}

export async function voidJob(input: unknown, actor: Actor) {
  const data = voidJobSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "jobs" WHERE "id" = ${data.jobId}::uuid FOR UPDATE`,
    );
    const job = await tx.job.findUnique({
      where: { id: data.jobId },
      select: {
        id: true,
        voidedAt: true,
        materialConsumptions: {
          where: { replacedBy: null },
          select: {
            itemId: true,
            quantityBase: true,
            unitSnapshot: true,
            movement: {
              select: { id: true, reversedBy: { select: { id: true } } },
            },
          },
        },
      },
    });
    if (!job || job.voidedAt) throw new Error("JOB_NOT_VOIDABLE");
    for (const consumption of job.materialConsumptions) {
      if (!consumption.movement)
        throw new Error("CONSUMPTION_LEDGER_INCONSISTENT");
      if (consumption.movement.reversedBy) continue;
      await tx.inventoryItem.update({
        where: { id: consumption.itemId },
        data: { currentStock: { increment: consumption.quantityBase } },
      });
      await tx.inventoryMovement.create({
        data: {
          itemId: consumption.itemId,
          type: "REVERSAL",
          signedQuantityBase: consumption.quantityBase,
          unitSnapshot: consumption.unitSnapshot,
          occurredAt: new Date(),
          note: `Anulación de trabajo: ${data.reason}`,
          reversalOfId: consumption.movement.id,
          createdById: actor.id,
        },
      });
    }
    await tx.job.update({
      where: { id: job.id },
      data: {
        voidedAt: new Date(),
        voidReason: data.reason,
        updatedById: actor.id,
      },
    });
  });
}

export async function listJobOptions() {
  const [clients, services, employees] = await Promise.all([
    prisma.client.findMany({
      where: { active: true, vehicles: { some: { active: true } } },
      select: {
        id: true,
        displayName: true,
        vehicles: {
          where: { active: true },
          select: { id: true, brand: true, model: true, year: true },
          orderBy: [{ brand: "asc" }, { model: "asc" }],
        },
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.service.findMany({
      where: { active: true, category: { active: true } },
      select: { id: true, name: true, category: { select: { name: true } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { clients, services, employees };
}

export async function getCompletionContext(appointmentId: string) {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      status: true,
      startAt: true,
      job: { select: { id: true } },
      serviceCase: {
        select: {
          client: { select: { displayName: true } },
          vehicle: { select: { brand: true, model: true, year: true } },
        },
      },
      services: { select: { serviceId: true }, orderBy: { sortOrder: "asc" } },
      employees: { select: { userId: true } },
    },
  });
}

export async function listJobs(options: {
  query?: string;
  status?: "active" | "voided" | "all";
  page?: number;
  pageSize?: number;
}) {
  const query = options.query?.trim();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const where: Prisma.JobWhereInput = {
    voidedAt:
      options.status === "all"
        ? undefined
        : options.status === "voided"
          ? { not: null }
          : null,
    OR: query
      ? [
          {
            serviceCase: {
              client: { displayName: { contains: query, mode: "insensitive" } },
            },
          },
          {
            serviceCase: {
              vehicle: { brand: { contains: query, mode: "insensitive" } },
            },
          },
          {
            serviceCase: {
              vehicle: { model: { contains: query, mode: "insensitive" } },
            },
          },
          {
            services: {
              some: { nameSnapshot: { contains: query, mode: "insensitive" } },
            },
          },
        ]
      : undefined,
  };
  const [items, total] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      select: {
        id: true,
        performedAt: true,
        voidedAt: true,
        serviceCase: {
          select: {
            client: { select: { displayName: true } },
            vehicle: { select: { brand: true, model: true, year: true } },
          },
        },
        services: {
          select: { nameSnapshot: true },
          orderBy: { sortOrder: "asc" },
        },
        employees: { select: { user: { select: { name: true } } } },
      },
      orderBy: { performedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getJobDetail(id: string, includeFinancial = false) {
  return prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      serviceCaseId: true,
      performedAt: true,
      notes: true,
      voidedAt: true,
      voidReason: true,
      serviceCase: {
        select: {
          id: true,
          ...(includeFinancial
            ? {
                agreedAmountUsd: true,
                agreedSourceCurrency: true,
                agreedSourceAmount: true,
                agreedExchangeRateArsPerUsd: true,
                directCostUsd: true,
                directCostSourceCurrency: true,
                directCostSourceAmount: true,
                directCostExchangeRateArsPerUsd: true,
              }
            : {}),
          client: { select: { displayName: true } },
          vehicle: {
            select: {
              id: true,
              brand: true,
              model: true,
              version: true,
              year: true,
              color: true,
            },
          },
        },
      },
      originAppointment: { select: { id: true, startAt: true, endAt: true } },
      services: { orderBy: { sortOrder: "asc" } },
      employees: { include: { user: { select: { id: true, name: true } } } },
      materialConsumptions: {
        select: {
          id: true,
          quantityBase: true,
          unitSnapshot: true,
          note: true,
          createdAt: true,
          replacesId: true,
          item: { select: { id: true, name: true } },
          movement: {
            select: { reversedBy: { select: { id: true, note: true } } },
          },
          replacedBy: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      photos: {
        where: { deletedAt: null },
        select: {
          id: true,
          stage: true,
          width: true,
          height: true,
          sortOrder: true,
          isCover: true,
          visibleToClient: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function listClientJobHistory(clientId: string) {
  return prisma.job.findMany({
    where: { serviceCase: { clientId } },
    select: {
      id: true,
      performedAt: true,
      voidedAt: true,
      serviceCase: {
        select: { vehicle: { select: { brand: true, model: true } } },
      },
      services: {
        select: { nameSnapshot: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { performedAt: "desc" },
    take: 20,
  });
}
