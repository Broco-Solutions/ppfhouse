"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/status";
import { authClient } from "@/infrastructure/auth/client";

import styles from "./login-form.module.css";

const genericError =
  "No pudimos iniciar sesión. Revisá tus datos e intentá nuevamente.";

const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LoginForm() {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const response = await authClient.signIn.email({
      email,
      password,
      rememberMe: false,
    });

    if (response.error) {
      setError(genericError);
      setIsSubmitting(false);
      return;
    }

    router.replace("/app");
    router.refresh();
  }

  return (
    <form
      className={styles.form}
      method="post"
      onSubmit={handleSubmit}
      noValidate
    >
      <Field label="Email" required>
        <Input
          className={styles.input}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          disabled={isSubmitting}
        />
      </Field>

      <Field label="Contraseña" required>
        <PasswordInput
          className={styles.input}
          id="password"
          name="password"
          autoComplete="current-password"
          minLength={12}
          required
          disabled={isSubmitting}
        />
      </Field>

      {error ? (
        <Alert intent="danger" title="No pudimos ingresar">
          {error}
        </Alert>
      ) : null}

      <Button
        className={styles.submit}
        loading={isSubmitting}
        type="submit"
        disabled={!isHydrated || isSubmitting}
      >
        {isSubmitting ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
