export function usdToArsText(usdAmount: string, rateArsPerUsd: string) {
  const usd = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(usdAmount.trim());
  const rate = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec(rateArsPerUsd.trim());
  if (!usd || !rate) return "0.00";
  const usdCents =
    BigInt(usd[1]!) * 100n + BigInt((usd[2] ?? "").padEnd(2, "0") || "0");
  const rateMicros =
    BigInt(rate[1]!) * 1_000_000n +
    BigInt((rate[2] ?? "").padEnd(6, "0") || "0");
  const arsCents = (usdCents * rateMicros + 500_000n) / 1_000_000n;
  return `${arsCents / 100n}.${String(arsCents % 100n).padStart(2, "0")}`;
}
