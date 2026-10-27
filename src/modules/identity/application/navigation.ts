import type { UserRole } from "@/modules/identity/domain/roles";

export interface NavigationItem {
  group: "Operación" | "Comercial" | "Insumos" | "Administración";
  icon:
    | "home"
    | "calendar"
    | "clients"
    | "jobs"
    | "inventory"
    | "quotes"
    | "purchases"
    | "finance"
    | "salaries"
    | "services"
    | "admin";
  label: string;
  href?: string;
  shortLabel: string;
  roles: readonly UserRole[];
  mobile?: boolean;
  upcoming?: boolean;
}

const navigation: readonly NavigationItem[] = [
  {
    group: "Operación",
    icon: "home",
    label: "Inicio",
    shortLabel: "Inicio",
    href: "/app",
    roles: ["ADMIN", "STAFF"],
    mobile: true,
  },
  {
    group: "Operación",
    icon: "calendar",
    label: "Agenda",
    shortLabel: "Agenda",
    href: "/app/calendar",
    roles: ["ADMIN", "STAFF"],
    mobile: true,
  },
  {
    group: "Operación",
    icon: "clients",
    label: "Clientes",
    shortLabel: "Clientes",
    href: "/app/clients",
    roles: ["ADMIN", "STAFF"],
    mobile: true,
  },
  {
    group: "Operación",
    icon: "jobs",
    label: "Trabajos",
    shortLabel: "Trabajos",
    href: "/app/jobs",
    roles: ["ADMIN", "STAFF"],
    mobile: true,
  },
  {
    group: "Insumos",
    icon: "inventory",
    label: "Inventario",
    shortLabel: "Stock",
    href: "/app/inventory",
    roles: ["ADMIN", "STAFF"],
    mobile: true,
  },
  {
    group: "Comercial",
    icon: "quotes",
    label: "Presupuestos",
    shortLabel: "Presupuestos",
    href: "/app/quotes",
    roles: ["ADMIN"],
  },
  {
    group: "Insumos",
    icon: "purchases",
    label: "Compras",
    shortLabel: "Compras",
    href: "/app/purchases",
    roles: ["ADMIN"],
  },
  {
    group: "Administración",
    icon: "finance",
    label: "Finanzas",
    shortLabel: "Finanzas",
    href: "/app/finance",
    roles: ["ADMIN"],
  },
  {
    group: "Administración",
    icon: "salaries",
    label: "Sueldos",
    shortLabel: "Sueldos",
    href: "/app/finance/salaries",
    roles: ["ADMIN"],
  },
  {
    group: "Comercial",
    icon: "services",
    label: "Servicios",
    shortLabel: "Servicios",
    href: "/app/services",
    roles: ["ADMIN"],
  },
  {
    group: "Administración",
    icon: "admin",
    label: "Administración",
    shortLabel: "Admin",
    href: "/app/admin",
    roles: ["ADMIN"],
  },
] as const;

export function getNavigationForRole(role: UserRole): NavigationItem[] {
  return navigation.filter((item) => item.roles.includes(role));
}
