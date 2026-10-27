import { createHash } from "node:crypto";

import { AppointmentStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import {
  searchClientPickerOptions,
  searchVehiclePickerOptions,
} from "@/modules/clients/application/client-service";
import { appointmentReassignmentEligibility } from "@/modules/scheduling/domain/appointment-reassignment";
import {
  appointmentEditSchema,
  appointmentInputSchema,
  calendarBlockInputSchema,
  quoteAppointmentInputSchema,
  type AppointmentEditInput,
  type AppointmentInput,
  type CalendarBlockInput,
  type QuoteAppointmentInput,
} from "@/modules/scheduling/domain/scheduling-schema";
import { businessLocalDateTimeToUtc } from "@/shared/date-time/business-time";

interface Actor {
  id: string;
}

function inputHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertRange(startAt: Date, endAt: Date) {
  if (endAt <= startAt) throw new Error("INVALID_APPOINTMENT_RANGE");
}

async function validatedRelations(
  tx: Prisma.TransactionClient,
  input: {
    clientId: string;
    vehicleId: string;
    serviceIds: string[];
    employeeIds: string[];
  },
) {
  const [vehicle, services, employees] = await Promise.all([
    tx.vehicle.findFirst({
      where: {
        id: input.vehicleId,
        clientId: input.clientId,
        active: true,
        client: { active: true },
      },
      select: { id: true },
    }),
    tx.service.findMany({
      where: {
        id: { in: input.serviceIds },
        active: true,
        category: { active: true },
      },
      select: {
        id: true,
        name: true,
        estimatedDurationMinutes: true,
        sortOrder: true,
      },
    }),
    tx.user.findMany({
      where: { id: { in: input.employeeIds }, active: true },
      select: { id: true },
    }),
  ]);
  if (!vehicle) throw new Error("VEHICLE_CLIENT_MISMATCH");
  if (services.length !== new Set(input.serviceIds).size)
    throw new Error("SERVICE_NOT_AVAILABLE");
  if (employees.length !== new Set(input.employeeIds).size)
    throw new Error("EMPLOYEE_NOT_AVAILABLE");
  return { services, employees };
}

async function assertNoBlock(
  tx: Prisma.TransactionClient,
  startAt: Date,
  endAt: Date,
  excludeAppointmentId?: string,
) {
  const block = await tx.calendarBlock.findFirst({
    where: { active: true, startAt: { lt: endAt }, endAt: { gt: startAt } },
    select: { reason: true },
  });
  if (block) throw new Error(`CALENDAR_BLOCKED:${block.reason}`);
  void excludeAppointmentId;
}

export async function createAppointment(input: AppointmentInput, actor: Actor) {
  const data = appointmentInputSchema.parse(input);
  const startAt = businessLocalDateTimeToUtc(data.startLocal);
  const endAt = businessLocalDateTimeToUtc(data.endLocal);
  assertRange(startAt, endAt);
  const requestHash = inputHash(data);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.idempotencyKey.findUnique({
      where: {
        operation_key: {
          operation: "CREATE_APPOINTMENT",
          key: data.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new Error("IDEMPOTENCY_CONFLICT");
      if (!existing.resultReference) throw new Error("IDEMPOTENCY_INCOMPLETE");
      return { id: existing.resultReference, replayed: true };
    }
    const { services, employees } = await validatedRelations(tx, data);
    await assertNoBlock(tx, startAt, endAt);
    const serviceCase = await tx.serviceCase.create({
      data: {
        clientId: data.clientId,
        vehicleId: data.vehicleId,
        origin: "DIRECT_APPOINTMENT",
        createdById: actor.id,
      },
      select: { id: true },
    });
    const appointment = await tx.appointment.create({
      data: {
        serviceCaseId: serviceCase.id,
        startAt,
        endAt,
        status: "CONFIRMED",
        internalNotes: data.internalNotes,
        visibleToClient: data.visibleToClient,
        color: data.color,
        createdById: actor.id,
        updatedById: actor.id,
        services: {
          create: services.map((service, index) => ({
            serviceId: service.id,
            nameSnapshot: service.name,
            durationMinutesSnapshot: service.estimatedDurationMinutes,
            sortOrder: index,
          })),
        },
        employees: {
          create: employees.map((employee) => ({ userId: employee.id })),
        },
      },
      select: { id: true },
    });
    await tx.idempotencyKey.create({
      data: {
        operation: "CREATE_APPOINTMENT",
        key: data.idempotencyKey,
        actorId: actor.id,
        requestHash,
        resultReference: appointment.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return { id: appointment.id, replayed: false };
  });
}

export async function createAppointmentFromQuote(
  input: QuoteAppointmentInput,
  actor: Actor,
) {
  const data = quoteAppointmentInputSchema.parse(input);
  const startAt = businessLocalDateTimeToUtc(data.startLocal);
  const endAt = businessLocalDateTimeToUtc(data.endLocal);
  assertRange(startAt, endAt);
  const hash = inputHash(data);
  return prisma.$transaction(async (tx) => {
    const existingKey = await tx.idempotencyKey.findUnique({
      where: {
        operation_key: {
          operation: "QUOTE_TO_APPOINTMENT",
          key: data.idempotencyKey,
        },
      },
    });
    if (existingKey) {
      if (existingKey.requestHash !== hash)
        throw new Error("IDEMPOTENCY_CONFLICT");
      if (!existingKey.resultReference)
        throw new Error("IDEMPOTENCY_INCOMPLETE");
      return { id: existingKey.resultReference, replayed: true };
    }
    const quote = await tx.quote.findUnique({
      where: { id: data.quoteId },
      select: {
        status: true,
        acceptedServiceCase: {
          select: {
            id: true,
            appointments: {
              select: { id: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        items: {
          select: {
            serviceId: true,
            nameSnapshot: true,
            service: { select: { estimatedDurationMinutes: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!quote || quote.status !== "ACCEPTED" || !quote.acceptedServiceCase)
      throw new Error("QUOTE_NOT_SCHEDULABLE");
    const existingAppointment = quote.acceptedServiceCase.appointments[0];
    if (existingAppointment)
      return { id: existingAppointment.id, replayed: true };
    const employees = await tx.user.findMany({
      where: { id: { in: data.employeeIds }, active: true },
      select: { id: true },
    });
    if (employees.length !== new Set(data.employeeIds).size)
      throw new Error("EMPLOYEE_NOT_AVAILABLE");
    await assertNoBlock(tx, startAt, endAt);
    const appointment = await tx.appointment.create({
      data: {
        serviceCaseId: quote.acceptedServiceCase.id,
        startAt,
        endAt,
        status: "CONFIRMED",
        internalNotes: data.internalNotes,
        visibleToClient: data.visibleToClient,
        createdById: actor.id,
        updatedById: actor.id,
        services: {
          create: quote.items.map((item, index) => ({
            serviceId: item.serviceId,
            nameSnapshot: item.nameSnapshot,
            durationMinutesSnapshot: item.service?.estimatedDurationMinutes,
            sortOrder: index,
          })),
        },
        employees: {
          create: employees.map((employee) => ({ userId: employee.id })),
        },
      },
      select: { id: true },
    });
    await tx.idempotencyKey.create({
      data: {
        operation: "QUOTE_TO_APPOINTMENT",
        key: data.idempotencyKey,
        actorId: actor.id,
        requestHash: hash,
        resultReference: appointment.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    });
    return { id: appointment.id, replayed: false };
  });
}

export async function updateAppointment(
  id: string,
  input: AppointmentEditInput,
  actor: Actor,
) {
  const data = appointmentEditSchema.parse(input);
  const startAt = businessLocalDateTimeToUtc(data.startLocal);
  const endAt = businessLocalDateTimeToUtc(data.endLocal);
  assertRange(startAt, endAt);
  return prisma.$transaction(async (tx) => {
    const current = await tx.appointment.findUnique({
      where: { id },
      include: {
        serviceCase: {
          select: {
            id: true,
            clientId: true,
            vehicleId: true,
            origin: true,
            acceptedQuoteId: true,
            agreedAmountUsd: true,
            agreedSourceCurrency: true,
            agreedSourceAmount: true,
            agreedExchangeRateArsPerUsd: true,
            directCostUsd: true,
            directCostSourceCurrency: true,
            directCostSourceAmount: true,
            directCostExchangeRateArsPerUsd: true,
            _count: {
              select: {
                appointments: true,
                jobs: true,
                financialEntries: true,
                amountRevisions: true,
              },
            },
          },
        },
      },
    });
    if (!current) throw new Error("APPOINTMENT_NOT_FOUND");
    if (current.status !== AppointmentStatus.CONFIRMED)
      throw new Error("APPOINTMENT_NOT_EDITABLE");
    const { services, employees } = await validatedRelations(tx, {
      clientId: data.clientId,
      vehicleId: data.vehicleId,
      serviceIds: data.serviceIds,
      employeeIds: data.employeeIds,
    });
    const identityChanged =
      data.clientId !== current.serviceCase.clientId ||
      data.vehicleId !== current.serviceCase.vehicleId;
    if (identityChanged) {
      const eligibility = appointmentReassignmentEligibility({
        origin: current.serviceCase.origin,
        acceptedQuoteId: current.serviceCase.acceptedQuoteId,
        agreedAmountUsd:
          current.serviceCase.agreedAmountUsd?.toString() ?? null,
        agreedSourceCurrency: current.serviceCase.agreedSourceCurrency,
        agreedSourceAmount:
          current.serviceCase.agreedSourceAmount?.toString() ?? null,
        agreedExchangeRateArsPerUsd:
          current.serviceCase.agreedExchangeRateArsPerUsd?.toString() ?? null,
        directCostUsd: current.serviceCase.directCostUsd?.toString() ?? null,
        directCostSourceCurrency: current.serviceCase.directCostSourceCurrency,
        directCostSourceAmount:
          current.serviceCase.directCostSourceAmount?.toString() ?? null,
        directCostExchangeRateArsPerUsd:
          current.serviceCase.directCostExchangeRateArsPerUsd?.toString() ??
          null,
        appointmentCount: current.serviceCase._count.appointments,
        jobCount: current.serviceCase._count.jobs,
        financialEntryCount: current.serviceCase._count.financialEntries,
        amountRevisionCount: current.serviceCase._count.amountRevisions,
      });
      if (!eligibility.allowed) throw new Error("APPOINTMENT_IDENTITY_LOCKED");
      await tx.serviceCase.update({
        where: { id: current.serviceCase.id },
        data: { clientId: data.clientId, vehicleId: data.vehicleId },
      });
    }
    await assertNoBlock(tx, startAt, endAt, id);
    await tx.appointmentService.deleteMany({ where: { appointmentId: id } });
    await tx.appointmentEmployee.deleteMany({ where: { appointmentId: id } });
    return tx.appointment.update({
      where: { id },
      data: {
        startAt,
        endAt,
        internalNotes: data.internalNotes,
        visibleToClient: data.visibleToClient,
        color: data.color,
        updatedById: actor.id,
        services: {
          create: services.map((service, index) => ({
            serviceId: service.id,
            nameSnapshot: service.name,
            durationMinutesSnapshot: service.estimatedDurationMinutes,
            sortOrder: index,
          })),
        },
        employees: {
          create: employees.map((employee) => ({ userId: employee.id })),
        },
      },
      select: { id: true },
    });
  });
}

export async function cancelAppointment(id: string, actor: Actor) {
  const result = await prisma.appointment.updateMany({
    where: { id, status: AppointmentStatus.CONFIRMED },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      updatedById: actor.id,
    },
  });
  if (result.count !== 1) throw new Error("APPOINTMENT_NOT_CANCELLABLE");
}

export async function createCalendarBlock(
  input: CalendarBlockInput,
  actor: Actor,
) {
  const data = calendarBlockInputSchema.parse(input);
  const startAt = businessLocalDateTimeToUtc(data.startLocal);
  const endAt = businessLocalDateTimeToUtc(data.endLocal);
  assertRange(startAt, endAt);
  return prisma.calendarBlock.create({
    data: {
      reason: data.reason,
      startAt,
      endAt,
      allDay: data.allDay,
      notes: data.notes,
      createdById: actor.id,
      updatedById: actor.id,
    },
    select: { id: true },
  });
}

export async function cancelCalendarBlock(id: string, actor: Actor) {
  const result = await prisma.calendarBlock.updateMany({
    where: { id, active: true },
    data: { active: false, cancelledAt: new Date(), updatedById: actor.id },
  });
  if (result.count !== 1) throw new Error("BLOCK_NOT_ACTIVE");
}

export async function getCalendarRange(start: Date, end: Date) {
  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: { startAt: { lt: end }, endAt: { gt: start } },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        color: true,
        serviceCase: {
          select: {
            client: { select: { displayName: true } },
            vehicle: {
              select: { brand: true, model: true, year: true, color: true },
            },
          },
        },
        services: {
          select: { nameSnapshot: true },
          orderBy: { sortOrder: "asc" },
        },
        employees: { select: { user: { select: { name: true } } } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.calendarBlock.findMany({
      where: { active: true, startAt: { lt: end }, endAt: { gt: start } },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        allDay: true,
        reason: true,
      },
      orderBy: { startAt: "asc" },
    }),
  ]);
  return { appointments, blocks };
}

export async function listSchedulingOptions(
  selectedClientId?: string,
  selectedVehicleId?: string,
) {
  const [clients, vehicles, services, employees] = await Promise.all([
    searchClientPickerOptions({ selectedId: selectedClientId }),
    selectedClientId
      ? searchVehiclePickerOptions({
          clientId: selectedClientId,
          selectedId: selectedVehicleId,
        })
      : [],
    prisma.service.findMany({
      where: { active: true, category: { active: true } },
      select: {
        id: true,
        name: true,
        estimatedDurationMinutes: true,
        category: { select: { name: true } },
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { clients, vehicles, services, employees };
}

export async function getAppointmentDetail(id: string) {
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) return null;

  const serviceCase = await prisma.serviceCase.findUnique({
    where: { id: appointment.serviceCaseId },
    select: {
      id: true,
      clientId: true,
      vehicleId: true,
      origin: true,
      acceptedQuoteId: true,
      agreedAmountUsd: true,
      agreedSourceCurrency: true,
      agreedSourceAmount: true,
      agreedExchangeRateArsPerUsd: true,
      directCostUsd: true,
      directCostSourceCurrency: true,
      directCostSourceAmount: true,
      directCostExchangeRateArsPerUsd: true,
      _count: {
        select: {
          appointments: true,
          jobs: true,
          financialEntries: true,
          amountRevisions: true,
        },
      },
    },
  });
  if (!serviceCase) return null;
  const client = await prisma.client.findUnique({
    where: { id: serviceCase.clientId },
  });
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: serviceCase.vehicleId },
  });
  if (!client || !vehicle) return null;
  const job = await prisma.job.findUnique({
    where: { originAppointmentId: appointment.id },
    select: { id: true, voidedAt: true },
  });
  const services = await prisma.appointmentService.findMany({
    where: { appointmentId: appointment.id },
    orderBy: { sortOrder: "asc" },
  });
  const assignments = await prisma.appointmentEmployee.findMany({
    where: { appointmentId: appointment.id },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: assignments.map((assignment) => assignment.userId) } },
    select: { id: true, name: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const identityReassignment = appointmentReassignmentEligibility({
    origin: serviceCase.origin,
    acceptedQuoteId: serviceCase.acceptedQuoteId,
    agreedAmountUsd: serviceCase.agreedAmountUsd?.toString() ?? null,
    agreedSourceCurrency: serviceCase.agreedSourceCurrency,
    agreedSourceAmount: serviceCase.agreedSourceAmount?.toString() ?? null,
    agreedExchangeRateArsPerUsd:
      serviceCase.agreedExchangeRateArsPerUsd?.toString() ?? null,
    directCostUsd: serviceCase.directCostUsd?.toString() ?? null,
    directCostSourceCurrency: serviceCase.directCostSourceCurrency,
    directCostSourceAmount:
      serviceCase.directCostSourceAmount?.toString() ?? null,
    directCostExchangeRateArsPerUsd:
      serviceCase.directCostExchangeRateArsPerUsd?.toString() ?? null,
    appointmentCount: serviceCase._count.appointments,
    jobCount: serviceCase._count.jobs,
    financialEntryCount: serviceCase._count.financialEntries,
    amountRevisionCount: serviceCase._count.amountRevisions,
  });

  return {
    ...appointment,
    serviceCase: { ...serviceCase, client, vehicle },
    identityReassignment,
    job,
    services,
    employees: assignments.flatMap((assignment) => {
      const user = usersById.get(assignment.userId);
      return user ? [{ ...assignment, user }] : [];
    }),
  };
}
