import {
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { cx } from "@/design-system/cx";
import type { Intent } from "@/design-system/contracts";

import styles from "./primitives.module.css";

const intents: Record<Intent, string | undefined> = {
  neutral: styles.neutral,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  info: styles.info,
};

const icons = {
  neutral: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  danger: WarningCircleIcon,
  info: InfoIcon,
} as const;

export function Badge({
  children,
  className,
  intent = "neutral",
  withIcon = false,
}: {
  children: ReactNode;
  className?: string;
  intent?: Intent;
  withIcon?: boolean;
}) {
  const Icon = icons[intent];
  return (
    <span className={cx(styles.badge, intents[intent], className)}>
      {withIcon ? <Icon aria-hidden="true" size={14} weight="bold" /> : null}
      {children}
    </span>
  );
}

export function Alert({
  children,
  className,
  intent = "info",
  title,
}: {
  children: ReactNode;
  className?: string;
  intent?: Exclude<Intent, "neutral">;
  title: ReactNode;
}) {
  const Icon = icons[intent];
  return (
    <div
      className={cx(styles.alert, intents[intent], className)}
      role={intent === "danger" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" size={22} weight="bold" />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
