import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/infrastructure/db/client";
import {
  clientInputSchema,
  normalizePhone,
  vehicleInputSchema,
  type ClientInput,
  type VehicleInput,
} from "@/modules/clients/domain/client-schema";
import {
  classifyDuplicate,
  normalizeComparableName,
} from "@/modules/clients/domain/client-vehicle-flow";

interface Actor {
  id: string;
}

export async function createClient(input: ClientInput, actor: Actor) {
  const data = clientInputSchema.parse(input);
  return prisma.client.create({
    data: {
      ...data,
      normalizedPhone: normalizePhone(data.phone),
      email: data.email?.toLowerCase(),
      createdById: actor.id,
      updatedById: actor.id,
    },
    select: { id: true },
  });
}

export async function updateClient(
  id: string,
  input: ClientInput,
  actor: Actor,
) {
  const data = clientInputSchema.parse(input);
  return prisma.client.update({
    where: { id },
    data: {
      ...data,
      normalizedPhone: normalizePhone(data.phone),
      email: data.email?.toLowerCase(),
      updatedById: actor.id,
    },
    select: { id: true },
  });
}

export async function archiveClient(id: string, actor: Actor) {
  return prisma.client.update({
    where: { id },
    data: { active: false, archivedAt: new Date(), updatedById: actor.id },
    select: { id: true },
  });
}

export async function restoreClient(id: string, actor: Actor) {
  return prisma.client.update({
    where: { id },
    data: { active: true, archivedAt: null, updatedById: actor.id },
    select: { id: true },
  });
}

export async function createVehicle(
  clientId: string,
  input: VehicleInput,
  actor: Actor,
) {
  const data = vehicleInputSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { active: true },
    });
    if (!client?.active) throw new Error("CLIENT_NOT_FOUND");
    return tx.vehicle.create({
      data: { ...data, clientId, createdById: actor.id, updatedById: actor.id },
      select: {
        id: true,
        clientId: true,
        brand: true,
        model: true,
        version: true,
        year: true,
        color: true,
        vehicleClass: true,
      },
    });
  });
}

export async function updateVehicle(
  clientId: string,
  vehicleId: string,
  input: VehicleInput,
  actor: Actor,
) {
  const data = vehicleInputSchema.parse(input);
  const result = await prisma.vehicle.updateMany({
    where: { id: vehicleId, clientId },
    data: { ...data, updatedById: actor.id },
  });
  if (result.count !== 1) throw new Error("VEHICLE_NOT_FOUND");
  return { id: vehicleId, clientId };
}

export async function setVehicleArchived(
  clientId: string,
  vehicleId: string,
  archived: boolean,
  actor: Actor,
) {
  const result = await prisma.vehicle.updateMany({
    where: { id: vehicleId, clientId },
    data: {
      active: !archived,
      archivedAt: archived ? new Date() : null,
      updatedById: actor.id,
    },
  });
  if (result.count !== 1) throw new Error("VEHICLE_NOT_FOUND");
}

export async function findPossibleDuplicates(input: {
  displayName?: string;
  phone?: string;
  email?: string;
  excludeId?: string;
}) {
  const normalizedPhone = normalizePhone(input.phone);
  const email = input.email?.trim().toLowerCase();
  const comparableName = normalizeComparableName(input.displayName);
  const nameInitial = input.displayName?.trim().charAt(0);
  if (!normalizedPhone && !email && !comparableName) return [];

  const select = {
    id: true,
    displayName: true,
    phone: true,
    normalizedPhone: true,
    email: true,
    active: true,
  } satisfies Prisma.ClientSelect;
  const [strongCandidates, nameCandidates] = await Promise.all([
    normalizedPhone || email
      ? prisma.client.findMany({
          where: {
            id: input.excludeId ? { not: input.excludeId } : undefined,
            OR: [
              ...(normalizedPhone ? [{ normalizedPhone }] : []),
              ...(email
                ? [
                    {
                      email: {
                        equals: email,
                        mode: "insensitive" as const,
                      },
                    },
                  ]
                : []),
            ],
          },
          select,
          take: 10,
        })
      : [],
    nameInitial
      ? prisma.client.findMany({
          where: {
            id: input.excludeId ? { not: input.excludeId } : undefined,
            displayName: {
              startsWith: nameInitial,
              mode: "insensitive",
            },
          },
          select,
          orderBy: { updatedAt: "desc" },
          take: 50,
        })
      : [],
  ]);
  const candidates = [
    ...strongCandidates,
    ...nameCandidates.filter(
      (candidate) =>
        !strongCandidates.some((strong) => strong.id === candidate.id),
    ),
  ];

  return candidates.flatMap((candidate) => {
    const classification = classifyDuplicate(candidate, input);
    return classification ? [{ ...candidate, ...classification }] : [];
  });
}

export interface ClientPickerOption {
  id: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  vehicleCount: number;
}

export interface VehiclePickerOption {
  id: string;
  clientId: string;
  brand: string;
  model: string;
  version: string | null;
  year: number | null;
  color: string | null;
  vehicleClass: "SEDAN" | "SUV" | "PICKUP" | "OTHER" | null;
}

export async function searchClientPickerOptions(options: {
  query?: string;
  selectedId?: string;
  limit?: number;
}): Promise<ClientPickerOption[]> {
  const query = options.query?.trim();
  const limit = Math.min(20, Math.max(1, options.limit ?? 20));
  const normalizedQuery = normalizePhone(query);
  const where: Prisma.ClientWhereInput = {
    active: true,
    OR: query
      ? [
          { displayName: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          ...(normalizedQuery
            ? [{ normalizedPhone: { contains: normalizedQuery } }]
            : []),
          { email: { contains: query, mode: "insensitive" } },
          {
            vehicles: {
              some: {
                active: true,
                OR: [
                  { brand: { contains: query, mode: "insensitive" } },
                  { model: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
        ]
      : undefined,
  };
  const select = {
    id: true,
    displayName: true,
    phone: true,
    email: true,
    _count: { select: { vehicles: { where: { active: true } } } },
  } satisfies Prisma.ClientSelect;

  const [items, selected] = await Promise.all([
    prisma.client.findMany({
      where,
      select,
      orderBy: query
        ? [{ displayName: "asc" }]
        : [{ createdAt: "desc" }, { displayName: "asc" }],
      take: limit,
    }),
    options.selectedId
      ? prisma.client.findFirst({
          where: { id: options.selectedId, active: true },
          select,
        })
      : null,
  ]);
  const unique = selected
    ? [selected, ...items.filter((item) => item.id !== selected.id)]
    : items;
  return unique.slice(0, limit).map((client) => ({
    id: client.id,
    displayName: client.displayName,
    phone: client.phone,
    email: client.email,
    vehicleCount: client._count.vehicles,
  }));
}

export async function searchVehiclePickerOptions(options: {
  clientId: string;
  query?: string;
  selectedId?: string;
  limit?: number;
}): Promise<VehiclePickerOption[]> {
  const query = options.query?.trim();
  const terms = query?.split(/\s+/).filter(Boolean) ?? [];
  const limit = Math.min(20, Math.max(1, options.limit ?? 20));
  const client = await prisma.client.findFirst({
    where: { id: options.clientId, active: true },
    select: { id: true },
  });
  if (!client) return [];
  const where: Prisma.VehicleWhereInput = {
    clientId: options.clientId,
    active: true,
    AND: terms.length
      ? terms.map((term) => {
          const year = /^\d{4}$/.test(term) ? Number(term) : undefined;
          return {
            OR: [
              { brand: { contains: term, mode: "insensitive" as const } },
              { model: { contains: term, mode: "insensitive" as const } },
              { version: { contains: term, mode: "insensitive" as const } },
              ...(year ? [{ year }] : []),
            ],
          };
        })
      : undefined,
  };
  const select = {
    id: true,
    clientId: true,
    brand: true,
    model: true,
    version: true,
    year: true,
    color: true,
    vehicleClass: true,
  } satisfies Prisma.VehicleSelect;
  const [items, selected] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      select,
      orderBy: [{ brand: "asc" }, { model: "asc" }, { year: "desc" }],
      take: limit,
    }),
    options.selectedId
      ? prisma.vehicle.findFirst({
          where: {
            id: options.selectedId,
            clientId: options.clientId,
            active: true,
          },
          select,
        })
      : null,
  ]);
  return selected
    ? [selected, ...items.filter((item) => item.id !== selected.id)].slice(
        0,
        limit,
      )
    : items;
}

export async function createClientWithVehicles(
  input: { client: ClientInput; vehicles: VehicleInput[] },
  actor: Actor,
) {
  const client = clientInputSchema.parse(input.client);
  const vehicles = input.vehicles.map((vehicle) =>
    vehicleInputSchema.parse(vehicle),
  );
  if (!vehicles.length || vehicles.length > 10)
    throw new Error("INVALID_VEHICLE_COUNT");

  return prisma.$transaction(
    async (tx) => {
      const normalizedPhone = normalizePhone(client.phone);
      const email = client.email?.toLowerCase();
      if (normalizedPhone || email) {
        const strongDuplicate = await tx.client.findFirst({
          where: {
            OR: [
              ...(normalizedPhone ? [{ normalizedPhone }] : []),
              ...(email
                ? [
                    {
                      email: {
                        equals: email,
                        mode: "insensitive" as const,
                      },
                    },
                  ]
                : []),
            ],
          },
          select: { id: true },
        });
        if (strongDuplicate) throw new Error("STRONG_CLIENT_DUPLICATE");
      }
      const created = await tx.client.create({
        data: {
          ...client,
          normalizedPhone,
          email,
          createdById: actor.id,
          updatedById: actor.id,
          vehicles: {
            create: vehicles.map((vehicle) => ({
              ...vehicle,
              createdById: actor.id,
              updatedById: actor.id,
            })),
          },
        },
        select: {
          id: true,
          displayName: true,
          phone: true,
          email: true,
          vehicles: {
            select: {
              id: true,
              clientId: true,
              brand: true,
              model: true,
              version: true,
              year: true,
              color: true,
              vehicleClass: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      return {
        client: {
          id: created.id,
          displayName: created.displayName,
          phone: created.phone,
          email: created.email,
          vehicleCount: created.vehicles.length,
        },
        vehicles: created.vehicles,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function listClients(options: {
  query?: string;
  status?: "active" | "archived" | "all";
  page?: number;
  pageSize?: number;
}) {
  const query = options.query?.trim();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const where: Prisma.ClientWhereInput = {
    active:
      options.status === "all"
        ? undefined
        : options.status === "archived"
          ? false
          : true,
    OR: query
      ? [
          { displayName: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          {
            normalizedPhone: { contains: normalizePhone(query) ?? "__none__" },
          },
          {
            vehicles: {
              some: {
                OR: [
                  { brand: { contains: query, mode: "insensitive" } },
                  { model: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
        ]
      : undefined,
  };

  const [items, total] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        phone: true,
        whatsapp: true,
        email: true,
        active: true,
        createdAt: true,
        vehicles: {
          where: { active: true },
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            color: true,
          },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        _count: { select: { vehicles: true } },
      },
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.client.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getClientDetail(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: [{ active: "desc" }, { createdAt: "desc" }] },
    },
  });
}

export async function getVehicleDetail(clientId: string, vehicleId: string) {
  return prisma.vehicle.findFirst({ where: { id: vehicleId, clientId } });
}
