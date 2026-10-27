"use server";

import { revalidatePath } from "next/cache";

import {
  createClientWithVehicles,
  createVehicle,
  findPossibleDuplicates,
  searchClientPickerOptions,
  searchVehiclePickerOptions,
  type ClientPickerOption,
  type VehiclePickerOption,
} from "@/modules/clients/application/client-service";
import {
  clientInputSchema,
  vehicleInputSchema,
} from "@/modules/clients/domain/client-schema";
import { requireUser } from "@/modules/identity/application/session";

export type PickerSearchResult<T> =
  { status: "success"; items: T[] } | { status: "error"; message: string };

export interface QuickClientInput {
  client: {
    displayName: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    instagram?: string;
    notes?: string;
  };
  vehicles: Array<{
    brand: string;
    model: string;
    version?: string;
    year?: string;
    color?: string;
    vehicleClass?: string;
    notes?: string;
  }>;
  allowNameSuggestion?: boolean;
}

export type QuickClientResult =
  | {
      status: "success";
      client: ClientPickerOption;
      vehicles: VehiclePickerOption[];
    }
  | {
      status: "duplicate";
      blocking: boolean;
      matches: Awaited<ReturnType<typeof findPossibleDuplicates>>;
      message: string;
    }
  | {
      status: "error";
      message: string;
      fields?: Record<string, string>;
    };

export type QuickVehicleResult =
  | { status: "success"; vehicle: VehiclePickerOption }
  | {
      status: "error";
      message: string;
      fields?: Record<string, string>;
    };

function issuesToFields(
  issues: readonly { path: PropertyKey[]; message: string }[],
) {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.map(String).join("."), issue.message]),
  );
}

export async function searchClientsAction(input: {
  query?: string;
  selectedId?: string;
}): Promise<PickerSearchResult<ClientPickerOption>> {
  await requireUser();
  try {
    return {
      status: "success",
      items: await searchClientPickerOptions(input),
    };
  } catch {
    return {
      status: "error",
      message: "No pudimos buscar clientes. Intentá nuevamente.",
    };
  }
}

export async function searchVehiclesAction(input: {
  clientId: string;
  query?: string;
  selectedId?: string;
}): Promise<PickerSearchResult<VehiclePickerOption>> {
  await requireUser();
  try {
    return {
      status: "success",
      items: await searchVehiclePickerOptions(input),
    };
  } catch {
    return {
      status: "error",
      message: "No pudimos buscar vehículos. Intentá nuevamente.",
    };
  }
}

export async function quickCreateClientAction(
  input: QuickClientInput,
): Promise<QuickClientResult> {
  const session = await requireUser();
  const parsedClient = clientInputSchema.safeParse(input.client);
  const parsedVehicles = input.vehicles.map((vehicle) =>
    vehicleInputSchema.safeParse(vehicle),
  );
  const fields: Record<string, string> = {};
  if (!parsedClient.success)
    Object.assign(
      fields,
      Object.fromEntries(
        Object.entries(issuesToFields(parsedClient.error.issues)).map(
          ([key, value]) => [`client.${key}`, value],
        ),
      ),
    );
  parsedVehicles.forEach((vehicle, index) => {
    if (!vehicle.success)
      Object.assign(
        fields,
        Object.fromEntries(
          Object.entries(issuesToFields(vehicle.error.issues)).map(
            ([key, value]) => [`vehicles.${index}.${key}`, value],
          ),
        ),
      );
  });
  if (!input.vehicles.length)
    fields["vehicles"] = "Agregá al menos un vehículo.";
  if (input.vehicles.length > 10)
    fields["vehicles"] = "Podés agregar hasta 10 vehículos en el alta rápida.";
  if (
    !parsedClient.success ||
    parsedVehicles.some((item) => !item.success) ||
    Object.keys(fields).length
  )
    return {
      status: "error",
      message: "Revisá los campos marcados.",
      fields,
    };

  const duplicates = await findPossibleDuplicates(parsedClient.data);
  const strong = duplicates.filter((item) => item.strength === "strong");
  if (strong.length)
    return {
      status: "duplicate",
      blocking: true,
      matches: strong,
      message: "Ya existe un cliente con estos datos.",
    };
  const suggestions = duplicates.filter(
    (item) => item.strength === "suggestion",
  );
  if (suggestions.length && !input.allowNameSuggestion)
    return {
      status: "duplicate",
      blocking: false,
      matches: suggestions,
      message: "Encontramos clientes parecidos.",
    };

  try {
    const result = await createClientWithVehicles(
      {
        client: parsedClient.data,
        vehicles: parsedVehicles.flatMap((item) =>
          item.success ? [item.data] : [],
        ),
      },
      session.user,
    );
    revalidatePath("/app/clients");
    return { status: "success", ...result };
  } catch (error) {
    if (error instanceof Error && error.message === "STRONG_CLIENT_DUPLICATE") {
      return {
        status: "duplicate",
        blocking: true,
        matches: await findPossibleDuplicates(parsedClient.data),
        message: "Ya existe un cliente con estos datos.",
      };
    }
    return {
      status: "error",
      message: "No pudimos crear el cliente. Intentá nuevamente.",
    };
  }
}

export async function quickCreateVehicleAction(input: {
  clientId: string;
  vehicle: QuickClientInput["vehicles"][number];
}): Promise<QuickVehicleResult> {
  const session = await requireUser();
  const parsed = vehicleInputSchema.safeParse(input.vehicle);
  if (!parsed.success)
    return {
      status: "error",
      message: "Revisá los campos marcados.",
      fields: issuesToFields(parsed.error.issues),
    };
  try {
    const vehicle = await createVehicle(
      input.clientId,
      parsed.data,
      session.user,
    );
    revalidatePath(`/app/clients/${input.clientId}`);
    return { status: "success", vehicle };
  } catch {
    return {
      status: "error",
      message:
        "No pudimos crear el vehículo. Verificá que el cliente siga activo.",
    };
  }
}
