"use client";

import { useEffect, useRef, type ReactNode } from "react";

import styles from "./calendar.module.css";

export function DayTimelineScroller({
  day,
  children,
}: {
  day: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = ref.current;
    const morning = scroller?.querySelector<HTMLElement>(
      '[data-calendar-hour="7"]',
    );
    if (scroller && morning) scroller.scrollTop = morning.offsetTop;
  }, [day]);

  return (
    <div
      ref={ref}
      aria-label={`Horarios del ${day}`}
      className={styles.dayScroller}
      role="region"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
