import type { ReactNode } from "react";

import { getNavigationForRole } from "@/modules/identity/application/navigation";
import type { AuthenticatedUser } from "@/modules/identity/application/session";

import { ShellFrame } from "./shell-frame";

interface AppShellProps {
  children: ReactNode;
  user: AuthenticatedUser;
}

export function AppShell({ children, user }: AppShellProps) {
  return (
    <ShellFrame items={getNavigationForRole(user.role)} user={user}>
      {children}
    </ShellFrame>
  );
}
