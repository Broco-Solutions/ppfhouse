import type { ReactNode } from "react";

import { AppShell } from "@/components/patterns/app-shell";
import { requireUser } from "@/modules/identity/application/session";

export default async function BackofficeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireUser();

  return <AppShell user={session.user}>{children}</AppShell>;
}
