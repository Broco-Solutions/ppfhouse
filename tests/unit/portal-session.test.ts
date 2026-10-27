import { describe, expect, it } from "vitest";

import {
  decodePortalSession,
  encodePortalSession,
} from "@/modules/portal/application/portal-session";

describe("portal session signature", () => {
  it("accepts an intact short session", () => {
    const value = encodePortalSession({
      linkId: "4b0a7bb4-3ec1-4ecb-bec6-0c70a7c38a75",
      binding: "binding",
      exp: Math.floor(Date.now() / 1_000) + 60,
    });
    expect(decodePortalSession(value)).toMatchObject({ binding: "binding" });
  });

  it("rejects tampering and expired values", () => {
    const valid = encodePortalSession({
      linkId: "4b0a7bb4-3ec1-4ecb-bec6-0c70a7c38a75",
      binding: "binding",
      exp: Math.floor(Date.now() / 1_000) + 60,
    });
    expect(decodePortalSession(`${valid}x`)).toBeNull();
    expect(
      decodePortalSession(
        encodePortalSession({
          linkId: "4b0a7bb4-3ec1-4ecb-bec6-0c70a7c38a75",
          binding: "binding",
          exp: Math.floor(Date.now() / 1_000) - 1,
        }),
      ),
    ).toBeNull();
  });
});
