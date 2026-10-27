import type { CSSProperties, ReactNode } from "react";

import { cx } from "@/design-system/cx";

import styles from "./primitives.module.css";

export function Spinner({ label = "Cargando" }: { label?: string }) {
  return (
    <span aria-label={label} role="status">
      <span aria-hidden="true" className={styles.spinner} />
    </span>
  );
}

export function Skeleton({
  className,
  height,
  label = "Cargando contenido",
  width,
}: {
  className?: string;
  height?: CSSProperties["height"];
  label?: string;
  width?: CSSProperties["width"];
}) {
  return (
    <span
      aria-label={label}
      aria-live="polite"
      className={cx(styles.skeleton, className)}
      role="status"
      style={{ height, width }}
    />
  );
}

export function EmptyState({
  action,
  children,
  className,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title: ReactNode;
}) {
  return (
    <section className={cx(styles.empty, className)}>
      <span aria-hidden="true" className={styles.emptyMark} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </section>
  );
}
