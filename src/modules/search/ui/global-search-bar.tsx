"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

import styles from "./global-search-bar.module.css";

export function GlobalSearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  return (
    <form action="/app/search" className={styles.form} role="search">
      <label className="sr-only" htmlFor="global-search">
        Buscar en Ferraro
      </label>
      <div className={styles.control}>
        <MagnifyingGlassIcon
          aria-hidden="true"
          className={styles.icon}
          size={16}
        />
        <input
          className={styles.input}
          id="global-search"
          minLength={2}
          name="q"
          placeholder="Cliente, patente, trabajo, presupuesto…"
          ref={inputRef}
          type="search"
        />
        <kbd className={styles.shortcut}>Ctrl K</kbd>
      </div>
      <button className="sr-only">Buscar</button>
    </form>
  );
}
