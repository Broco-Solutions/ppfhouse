import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";

export async function globalSearch(query: string, role: UserRole) {
  const term = query.trim();
  if (term.length < 2)
    return { clients: [], vehicles: [], jobs: [], services: [], quotes: [] };
  const contains = { contains: term, mode: "insensitive" as const };
  const [clients, vehicles, jobs, services, quotes] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          { displayName: contains },
          { phone: contains },
          { email: contains },
        ],
      },
      select: { id: true, displayName: true, phone: true, active: true },
      orderBy: { displayName: "asc" },
      take: 6,
    }),
    prisma.vehicle.findMany({
      where: { OR: [{ brand: contains }, { model: contains }] },
      select: {
        id: true,
        clientId: true,
        brand: true,
        model: true,
        year: true,
        client: { select: { displayName: true } },
      },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      take: 6,
    }),
    prisma.job.findMany({
      where: {
        voidedAt: null,
        OR: [
          { serviceCase: { client: { displayName: contains } } },
          { serviceCase: { vehicle: { brand: contains } } },
          { serviceCase: { vehicle: { model: contains } } },
          { services: { some: { nameSnapshot: contains } } },
        ],
      },
      select: {
        id: true,
        performedAt: true,
        serviceCase: {
          select: {
            client: { select: { displayName: true } },
            vehicle: { select: { brand: true, model: true } },
          },
        },
      },
      orderBy: { performedAt: "desc" },
      take: 6,
    }),
    prisma.service.findMany({
      where: { name: contains },
      select: {
        id: true,
        name: true,
        active: true,
        estimatedDurationMinutes: true,
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 6,
    }),
    role === "ADMIN"
      ? prisma.quote.findMany({
          where: {
            OR: [
              { number: contains },
              { client: { displayName: contains } },
              { vehicle: { brand: contains } },
              { vehicle: { model: contains } },
            ],
          },
          select: {
            id: true,
            number: true,
            status: true,
            client: { select: { displayName: true } },
            vehicle: { select: { brand: true, model: true } },
          },
          orderBy: { issuedOn: "desc" },
          take: 6,
        })
      : Promise.resolve([]),
  ]);
  return { clients, vehicles, jobs, services, quotes };
}
