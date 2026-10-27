import { Skeleton } from "@/components/ui/feedback";
import styles from "@/modules/clients/ui/clients.module.css";

export default function ClientsLoading() {
  return (
    <div aria-busy="true" className={styles.loading} role="status">
      <span className="sr-only">Cargando clientes</span>
      <Skeleton height="3.5rem" width="18rem" />
      <Skeleton height="4.5rem" />
      <div className={styles.loading}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton height="5.75rem" key={index} />
        ))}
      </div>
    </div>
  );
}
