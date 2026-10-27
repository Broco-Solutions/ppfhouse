"use client";

import { CalendarDotsIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";

import { MiniCalendar } from "./mini-calendar";
import styles from "./schedule-picker.module.css";

export function CalendarDateField({
  className,
  date,
  today,
  view,
}: {
  className?: string;
  date: string;
  today: string;
  view: "day" | "week" | "month";
}) {
  const router = useRouter();

  return (
    <DialogTrigger>
      <Button aria-label="Elegir fecha" className={className}>
        <CalendarDotsIcon aria-hidden size={18} />
        <span>Ir a fecha</span>
      </Button>
      <Popover className={styles.popover} offset={6} placement="bottom end">
        <Dialog aria-label="Elegir fecha" className={styles.popoverDialog}>
          {({ close }) => (
            <MiniCalendar
              autoFocus
              label="Fechas"
              onChange={(day) => {
                close();
                router.push(`/app/calendar?view=${view}&date=${day}`);
              }}
              today={today}
              value={date}
            />
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
