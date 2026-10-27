import { Skeleton } from "@/components/ui/feedback";

import styles from "./loading.module.css";

export default function AppLoading() {
  return (
    <div className={styles.loading} aria-busy="true" aria-live="polite">
      <div className={styles.header}>
        <Skeleton height="1rem" label="Cargando página" width="8rem" />
        <Skeleton height="3.25rem" width="55%" />
        <Skeleton height="1.25rem" width="42%" />
      </div>
      <div className={styles.grid}>
        <Skeleton height="12rem" />
        <Skeleton height="12rem" />
        <Skeleton height="12rem" />
      </div>
    </div>
  );
}
