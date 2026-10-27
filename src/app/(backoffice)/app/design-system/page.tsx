import type { Metadata } from "next";

import { BrandMark } from "@/components/brand/brand-assets";
import { requireRole } from "@/modules/identity/application/authorization";

import styles from "./page.module.css";
import { ComponentShowcase } from "./showcase";

export const metadata: Metadata = { title: "Sistema de diseño" };

const brandColors = [
  { label: "Negro", className: styles.black, value: "#000000" },
  { label: "Gris", className: styles.gray, value: "#706F6F" },
  { label: "Amarillo", className: styles.yellow, value: "#FFCE13" },
  { label: "Blanco", className: styles.white, value: "#FFFFFF" },
] as const;

const semanticColors = [
  {
    label: "Confirmado",
    detail: "Éxito y estados positivos",
    className: styles.success,
  },
  {
    label: "Atención",
    detail: "Advertencias operativas",
    className: styles.warning,
  },
  {
    label: "Crítico",
    detail: "Errores y acciones destructivas",
    className: styles.danger,
  },
  {
    label: "Información",
    detail: "Contexto sin urgencia",
    className: styles.info,
  },
] as const;

export default async function DesignSystemPage() {
  await requireRole("ADMIN");

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Foundations · Sólo ADMIN</p>
          <h1>Precisión operativa con identidad Ferraro</h1>
          <p>
            Tokens semánticos, tipografía y reglas de composición que priorizan
            legibilidad, jerarquía y velocidad de uso diario.
          </p>
        </div>
        <BrandMark className={styles.mark} priority size={112} />
      </header>

      <section className={styles.section} aria-labelledby="brand-colors">
        <div className={styles.sectionHeader}>
          <p className={styles.label}>Marca</p>
          <h2 id="brand-colors">Paleta oficial, uso controlado</h2>
          <p>
            El amarillo identifica y acentúa; no reemplaza las señales
            semánticas ni se usa como fondo para texto blanco.
          </p>
        </div>
        <div className={styles.swatches}>
          {brandColors.map((color) => (
            <div
              className={`${styles.swatch} ${color.className}`}
              key={color.label}
            >
              <strong>{color.label}</strong>
              <code>{color.value}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="typography">
        <div className={styles.sectionHeader}>
          <p className={styles.label}>Tipografía</p>
          <h2 id="typography">Inter Variable</h2>
        </div>
        <div className={styles.typeSpecimen}>
          <p className={styles.display}>La operación del día, sin ruido.</p>
          <p className={styles.bodyCopy}>
            Turnos, clientes, vehículos y trabajos comparten una escala clara.
            Los textos extensos conservan un ancho legible y los datos usan
            cifras tabulares para facilitar la comparación.
          </p>
          <div className={styles.dataRow}>
            <strong>09:30 — Porsche 911 Carrera</strong>
            <span>$ 1.248.900,00</span>
            <span>STK-00421 · 18,50 l</span>
          </div>
          <button className={styles.focusDemo} type="button">
            Probar foco visible
          </button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="semantic-colors">
        <div className={styles.sectionHeader}>
          <p className={styles.label}>Estados</p>
          <h2 id="semantic-colors">Color con función explícita</h2>
          <p>Cada estado conserva texto y contexto además del color.</p>
        </div>
        <div className={styles.statusGrid}>
          {semanticColors.map((color) => (
            <div
              className={`${styles.status} ${color.className}`}
              key={color.label}
            >
              <strong>{color.label}</strong>
              <span>{color.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <ComponentShowcase />
    </main>
  );
}
