import {
  cloneElement,
  isValidElement,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";

import { cx } from "@/design-system/cx";

import styles from "./primitives.module.css";

interface FieldProps {
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
  className?: string;
  description?: ReactNode;
  error?: ReactNode;
  label: ReactNode;
  optional?: boolean;
  required?: boolean;
}

export function Field({
  children,
  className,
  description,
  error,
  label,
  optional = false,
  required = false,
}: FieldProps) {
  const generatedId = useId();
  const controlId = children.props.id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [
    children.props["aria-describedby"],
    descriptionId,
    errorId,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={controlId}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
        {optional ? <span className={styles.optional}>Opcional</span> : null}
      </div>
      {isValidElement(children)
        ? cloneElement(children, {
            id: controlId,
            "aria-describedby": describedBy || undefined,
            "aria-invalid": Boolean(error) || undefined,
          })
        : children}
      {description ? (
        <span className={styles.description} id={descriptionId}>
          {description}
        </span>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <p className={styles.fieldError} id={id} role="alert">
      {children}
    </p>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(styles.control, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(styles.control, className)} {...props} />;
}

export function Select({
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(styles.control, className)} {...props}>
      {children}
    </select>
  );
}

interface ChoiceProps extends InputHTMLAttributes<HTMLInputElement> {
  children: ReactNode;
}

export function Choice({
  children,
  className,
  type = "checkbox",
  ...props
}: ChoiceProps) {
  return (
    <label className={cx(styles.choice, className)}>
      <input type={type} {...props} />
      <span>{children}</span>
    </label>
  );
}
