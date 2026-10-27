import { prisma } from "@/infrastructure/db/client";
import {
  categoryInputSchema,
  serviceInputSchema,
  variantInputSchema,
  type CategoryInput,
  type ServiceInput,
  type VariantInput,
} from "@/modules/services/domain/service-schema";

interface Actor {
  id: string;
}

export async function createCategory(input: CategoryInput, actor: Actor) {
  const data = categoryInputSchema.parse(input);
  return prisma.serviceCategory.create({
    data: { ...data, createdById: actor.id, updatedById: actor.id },
    select: { id: true },
  });
}

export async function createService(input: ServiceInput, actor: Actor) {
  const data = serviceInputSchema.parse(input);
  return prisma.service.create({
    data: {
      ...data,
      basePriceUsd: data.basePriceUsd,
      createdById: actor.id,
      updatedById: actor.id,
    },
    select: { id: true },
  });
}

export async function updateService(
  id: string,
  input: ServiceInput,
  actor: Actor,
) {
  const data = serviceInputSchema.parse(input);
  return prisma.service.update({
    where: { id },
    data: {
      ...data,
      basePriceUsd: data.basePriceUsd ?? null,
      updatedById: actor.id,
    },
    select: { id: true },
  });
}

export async function setServiceActive(
  id: string,
  active: boolean,
  actor: Actor,
) {
  return prisma.service.update({
    where: { id },
    data: { active, updatedById: actor.id },
    select: { id: true },
  });
}

export async function createVariant(
  serviceId: string,
  input: VariantInput,
  actor: Actor,
) {
  const data = variantInputSchema.parse(input);
  return prisma.serviceVariant.create({
    data: {
      ...data,
      serviceId,
      vehicleClass: data.type === "VEHICLE_CLASS" ? data.vehicleClass : null,
      matchBrand: data.type === "MODEL_EXCEPTION" ? data.matchBrand : null,
      matchModel: data.type === "MODEL_EXCEPTION" ? data.matchModel : null,
      createdById: actor.id,
      updatedById: actor.id,
    },
    select: { id: true },
  });
}

export async function setVariantActive(
  id: string,
  serviceId: string,
  active: boolean,
  actor: Actor,
) {
  const result = await prisma.serviceVariant.updateMany({
    where: { id, serviceId },
    data: { active, updatedById: actor.id },
  });
  if (result.count !== 1) throw new Error("VARIANT_NOT_FOUND");
}

export async function listAdminCatalog() {
  return prisma.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      services: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          variants: { orderBy: [{ priority: "desc" }, { label: "asc" }] },
        },
      },
    },
  });
}

export async function getAdminService(id: string) {
  const [service, categories] = await Promise.all([
    prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: [{ priority: "desc" }, { label: "asc" }] },
      },
    }),
    prisma.serviceCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return { service, categories };
}

export async function listActiveCategories() {
  return prisma.serviceCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listOperationalServices() {
  return prisma.service.findMany({
    where: { active: true, category: { active: true } },
    select: {
      id: true,
      name: true,
      internalDescription: true,
      estimatedDurationMinutes: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: [
      { category: { sortOrder: "asc" } },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
  });
}
