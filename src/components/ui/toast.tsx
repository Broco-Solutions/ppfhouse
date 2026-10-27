"use client";

import { XIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import styles from "./toast.module.css";

export function ToastRegion({ children }: { children: ReactNode }) {
  return (
    <div aria-label="Notificaciones" className={styles.region} role="region">
      {children}
    </div>
  );
}

export function Toast({
  children,
  onDismiss,
  title,
}: {
  children: ReactNode;
  onDismiss?: () => void;
  title: ReactNode;
}) {
  return (
    <div className={styles.toast} role="status">
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      {onDismiss ? (
        <button
          aria-label="Cerrar notificación"
          className={styles.dismiss}
          onClick={onDismiss}
          type="button"
        >
          <XIcon aria-hidden size={20} weight="bold" />
        </button>
      ) : null}
    </div>
  );
}
