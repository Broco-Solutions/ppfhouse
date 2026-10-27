"use client";

import { XIcon } from "@phosphor-icons/react";
import type { ReactElement, ReactNode } from "react";
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Tooltip as AriaTooltip,
  TooltipTrigger,
} from "react-aria-components";

import { cx } from "@/design-system/cx";
import type { ButtonVariant } from "@/design-system/contracts";

import { buttonClassName } from "./button";
import styles from "./primitives.module.css";

interface OverlayProps {
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
  triggerLabel: ReactNode;
  triggerVariant?: ButtonVariant;
}

function OverlayContent({
  children,
  description,
  title,
}: Omit<OverlayProps, "triggerLabel" | "triggerVariant">) {
  return (
    <AriaDialog className={styles.dialog}>
      {({ close }) => (
        <>
          <Heading slot="title">{title}</Heading>
          {description ? (
            <p className={styles.dialogDescription}>{description}</p>
          ) : null}
          {children}
          <div className={styles.dialogActions}>
            <AriaButton
              aria-label="Cerrar"
              className={buttonClassName("secondary")}
              onPress={close}
            >
              Cerrar
            </AriaButton>
          </div>
        </>
      )}
    </AriaDialog>
  );
}

export function Dialog({
  children,
  description,
  title,
  triggerLabel,
  triggerVariant = "secondary",
}: OverlayProps) {
  return (
    <AriaDialogTrigger>
      <AriaButton className={buttonClassName(triggerVariant)}>
        {triggerLabel}
      </AriaButton>
      <ModalOverlay className={styles.overlay} isDismissable>
        <Modal className={styles.modal}>
          <OverlayContent description={description} title={title}>
            {children}
          </OverlayContent>
        </Modal>
      </ModalOverlay>
    </AriaDialogTrigger>
  );
}

export function Drawer({
  children,
  description,
  title,
  triggerLabel,
  triggerVariant = "secondary",
}: OverlayProps) {
  return (
    <AriaDialogTrigger>
      <AriaButton className={buttonClassName(triggerVariant)}>
        {triggerLabel}
      </AriaButton>
      <ModalOverlay
        className={cx(styles.overlay, styles.drawerOverlay)}
        isDismissable
      >
        <Modal className={cx(styles.modal, styles.drawerModal)}>
          <OverlayContent description={description} title={title}>
            {children}
          </OverlayContent>
        </Modal>
      </ModalOverlay>
    </AriaDialogTrigger>
  );
}

export function IconButton({
  children,
  label,
  tooltip,
  variant = "ghost",
}: {
  children: ReactElement;
  label: string;
  tooltip?: string;
  variant?: "ghost" | "danger";
}) {
  const trigger = (
    <AriaButton
      aria-label={label}
      className={cx(
        styles.iconButton,
        variant === "danger" ? styles.dangerButton : styles.ghost,
      )}
    >
      {children}
    </AriaButton>
  );

  if (!tooltip) return trigger;

  return (
    <TooltipTrigger closeDelay={100} delay={400}>
      {trigger}
      <AriaTooltip className={styles.tooltip}>{tooltip}</AriaTooltip>
    </TooltipTrigger>
  );
}

interface ConfirmDialogProps {
  confirmVariant?: ButtonVariant;
  isDisabled?: boolean;
  cancelLabel?: string;
  confirmLabel: string;
  description: ReactNode;
  onConfirm: () => void;
  title: ReactNode;
  triggerLabel: ReactNode;
  triggerClassName?: string;
  triggerVariant?: ButtonVariant;
}

export function ConfirmDialog({
  confirmVariant = "danger",
  isDisabled,
  cancelLabel = "Cancelar",
  confirmLabel,
  description,
  onConfirm,
  title,
  triggerClassName,
  triggerLabel,
  triggerVariant = "danger",
}: ConfirmDialogProps) {
  return (
    <AriaDialogTrigger>
      <AriaButton
        isDisabled={isDisabled}
        className={buttonClassName(triggerVariant, "md", triggerClassName)}
      >
        {triggerLabel}
      </AriaButton>
      <ModalOverlay className={styles.overlay} isDismissable>
        <Modal className={styles.modal}>
          <AriaDialog className={styles.dialog} role="alertdialog">
            <Heading slot="title">{title}</Heading>
            <p className={styles.dialogDescription}>{description}</p>
            <div className={styles.dialogActions}>
              <AriaButton
                autoFocus
                className={buttonClassName("secondary")}
                slot="close"
              >
                {cancelLabel}
              </AriaButton>
              <AriaButton
                className={buttonClassName(confirmVariant)}
                isDisabled={isDisabled}
                onPress={onConfirm}
                slot="close"
              >
                {confirmLabel}
              </AriaButton>
            </div>
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </AriaDialogTrigger>
  );
}

export function CloseIcon() {
  return <XIcon aria-hidden="true" size={20} weight="bold" />;
}
