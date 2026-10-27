import { forbidden } from "next/navigation";

import { requireUser } from "@/modules/identity/application/session";
import { hasRole, type UserRole } from "@/modules/identity/domain/roles";

export async function requireRole(
  ...allowed: readonly UserRole[]
): ReturnType<typeof requireUser> {
  const session = await requireUser();

  if (!hasRole(session.user.role, allowed)) {
    forbidden();
  }

  return session;
}
