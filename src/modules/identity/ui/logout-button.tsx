"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/infrastructure/auth/client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      className={className}
      leadingIcon={<SignOutIcon aria-hidden="true" size={20} />}
      onClick={handleLogout}
      disabled={isPending}
      variant="ghost"
    >
      {isPending ? "Saliendo…" : "Cerrar sesión"}
    </Button>
  );
}
