import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  issueQuote: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/modules/identity/application/authorization", () => ({
  requireRole: mocks.requireRole,
}));
vi.mock("@/modules/quotes/application/quote-service", () => ({
  issueQuote: mocks.issueQuote,
}));
vi.mock("@/modules/scheduling/application/scheduling-service", () => ({
  createAppointmentFromQuote: vi.fn(),
}));
vi.mock("@/infrastructure/logging/logger", () => ({
  logger: { error: mocks.logError },
}));

import { issueQuoteAction } from "@/modules/quotes/application/actions";

describe("quote issuance action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireRole.mockResolvedValue({ user: { id: "admin" } });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  it("reports a storage failure inline and permits a successful retry", async () => {
    const form = new FormData();
    form.set("quoteId", "quote-test");
    mocks.issueQuote.mockRejectedValueOnce(
      Object.assign(new Error("private infrastructure detail"), {
        code: "ENOENT",
      }),
    );
    const failed = await issueQuoteAction({ status: "idle" }, form);
    expect(failed).toMatchObject({
      status: "error",
      message: expect.stringContaining("Intentá nuevamente"),
    });
    expect(failed.message).not.toContain("private infrastructure detail");
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalledWith(
      "quote_issue_failed",
      expect.objectContaining({ quoteId: "quote-test", code: "ENOENT" }),
    );

    mocks.issueQuote.mockResolvedValueOnce(undefined);
    await expect(issueQuoteAction(failed, form)).rejects.toThrow(
      "REDIRECT:/app/quotes/quote-test?issued=1",
    );
    expect(mocks.requireRole).toHaveBeenCalledWith("ADMIN");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/quotes/quote-test");
    expect(mocks.logError).toHaveBeenCalledTimes(1);
  });

  it("does not turn authentication failures into recoverable issuance errors", async () => {
    mocks.requireRole.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    await expect(
      issueQuoteAction({ status: "idle" }, new FormData()),
    ).rejects.toThrow("UNAUTHORIZED");
    expect(mocks.issueQuote).not.toHaveBeenCalled();
  });
});
