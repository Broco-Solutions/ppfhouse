import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createSalary: vi.fn(),
  adjustSalary: vi.fn(),
  paySalary: vi.fn(),
  stopSalary: vi.fn(),
  cancelSalaryMonth: vi.fn(),
  reverseFinancialEntry: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/modules/identity/application/authorization", () => ({
  requireRole: mocks.requireRole,
}));
vi.mock("@/modules/salaries/application/salary-service", () => ({
  createSalary: mocks.createSalary,
  adjustSalary: mocks.adjustSalary,
  paySalary: mocks.paySalary,
  stopSalary: mocks.stopSalary,
  cancelSalaryMonth: mocks.cancelSalaryMonth,
}));
vi.mock("@/modules/finance/application/finance-service", () => ({
  reverseFinancialEntry: mocks.reverseFinancialEntry,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { saveSalaryAction } from "@/modules/salaries/application/actions";

describe("salary action authorization and feedback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireRole.mockResolvedValue({ user: { id: "admin" } });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
  });
  it.each(["create", "adjust", "pay", "stop", "cancel", "reverse"])(
    "blocks unauthorized %s before accessing payroll",
    async (operation) => {
      mocks.requireRole.mockRejectedValueOnce(new Error("FORBIDDEN"));
      const form = new FormData();
      form.set("operation", operation);
      await expect(saveSalaryAction({ status: "idle" }, form)).rejects.toThrow(
        "FORBIDDEN",
      );
      expect(mocks.requireRole).toHaveBeenCalledWith("ADMIN");
      for (const command of [
        mocks.createSalary,
        mocks.adjustSalary,
        mocks.paySalary,
        mocks.stopSalary,
        mocks.cancelSalaryMonth,
        mocks.reverseFinancialEntry,
      ])
        expect(command).not.toHaveBeenCalled();
    },
  );
  it("reports conflicts without redirecting or exposing internal errors", async () => {
    const form = new FormData();
    form.set("operation", "adjust");
    mocks.adjustSalary.mockRejectedValueOnce(new Error("SALARY_CONFLICT"));
    expect(await saveSalaryAction({ status: "idle" }, form)).toMatchObject({
      status: "error",
      message: expect.stringContaining("Recargá"),
    });
    mocks.adjustSalary.mockRejectedValueOnce(
      new Error("private database credentials"),
    );
    expect(
      (await saveSalaryAction({ status: "idle" }, form)).message,
    ).not.toContain("private database");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("refreshes financial indicators and payroll after successful commands", async () => {
    const salaryId = "f4dcd223-c714-499f-8466-68c5f742b01b";
    mocks.createSalary.mockResolvedValue({ id: salaryId });
    const form = new FormData();
    form.set("operation", "create");
    form.set("month", "2026-10");
    await expect(saveSalaryAction({ status: "idle" }, form)).rejects.toThrow(
      `REDIRECT:/app/finance/salaries/${salaryId}?saved=1&month=2026-10`,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/finance");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/finance/salaries",
      "layout",
    );
  });
});
