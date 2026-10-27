import { describe, expect, it } from "vitest";

import {
  passwordResetSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/modules/users/domain/user-schema";

const valid = {
  name: "Lucía Gómez",
  email: "  Lucia@Ferraro.TEST ",
  role: "STAFF",
  password: "una-contraseña-larga",
  passwordConfirmation: "una-contraseña-larga",
};

describe("user schemas", () => {
  it("normalizes email and accepts a valid user", () => {
    const parsed = userCreateSchema.parse(valid);
    expect(parsed.email).toBe("lucia@ferraro.test");
    expect(parsed.role).toBe("STAFF");
  });

  it("rejects unknown roles and invalid emails", () => {
    const result = userUpdateSchema.safeParse({
      ...valid,
      email: "no-es-email",
      role: "OWNER",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["email", "role"]),
    );
  });

  it("requires at least 12 characters and matching confirmation", () => {
    expect(
      passwordResetSchema.safeParse({
        password: "corta",
        passwordConfirmation: "corta",
      }).success,
    ).toBe(false);
    const mismatch = userCreateSchema.safeParse({
      ...valid,
      passwordConfirmation: "otra-contraseña-larga",
    });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.path).toEqual(["passwordConfirmation"]);
  });
});
