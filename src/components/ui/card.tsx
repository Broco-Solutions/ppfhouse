import type { HTMLAttributes } from "react";

import { cx } from "@/design-system/cx";
import type { SurfaceVariant } from "@/design-system/contracts";

import styles from "./primitives.module.css";

const variants: Record<SurfaceVariant, string | undefined> = {
  flat: undefined,
  raised: styles.cardRaised,
  interactive: styles.cardInteractive,
};

export function Card({
  className,
  variant = "flat",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: SurfaceVariant }) {
  return (
    <div className={cx(styles.card, variants[variant], className)} {...props} />
  );
}
