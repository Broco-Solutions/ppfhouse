import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/infrastructure/auth/server";
import { isUserRole, type UserRole } from "@/modules/identity/domain/roles";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  session: {
    id: string;
    expiresAt: Date;
  };
}

export const getOptionalSession = cache(
  async (): Promise<AuthenticatedSession | null> => {
    const current = await auth.api.getSession({ headers: await headers() });

    if (!current || !current.user.active || !isUserRole(current.user.role)) {
      return null;
    }

    return {
      user: {
        id: current.user.id,
        name: current.user.name,
        email: current.user.email,
        role: current.user.role,
        active: current.user.active,
      },
      session: {
        id: current.session.id,
        expiresAt: current.session.expiresAt,
      },
    };
  },
);

export async function requireUser(): Promise<AuthenticatedSession> {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
