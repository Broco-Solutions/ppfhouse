"use client";

import { useRef } from "react";
import type { ButtonVariant } from "@/design-system/contracts";

import { ConfirmDialog } from "./overlays";

interface ConfirmButtonProps {
  children: string;
  message: string;
  className?: string;
  disabled?: boolean;
  variant?: ButtonVariant;
}

export function ConfirmButton({
  children,
  message,
  className,
  disabled,
  variant = "danger",
}: ConfirmButtonProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);

  return (
    <span ref={anchorRef}>
      <ConfirmDialog
        triggerVariant={variant}
        confirmVariant={variant}
        isDisabled={disabled}
        confirmLabel={children}
        description={message}
        onConfirm={() => anchorRef.current?.closest("form")?.requestSubmit()}
        title="Confirmar acción"
        triggerClassName={className}
        triggerLabel={children}
      />
    </span>
  );
}
