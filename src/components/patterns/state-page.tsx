import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-assets";

import styles from "./state-page.module.css";

export function StatePage({
  action,
  code,
  description,
  title,
}: {
  action: ReactNode;
  code: string;
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.state}>
        <BrandMark className={styles.mark} decorative size={40} />
        <p className={styles.code}>{code}</p>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
        {action}
      </section>
    </main>
  );
}

export const stateActionClassName = styles.action;
