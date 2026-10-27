export const recordKinds = [
  "client",
  "vehicle",
  "appointment",
  "calendarBlock",
  "serviceCategory",
  "service",
  "serviceVariant",
  "quote",
  "job",
  "serviceCase",
  "financialCategory",
  "financialEntry",
  "inventoryCategory",
  "inventoryItem",
  "inventoryMovement",
  "purchasePresentation",
  "supplier",
  "purchase",
  "consumption",
  "photo",
] as const;

export type RecordKind = (typeof recordKinds)[number];

export const recordLabels: Record<RecordKind, string> = {
  client: "cliente",
  vehicle: "vehículo",
  appointment: "turno",
  calendarBlock: "bloqueo de agenda",
  serviceCategory: "categoría de servicios",
  service: "servicio",
  serviceVariant: "variante de servicio",
  quote: "presupuesto",
  job: "trabajo",
  serviceCase: "caso comercial",
  financialCategory: "categoría financiera",
  financialEntry: "movimiento financiero",
  inventoryCategory: "categoría de inventario",
  inventoryItem: "artículo de inventario",
  inventoryMovement: "movimiento de inventario",
  purchasePresentation: "presentación de compra",
  supplier: "proveedor",
  purchase: "compra",
  consumption: "consumo de material",
  photo: "foto",
};

export const deletionConsequences: Partial<Record<RecordKind, string>> = {
  client: "También se eliminan sus enlaces de acceso al portal.",
  service: "También se eliminan las variantes de este servicio.",
  quote: "También se eliminan sus ítems y el PDF privado.",
  purchase:
    "También se retiran sus ítems y sus movimientos de caja y stock. Se bloquea si el stock resultante sería negativo.",
  consumption:
    "También se retiran sus movimientos de inventario y se recalcula el stock.",
  inventoryMovement: "El stock se actualiza al retirar este movimiento.",
  financialEntry: "Los saldos se actualizan al retirar este movimiento.",
  job: "También se eliminan sus fotos y archivos. Si nació de un turno, éste vuelve a confirmado.",
  serviceCase:
    "También se eliminan sus revisiones de importes. Si nació de un presupuesto, éste vuelve a emitido.",
  photo: "También se eliminan los archivos privados de esta foto.",
};

export function recordManagerPath(kind: RecordKind) {
  return `/app/admin/records?kind=${kind}`;
}

export interface DeletionDependency {
  label: string;
  count: number;
  href: string;
}
