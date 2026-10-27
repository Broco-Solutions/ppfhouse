import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";

describe("password hashing", () => {
  it("uses Argon2id and verifies without retaining plaintext", async () => {
    const password = "Strong-password-for-tests";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(
      false,
    );
  });
});
