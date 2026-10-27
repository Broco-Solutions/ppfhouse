"use client";

import {
  CalendarDotsIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChartLineUpIcon,
  ClipboardTextIcon,
  HouseIcon,
  ListIcon,
  MoneyIcon,
  PackageIcon,
  MagnifyingGlassIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  ToolboxIcon,
  UserCircleGearIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useSyncExternalStore } from "react";
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Link as AriaLink,
  Modal,
  ModalOverlay,
  Tooltip as AriaTooltip,
  TooltipTrigger,
} from "react-aria-components";

import { BrandLogo, BrandMark } from "@/components/brand/brand-assets";
import type { NavigationItem } from "@/modules/identity/application/navigation";
import type { AuthenticatedUser } from "@/modules/identity/application/session";
import { LogoutButton } from "@/modules/identity/ui/logout-button";
import { GlobalSearchBar } from "@/modules/search/ui/global-search-bar";

import { Breadcrumbs } from "./breadcrumbs";
import styles from "./app-shell.module.css";

const groupOrder: NavigationItem["group"][] = [
  "Operación",
  "Comercial",
  "Insumos",
  "Administración",
];

type ShellIcon = ComponentType<{
  "aria-hidden"?: boolean;
  size?: number;
  weight?: "bold" | "regular";
}>;

const iconMap: Record<NavigationItem["icon"], ShellIcon> = {
  home: HouseIcon,
  calendar: CalendarDotsIcon,
  clients: UsersThreeIcon,
  jobs: ToolboxIcon,
  inventory: PackageIcon,
  quotes: ClipboardTextIcon,
  purchases: ShoppingCartIcon,
  finance: ChartLineUpIcon,
  salaries: MoneyIcon,
  services: ReceiptIcon,
  admin: UserCircleGearIcon,
};

const storageKey = "ferraro:sidebar-collapsed";
const storageEvent = "ferraro:sidebar-change";

function subscribeToSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(storageEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(storageEvent, callback);
  };
}

function getSidebarSnapshot() {
  return window.localStorage.getItem(storageKey) === "true";
}

function getSidebarServerSnapshot() {
  return false;
}

function isCurrentPath(
  pathname: string,
  href: string | undefined,
  items: NavigationItem[],
) {
  if (!href) return false;
  const matches =
    href === "/app"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  // Nested modules highlight their own entry rather than both links.
  return (
    matches &&
    !items.some(
      (item) =>
        item.href &&
        item.href.length > href.length &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`)),
    )
  );
}

function NavGroups({
  close,
  collapsed = false,
  items,
  pathname,
}: {
  close?: () => void;
  collapsed?: boolean;
  items: NavigationItem[];
  pathname: string;
}) {
  return groupOrder.map((group) => {
    const groupItems = items.filter((item) => item.group === group);
    if (groupItems.length === 0) return null;

    return (
      <div className={styles.navGroup} key={group}>
        <p className={styles.groupLabel}>{group}</p>
        {groupItems.map((item) => {
          if (!item.href) return null;
          const Icon = iconMap[item.icon];
          if (collapsed) {
            return (
              <TooltipTrigger closeDelay={100} delay={400} key={item.label}>
                <AriaLink
                  aria-label={item.label}
                  aria-current={
                    isCurrentPath(pathname, item.href, items)
                      ? "page"
                      : undefined
                  }
                  className={styles.navLink}
                  href={item.href}
                >
                  <Icon aria-hidden size={22} weight="regular" />
                  <span className={styles.navText}>{item.label}</span>
                </AriaLink>
                <AriaTooltip className={styles.sidebarTooltip}>
                  {item.label}
                </AriaTooltip>
              </TooltipTrigger>
            );
          }

          return (
            <Link
              aria-label={item.label}
              aria-current={
                isCurrentPath(pathname, item.href, items) ? "page" : undefined
              }
              className={styles.navLink}
              href={item.href}
              key={item.label}
              onClick={close}
            >
              <Icon aria-hidden size={22} weight="regular" />
              <span className={styles.navText}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  });
}

function Sidebar({
  collapsed,
  items,
  pathname,
  toggle,
  user,
}: {
  collapsed: boolean;
  items: NavigationItem[];
  pathname: string;
  toggle: () => void;
  user: AuthenticatedUser;
}) {
  const ToggleIcon = collapsed ? CaretRightIcon : CaretLeftIcon;
  return (
    <aside aria-label="Navegación lateral" className={styles.sidebar}>
      <div className={styles.brandArea}>
        <Link
          aria-label="Ir al inicio"
          className={styles.brandLink}
          href="/app"
        >
          <BrandLogo
            className={styles.brandLogo}
            decorative
            variant="inverse"
          />
          <BrandMark className={styles.brandMark} decorative size={36} />
        </Link>
        <button
          aria-label={collapsed ? "Expandir navegación" : "Contraer navegación"}
          className={styles.collapseButton}
          onClick={toggle}
          type="button"
        >
          <ToggleIcon aria-hidden size={20} weight="bold" />
        </button>
      </div>
      <nav aria-label="Navegación principal" className={styles.navigation}>
        <NavGroups collapsed={collapsed} items={items} pathname={pathname} />
      </nav>
      <div className={styles.account}>
        <span aria-hidden="true" className={styles.avatar}>
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <div className={styles.accountCopy}>
          <strong>{user.name}</strong>
          <small>{user.role === "ADMIN" ? "Administrador" : "Equipo"}</small>
        </div>
        <LogoutButton className={styles.logout} />
      </div>
    </aside>
  );
}

function MobileDrawer({
  items,
  pathname,
  user,
}: {
  items: NavigationItem[];
  pathname: string;
  user: AuthenticatedUser;
}) {
  return (
    <DialogTrigger>
      <AriaButton aria-label="Abrir menú" className={styles.menuButton}>
        <ListIcon aria-hidden size={24} weight="bold" />
      </AriaButton>
      <ModalOverlay className={styles.mobileDrawerOverlay} isDismissable>
        <Modal className={styles.mobileDrawer}>
          <AriaDialog className={styles.mobileDialog}>
            {({ close }) => (
              <>
                <header className={styles.mobileDialogHeader}>
                  <Heading slot="title">Menú</Heading>
                  <AriaButton
                    aria-label="Cerrar menú"
                    className={styles.closeButton}
                    onPress={close}
                  >
                    <XIcon aria-hidden size={22} weight="bold" />
                  </AriaButton>
                </header>
                <nav
                  aria-label="Navegación principal"
                  className={styles.mobileNavigation}
                >
                  <NavGroups close={close} items={items} pathname={pathname} />
                </nav>
                <div className={styles.mobileAccount}>
                  <div className={styles.mobileAccountHeader}>
                    <span aria-hidden="true" className={styles.avatar}>
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className={styles.accountCopy}>
                      <strong>{user.name}</strong>
                      <small>
                        {user.role === "ADMIN" ? "Administrador" : "Equipo"}
                      </small>
                    </div>
                  </div>
                  <LogoutButton className={styles.mobileLogout} />
                </div>
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export function ShellFrame({
  children,
  items,
  user,
}: {
  children: ReactNode;
  items: NavigationItem[];
  user: AuthenticatedUser;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const mobileItems = items
    .filter((item) => item.href && item.mobile)
    .slice(0, 5);

  function toggleSidebar() {
    window.localStorage.setItem(storageKey, String(!collapsed));
    window.dispatchEvent(new Event(storageEvent));
  }

  return (
    <div className={styles.shell} data-collapsed={collapsed}>
      <a className={styles.skipLink} href="#main-content">
        Saltar al contenido
      </a>
      <Sidebar
        collapsed={collapsed}
        items={items}
        pathname={pathname}
        toggle={toggleSidebar}
        user={user}
      />
      <div className={styles.mainColumn}>
        <header className={styles.mobileHeader}>
          <Link aria-label="Ir al inicio" href="/app">
            <BrandLogo
              className={styles.mobileBrand}
              decorative
              variant="monochrome"
            />
          </Link>
          <div className={styles.mobileActions}>
            <Link
              aria-label="Buscar"
              className={styles.searchButton}
              href="/app/search"
            >
              <MagnifyingGlassIcon aria-hidden size={22} weight="bold" />
            </Link>
            <MobileDrawer items={items} pathname={pathname} user={user} />
          </div>
        </header>
        <div className={styles.topbar}>
          <GlobalSearchBar />
        </div>
        <Breadcrumbs />
        <main className={styles.content} id="main-content" tabIndex={-1}>
          {children}
        </main>
        <nav aria-label="Accesos rápidos" className={styles.mobileBottomNav}>
          {mobileItems.map((item) => {
            const Icon = iconMap[item.icon];
            return (
              <Link
                aria-current={
                  isCurrentPath(pathname, item.href, items) ? "page" : undefined
                }
                className={styles.bottomLink}
                href={item.href ?? "/app"}
                key={item.label}
              >
                <Icon aria-hidden size={21} weight="regular" />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
