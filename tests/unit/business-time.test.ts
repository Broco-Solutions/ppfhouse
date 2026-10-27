import { describe, expect, it } from "vitest";

import {
  businessDayRange,
  businessLocalDateTimeToUtc,
  BUSINESS_TIME_ZONE,
  getBusinessDateKey,
} from "@/shared/date-time/business-time";

describe("business timezone", () => {
  it("uses the Rosario IANA timezone", () => {
    expect(BUSINESS_TIME_ZONE).toBe("America/Argentina/Buenos_Aires");
  });

  it("resolves today at the local day boundary, not the UTC day", () => {
    const instant = new Date("2026-10-02T02:30:00.000Z");

    expect(getBusinessDateKey(instant)).toBe("2026-10-01");
  });

  it("converts local appointment times to UTC through the IANA timezone", () => {
    expect(businessLocalDateTimeToUtc("2026-10-02T09:30").toISOString()).toBe(
      "2026-10-02T12:30:00.000Z",
    );
    expect(businessDayRange("2026-10-02")).toMatchObject({
      start: new Date("2026-10-02T03:00:00.000Z"),
      end: new Date("2026-10-03T03:00:00.000Z"),
    });
  });

  it("uses historical Buenos Aires offset instead of a fixed UTC-3", () => {
    expect(businessLocalDateTimeToUtc("2008-01-15T12:00").toISOString()).toBe(
      "2008-01-15T14:00:00.000Z",
    );
  });
});
