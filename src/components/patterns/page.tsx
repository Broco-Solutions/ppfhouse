import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cx } from "@/design-system/cx";

import styles from "./page.module.css";

export function Page({
  className,
  size = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: "narrow" | "default" | "wide" }) {
  return (
    <div
      className={cx(
        styles.page,
        size === "narrow" && styles.narrow,
        size === "wide" && styles.wide,
        className,
      )}
      {...props}
    />
  );
}

interface HeaderProps {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: HeaderProps) {
  return (
    <header className={cx(styles.header, className)}>
      <div className={styles.headerCopy}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  actions,
  className,
  description,
  eyebrow,
  headingLevel = "h2",
  title,
}: HeaderProps & { headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel as ElementType;
  return (
    <header className={cx(styles.sectionHeader, className)}>
      <div className={styles.sectionCopy}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <Heading>{title}</Heading>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

export function DetailHeader(props: HeaderProps) {
  const { actions, className, description, eyebrow, title } = props;
  return (
    <header className={cx(styles.detailHeader, className)}>
      <div className={styles.headerCopy}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

export function DataToolbar({
  children,
  className,
  primary,
  ...props
}: HTMLAttributes<HTMLDivElement> & { primary?: ReactNode }) {
  return (
    <div className={cx(styles.toolbar, className)} {...props}>
      {primary ? <div className={styles.toolbarPrimary}>{primary}</div> : null}
      {children}
    </div>
  );
}

export function FormSection({
  children,
  className,
  description,
  title,
}: HTMLAttributes<HTMLElement> & {
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className={cx(styles.formSection, className)}>
      <div className={styles.sectionCopy}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function FormGrid(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx(styles.formGrid, props.className)} />;
}

export function FormActions(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx(styles.formActions, props.className)} />;
}
