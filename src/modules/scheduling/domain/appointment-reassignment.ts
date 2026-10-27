export interface AppointmentReassignmentSnapshot {
  acceptedQuoteId: string | null;
  agreedAmountUsd: string | null;
  agreedExchangeRateArsPerUsd: string | null;
  agreedSourceAmount: string | null;
  agreedSourceCurrency: string | null;
  amountRevisionCount: number;
  appointmentCount: number;
  directCostExchangeRateArsPerUsd: string | null;
  directCostSourceAmount: string | null;
  directCostSourceCurrency: string | null;
  directCostUsd: string | null;
  financialEntryCount: number;
  jobCount: number;
  origin: "DIRECT_APPOINTMENT" | "DIRECT_JOB" | "ACCEPTED_QUOTE";
}

export type AppointmentReassignmentEligibility =
  { allowed: true; reason: null } | { allowed: false; reason: string };

export function appointmentReassignmentEligibility(
  snapshot: AppointmentReassignmentSnapshot,
): AppointmentReassignmentEligibility {
  const hasCommercialHistory =
    snapshot.origin !== "DIRECT_APPOINTMENT" ||
    Boolean(snapshot.acceptedQuoteId) ||
    snapshot.jobCount > 0 ||
    snapshot.financialEntryCount > 0 ||
    snapshot.amountRevisionCount > 0 ||
    snapshot.agreedAmountUsd !== null ||
    snapshot.agreedSourceCurrency !== null ||
    snapshot.agreedSourceAmount !== null ||
    snapshot.agreedExchangeRateArsPerUsd !== null ||
    snapshot.directCostUsd !== null ||
    snapshot.directCostSourceCurrency !== null ||
    snapshot.directCostSourceAmount !== null ||
    snapshot.directCostExchangeRateArsPerUsd !== null;

  if (hasCommercialHistory)
    return {
      allowed: false,
      reason:
        "Este turno ya está vinculado a información comercial o histórica. Para preservar el historial no se puede cambiar el cliente o vehículo desde la agenda.",
    };
  if (snapshot.appointmentCount !== 1)
    return {
      allowed: false,
      reason:
        "Este caso tiene otros turnos relacionados. Para preservar su historial no se puede cambiar el cliente o vehículo desde esta pantalla.",
    };
  return { allowed: true, reason: null };
}
