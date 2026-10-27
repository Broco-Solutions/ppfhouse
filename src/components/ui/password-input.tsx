"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { useState, type InputHTMLAttributes } from "react";

import { cx } from "@/design-system/cx";

import { Input } from "./field";
import styles from "./password-input.module.css";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeSlashIcon : EyeIcon;

  return (
    <span className={styles.field}>
      <Input
        {...props}
        className={cx(styles.control, className)}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className={styles.toggle}
        disabled={props.disabled}
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        <Icon aria-hidden size={20} weight="regular" />
      </button>
    </span>
  );
}
