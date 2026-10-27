import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandLockup } from "@/components/brand/brand-assets";
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
      <section className={styles.brandPanel} aria-label="Ferraro Manager">
        <div className={styles.brandPlate}>
          <BrandLockup className={styles.lockup} priority />
        </div>
        <div className={styles.brandCopy}>
          <p className={styles.eyebrow}>Gestión interna · Ferraro Detail</p>
          <h1>El taller, claro y bajo control.</h1>
          <p>
            Una base precisa para coordinar cada jornada, desde el primer turno
            hasta la entrega final.
          </p>
        </div>
        <div className={styles.brandFooter}>Rosario · Santa Fe · Argentina</div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.mobileBrand}>
            <BrandLockup className={styles.mobileLockup} priority />
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
