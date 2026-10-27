export const userRoles = ["ADMIN", "STAFF"] as const;

export type UserRole = (typeof userRoles)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}

export function hasRole(
  actual: UserRole,
  allowed: readonly UserRole[],
): boolean {
  return allowed.includes(actual);
}
