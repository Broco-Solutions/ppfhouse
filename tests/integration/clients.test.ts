import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import {
  archiveClient,
  createClient,
  createClientWithVehicles,
  createVehicle,
  findPossibleDuplicates,
  listClients,
  searchClientPickerOptions,
  searchVehiclePickerOptions,
  updateVehicle,
} from "@/modules/clients/application/client-service";

const actorEmail = "build1-clients@ferraro.test";
let actorId = "";
const createdClientIds: string[] = [];

describe("clients and vehicles integration", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: actorEmail } });
    const actor = await prisma.user.create({
      data: {
        name: "Operador Clientes",
        email: actorEmail,
        role: UserRole.STAFF,
        active: true,
      },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    await prisma.vehicle.deleteMany({
      where: { clientId: { in: createdClientIds } },
    });
    await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
    await prisma.user.deleteMany({ where: { email: actorEmail } });
    await prisma.$disconnect();
  });

  it("creates a client, warns about a normalized duplicate and finds the vehicle", async () => {
    const first = await createClient(
      { displayName: "Juan Pérez", phone: "+54 9 341 555-0182" },
      { id: actorId },
    );
    createdClientIds.push(first.id);
    await createVehicle(
      first.id,
      { brand: "BMW", model: "M3", year: 2024, color: "Negro" },
      { id: actorId },
    );

    const duplicates = await findPossibleDuplicates({ phone: "5493415550182" });
    expect(duplicates.map((item) => item.id)).toContain(first.id);
    const search = await listClients({ query: "M3" });
    expect(search.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, displayName: "Juan Pérez" }),
      ]),
    );
  });

  it("enforces vehicle ownership and archives without deleting", async () => {
    const owner = await createClient(
      { displayName: "Martina López" },
      { id: actorId },
    );
    const other = await createClient(
      { displayName: "Lucía Benítez" },
      { id: actorId },
    );
    createdClientIds.push(owner.id, other.id);
    const vehicle = await createVehicle(
      owner.id,
      { brand: "Porsche", model: "Macan", color: "Gris" },
      { id: actorId },
    );

    await expect(
      updateVehicle(
        other.id,
        vehicle.id,
        { brand: "Porsche", model: "Macan" },
        { id: actorId },
      ),
    ).rejects.toThrow("VEHICLE_NOT_FOUND");
    await archiveClient(owner.id, { id: actorId });
    await expect(
      prisma.client.findUnique({ where: { id: owner.id } }),
    ).resolves.toMatchObject({
      active: false,
    });
    await expect(
      prisma.vehicle.findUnique({ where: { id: vehicle.id } }),
    ).resolves.not.toBeNull();
  });

  it("searches active clients by name, phone and email including clients without vehicles", async () => {
    const client = await createClient(
      {
        displayName: "Búsqueda Integral Ferraro",
        phone: "+54 341 600 7788",
        email: "flujo-picker@ferraro.test",
      },
      { id: actorId },
    );
    createdClientIds.push(client.id);

    for (const query of [
      "Búsqueda Integral",
      "3416007788",
      "flujo-picker@ferraro.test",
    ]) {
      const result = await searchClientPickerOptions({ query });
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: client.id, vehicleCount: 0 }),
        ]),
      );
    }
  });

  it("creates a client with multiple vehicles atomically and scopes vehicle search", async () => {
    const created = await createClientWithVehicles(
      {
        client: {
          displayName: "Alta Atómica Ferraro",
          phone: "+54 341 600 7799",
        },
        vehicles: [
          { brand: "Audi", model: "RS3", year: 2025 },
          { brand: "Porsche", model: "Cayenne", version: "S" },
        ],
      },
      { id: actorId },
    );
    createdClientIds.push(created.client.id);
    expect(created.vehicles).toHaveLength(2);

    const other = await createClient(
      { displayName: "Dueño Vehículo Ajeno" },
      { id: actorId },
    );
    createdClientIds.push(other.id);
    await createVehicle(
      other.id,
      { brand: "Audi", model: "RS3 ajeno" },
      { id: actorId },
    );
    const vehicles = await searchVehiclePickerOptions({
      clientId: created.client.id,
      query: "Audi",
    });
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]).toMatchObject({
      clientId: created.client.id,
      model: "RS3",
    });
  });

  it("blocks strong quick-create duplicates but keeps name-only matches as suggestions", async () => {
    const original = await createClient(
      {
        displayName: "María López",
        phone: "+54 341 600 7711",
        email: "maria.duplicate@ferraro.test",
      },
      { id: actorId },
    );
    createdClientIds.push(original.id);
    await expect(
      createClientWithVehicles(
        {
          client: {
            displayName: "Otra María",
            phone: "543416007711",
          },
          vehicles: [{ brand: "BMW", model: "X1" }],
        },
        { id: actorId },
      ),
    ).rejects.toThrow("STRONG_CLIENT_DUPLICATE");

    const byEmail = await findPossibleDuplicates({
      email: "MARIA.DUPLICATE@FERRARO.TEST",
    });
    expect(byEmail[0]).toMatchObject({ id: original.id, strength: "strong" });
    const byName = await findPossibleDuplicates({ displayName: "MARIA LOPEZ" });
    expect(byName[0]).toMatchObject({
      id: original.id,
      strength: "suggestion",
    });
  });
});
