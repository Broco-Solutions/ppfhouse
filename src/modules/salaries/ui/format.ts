export const usd = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "code",
});
export function formatSalaryMonth(month: string) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
}
export const salaryStatusLabels = {
  PENDING: "Pendiente de pagar",
  PAID: "Pagado",
  CANCELLED: "Anulado",
} as const;
