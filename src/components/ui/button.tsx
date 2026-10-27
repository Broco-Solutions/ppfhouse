import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "@/design-system/cx";
import type { ButtonVariant, ControlSize } from "@/design-system/contracts";

import styles from "./primitives.module.css";

const variants: Record<ButtonVariant, string | undefined> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.dangerButton,
};

const sizes: Record<ControlSize, string | undefined> = {
  sm: styles.buttonSm,
  md: undefined,
  lg: styles.buttonLg,
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  size?: ControlSize;
  variant?: ButtonVariant;
  leadingIcon?: ReactNode;
}

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ControlSize = "md",
  className?: string,
) {
  return cx(styles.button, variants[variant], sizes[size], className);
}

export function Button({
  children,
  className,
  disabled,
  leadingIcon,
  loading = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={buttonClassName(variant, size, className)}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? (
        <span aria-hidden="true" className={styles.spinner} />
      ) : (
        leadingIcon
      )}
      <span>{children}</span>
    </button>
  );
}
