"use client";

import { CaretRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./breadcrumbs.module.css";

const labels: Record<string, string> = {
  admin: "Administración",
  blocks: "Bloqueos",
  calendar: "Agenda",
  categories: "Categorías",
  clients: "Clientes",
  complete: "Completar",
  "design-system": "Sistema de diseño",
  edit: "Editar",
  finance: "Finanzas",
  salaries: "Sueldos",
  inventory: "Inventario",
  jobs: "Trabajos",
  new: "Nuevo",
  purchases: "Compras",
  quotes: "Presupuestos",
  schedule: "Agendar",
  search: "Búsqueda",
  services: "Servicios",
  suppliers: "Proveedores",
  vehicles: "Vehículos",
};

function labelFor(segment: string) {
  return labels[segment] ?? "Detalle";
}

export function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/app") return null;

  const segments = pathname.split("/").filter(Boolean).slice(1);
  return (
    <nav aria-label="Migas de pan" className={styles.breadcrumbs}>
      <ol>
        <li>
          <Link href="/app">Inicio</Link>
        </li>
        {segments.map((segment, index) => {
          const href = `/app/${segments.slice(0, index + 1).join("/")}`;
          const current = index === segments.length - 1;
          return (
            <li key={href}>
              <CaretRightIcon aria-hidden size={14} weight="bold" />
              {current ? (
                <span aria-current="page">{labelFor(segment)}</span>
              ) : (
                <Link href={href}>{labelFor(segment)}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
