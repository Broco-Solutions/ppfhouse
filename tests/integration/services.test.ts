import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import {
  createCategory,
  createService,
  createVariant,
  listOperationalServices,
  setServiceActive,
} from "@/modules/services/application/service-catalog";

const email = "build2-services@ferraro.test";
let actorId = "";
let categoryId = "";
let serviceId = "";

describe("service catalog integration", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    const actor = await prisma.user.create({
      data: { name: "Admin Catálogo", email, role: UserRole.ADMIN },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    if (serviceId)
      await prisma.serviceVariant.deleteMany({ where: { serviceId } });
    if (serviceId)
      await prisma.service.deleteMany({ where: { id: serviceId } });
    if (categoryId)
      await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("models base, class and exact model pricing without a rule engine", async () => {
    categoryId = (
      await createCategory(
        { name: `Protección ${crypto.randomUUID()}`, sortOrder: 1 },
        { id: actorId },
      )
    ).id;
    serviceId = (
      await createService(
        {
          categoryId,
          name: "Cerámico",
          basePriceUsd: "450.00",
          estimatedDurationMinutes: 480,
          sortOrder: 1,
        },
        { id: actorId },
      )
    ).id;
    await createVariant(
      serviceId,
      {
        type: "VEHICLE_CLASS",
        label: "SUV",
        vehicleClass: "SUV",
        priceUsd: "550.00",
        priority: 0,
      },
      { id: actorId },
    );
    await createVariant(
      serviceId,
      {
        type: "MODEL_EXCEPTION",
        label: "Ford Raptor",
        matchBrand: "Ford",
        matchModel: "Raptor",
        priceUsd: "720.00",
        priority: 10,
      },
      { id: actorId },
    );
    await expect(
      prisma.serviceVariant.count({ where: { serviceId } }),
    ).resolves.toBe(2);
  });

  it("returns an operational projection without prices and preserves inactive rows", async () => {
    const operational = await listOperationalServices();
    const item = operational.find((service) => service.id === serviceId);
    expect(item).toBeDefined();
    expect(Object.keys(item ?? {})).not.toContain("basePriceUsd");
    await setServiceActive(serviceId, false, { id: actorId });
    await expect(
      prisma.service.findUnique({ where: { id: serviceId } }),
    ).resolves.toMatchObject({ active: false });
    await expect(listOperationalServices()).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: serviceId })]),
    );
  });
});
