import { Skeleton } from "@/components/ui/feedback";
import styles from "@/modules/services/ui/services.module.css";

export default function ServicesLoading() {
  return (
    <div aria-busy="true" className={styles.loading} role="status">
      <span className="sr-only">Cargando catálogo</span>
      <Skeleton height="3.5rem" width="18rem" />
      <Skeleton height="4.5rem" />
      <div className={styles.loading}>
        <Skeleton height="5.75rem" />
        <Skeleton height="5.75rem" />
        <Skeleton height="5.75rem" />
      </div>
    </div>
  );
}
