import { normalizePhone } from "@/modules/clients/domain/client-schema";

export type DuplicateStrength = "strong" | "suggestion";
export type DuplicateReason = "phone" | "email" | "name";

export interface DuplicateCandidate {
  displayName: string;
  email: string | null;
  normalizedPhone: string | null;
}

export interface DuplicateInput {
  displayName?: string;
  email?: string;
  phone?: string;
}

export interface DuplicateClassification {
  reasons: DuplicateReason[];
  strength: DuplicateStrength;
}

export function normalizeComparableName(value?: string) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function classifyDuplicate(
  candidate: DuplicateCandidate,
  input: DuplicateInput,
): DuplicateClassification | null {
  const reasons: DuplicateReason[] = [];
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim().toLocaleLowerCase("es-AR") || null;

  if (phone && candidate.normalizedPhone === phone) reasons.push("phone");
  if (email && candidate.email?.trim().toLocaleLowerCase("es-AR") === email)
    reasons.push("email");

  if (reasons.length) return { strength: "strong", reasons };

  const name = normalizeComparableName(input.displayName);
  if (name && normalizeComparableName(candidate.displayName) === name)
    return { strength: "suggestion", reasons: ["name"] };

  return null;
}

export function vehicleLabel(vehicle: {
  brand: string;
  model: string;
  version?: string | null;
  year?: number | null;
}) {
  return [vehicle.brand, vehicle.model, vehicle.version, vehicle.year]
    .filter(Boolean)
    .join(" · ");
}
