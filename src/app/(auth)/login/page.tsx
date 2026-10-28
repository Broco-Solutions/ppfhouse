import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { brandConfig } from "@/config/brand";

import { BrandLockup, BrandLogo } from "@/components/brand/brand-assets";
import { getOptionalSession } from "@/modules/identity/application/session";
import { LoginForm } from "@/modules/identity/ui/login-form";

import styles from "./login.module.css";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  const session = await getOptionalSession();

  if (session) {
    redirect("/app");
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-label="PPF HOUSE">
        <div className={styles.brandPlate}>
          <BrandLogo
            className={styles.lockup}
            variant="inverse"
            width={256}
            priority
          />
        </div>
        <div className={styles.brandCopy}>
          <p className={styles.eyebrow}>Gestión interna · PPF HOUSE</p>
          <h1>El taller, claro y bajo control.</h1>
          <p>
            Una base precisa para coordinar cada jornada, desde el primer turno
            hasta la entrega final.
          </p>
        </div>
        <div className={styles.brandFooter}>
          {brandConfig.location} · {brandConfig.country}
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.mobileBrand}>
            <BrandLockup className={styles.mobileLockup} width={272} priority />
          </div>
          <div className={styles.formHeader}>
            <p className={styles.eyebrow}>Acceso interno</p>
            <h2>Bienvenido</h2>
            <p>Ingresá con las credenciales provistas por un administrador.</p>
          </div>
          <LoginForm />
          <p className={styles.help}>
            El registro público está deshabilitado. Si necesitás acceso,
            contactá a un administrador.
          </p>
        </div>
      </section>
    </main>
  );
}
