import { Skeleton } from "@/components/ui/feedback";
import styles from "@/modules/scheduling/ui/calendar.module.css";

export default function CalendarLoading() {
  return (
    <div aria-busy="true" className={styles.loading} role="status">
      <span className="sr-only">Cargando agenda</span>
      <Skeleton height="3.5rem" width="16rem" />
      <Skeleton height="3rem" />
      <Skeleton className={styles.loadingCalendar} />
    </div>
  );
}
