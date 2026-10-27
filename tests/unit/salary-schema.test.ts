import { describe, expect, it } from "vitest";
import {
  nextSalaryMonth,
  salaryAmountSchema,
  salaryMonthSchema,
  salaryMonthsBetween,
  paySalarySchema,
} from "@/modules/salaries/domain/salary-schema";

describe("salary inputs and monthly recurrence", () => {
  it("accepts Argentine decimal commas without interpreting ambiguous grouping", () => {
    expect(salaryAmountSchema.parse(" 1234567,50 ")).toBe("1234567.50");
    expect(salaryAmountSchema.parse("1234567.50")).toBe("1234567.50");
    for (const invalid of [
      "0",
      "0,00",
      "-10",
      "1.000.000",
      "1.234,56",
      "Infinity",
      "1e6",
      "2.345",
      "",
    ]) {
      expect(salaryAmountSchema.safeParse(invalid).success).toBe(false);
    }
  });
  it("records a USD payment without an exchange rate", () => {
    const parsed = paySalarySchema.parse({
      salaryId: "f4dcd223-c714-499f-8466-68c5f742b01b",
      month: "2026-10",
      version: 0,
      occurredLocal: "2026-10-20T12:00",
      paymentMethod: "TRANSFER",
      idempotencyKey: "d894fe52-1dfe-4d65-9a53-cecfa013566a",
    });
    expect(parsed).not.toHaveProperty("exchangeRateArsPerUsd");
  });
  it("crosses years and backfills each month exactly once", () => {
    expect(nextSalaryMonth("2026-12")).toBe("2027-01");
    expect(salaryMonthSchema.parse("2100-01")).toBe("2100-01");
    expect(salaryMonthsBetween("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(salaryMonthsBetween("2026-11", "2026-10")).toEqual([]);
    for (const invalid of ["2026-00", "2026-13", "2026-1", "1999-12"]) {
      expect(salaryMonthSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
