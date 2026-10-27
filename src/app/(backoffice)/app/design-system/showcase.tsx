"use client";

import {
  FunnelIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Choice, Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  ConfirmDialog,
  Dialog,
  Drawer,
  IconButton,
} from "@/components/ui/overlays";
import { Alert, Badge } from "@/components/ui/status";
import { Toast, ToastRegion } from "@/components/ui/toast";

import styles from "./page.module.css";

export function ComponentShowcase() {
  const [confirmed, setConfirmed] = useState(false);
  const [showToast, setShowToast] = useState(false);

  return (
    <>
      <section className={styles.section} aria-labelledby="actions">
        <div className={styles.sectionHeader}>
          <p className={styles.label}>Acciones</p>
          <h2 id="actions">Jerarquía explícita</h2>
          <p>
            Los verbos visibles dominan; icon-only conserva nombre y tooltip.
          </p>
        </div>
        <div className={styles.actionGrid}>
          <Button leadingIcon={<PlusIcon aria-hidden="true" size={20} />}>
            Nuevo turno
          </Button>
          <Button variant="secondary">Acción secundaria</Button>
          <Button variant="ghost">Acción discreta</Button>
          <Button loading>Guardando</Button>
          <Button disabled>Indisponible</Button>
          <IconButton label="Editar registro" tooltip="Editar registro">
            <PencilSimpleIcon aria-hidden="true" size={20} />
          </IconButton>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="fields">
        <div className={styles.sectionHeader}>
          <p className={styles.label}>Formulario</p>
          <h2 id="fields">Labels y errores persistentes</h2>
        </div>
        <div className={styles.formShowcase}>
          <Field
            description="Patente o identificador interno."
            label="Vehículo"
            required
          >
            <Input placeholder="Porsche 911 Carrera" required />
          </Field>
          <Field label="Estado">
            <Select defaultValue="confirmed">
              <option value="confirmed">Confirmado</option>
              <option value="progress">En proceso</option>
            </Select>
          </Field>
          <Field error="Ingresá un monto mayor a cero." label="Monto">
            <Input defaultValue="0" inputMode="decimal" />
          </Field>
          <Field label="Nota interna" optional>
            <Textarea placeholder="Detalle útil para el equipo" />
          </Field>
          <Choice defaultChecked>Visible para el cliente</Choice>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="feedback">
        <div className={styles.sectionHeader}>
          <p className={styles.label}>Feedback</p>
          <h2 id="feedback">Estado con texto, forma e icono</h2>
        </div>
        <div className={styles.badgeRow}>
          <Badge withIcon>Neutral</Badge>
          <Badge intent="success" withIcon>
            Confirmado
          </Badge>
          <Badge intent="warning" withIcon>
            Requiere atención
          </Badge>
          <Badge intent="danger" withIcon>
            Sin stock
          </Badge>
          <Badge intent="info" withIcon>
            En revisión
          </Badge>
        </div>
        <div className={styles.feedbackGrid}>
          <Alert intent="success" title="Cambios guardados">
            El turno quedó actualizado y conserva su historial.
          </Alert>
          <Alert intent="danger" title="No se pudo guardar">
            Revisá los campos marcados e intentá nuevamente.
          </Alert>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="surfaces">
        <div className={styles.sectionHeader}>
          <p className={styles.label}>Superficies</p>
          <h2 id="surfaces">Agrupar sólo cuando aporta contexto</h2>
        </div>
        <div className={styles.cardGrid}>
          <Card>
            <strong>Card plana</strong>
            <p>Resumen acotado sobre una superficie clara.</p>
          </Card>
          <Card variant="raised">
            <strong>Card elevada</strong>
            <p>Elevación reservada para jerarquía funcional.</p>
          </Card>
          <EmptyState
            action={<Button size="sm">Crear registro</Button>}
            title="Todavía no hay registros"
          >
            Cuando agregues el primero, aparecerá en este espacio.
          </EmptyState>
        </div>
        <div aria-busy="true" className={styles.skeletonGroup}>
          <Skeleton height="1.25rem" width="38%" />
          <Skeleton height="4rem" />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="overlays">
        <div className={styles.sectionHeader}>
          <p className={styles.label}>Overlays</p>
          <h2 id="overlays">Foco y salida predecibles</h2>
          <p>
            Escape, click exterior y retorno de foco provienen de React Aria.
          </p>
        </div>
        <div className={styles.actionGrid}>
          <Dialog
            description="El contenido corto conserva contexto sin cambiar de ruta."
            title="Detalle rápido"
            triggerLabel="Abrir dialog"
          >
            <p>Turno confirmado para hoy a las 09:30.</p>
          </Dialog>
          <Drawer
            description="En mobile se convierte en bottom sheet."
            title="Filtros"
            triggerLabel="Abrir filtros"
          >
            <Choice defaultChecked>Mostrar confirmados</Choice>
            <Choice>Mostrar cancelados</Choice>
          </Drawer>
          <ConfirmDialog
            confirmLabel="Eliminar evidencia"
            description="Esta demostración no modifica datos, pero enseña una consecuencia concreta."
            onConfirm={() => setConfirmed(true)}
            title="¿Eliminar esta evidencia?"
            triggerLabel={
              <>
                <TrashIcon aria-hidden="true" size={20} />
                Acción sensible
              </>
            }
          />
          <IconButton label="Filtrar resultados" tooltip="Filtrar resultados">
            <FunnelIcon aria-hidden="true" size={20} />
          </IconButton>
          <Button variant="secondary" onClick={() => setShowToast(true)}>
            Mostrar notificación
          </Button>
        </div>
        {confirmed ? (
          <Alert intent="success" title="Acción confirmada">
            El ejemplo cerró el dialog y devolvió el foco al disparador.
          </Alert>
        ) : null}
        {showToast ? (
          <ToastRegion>
            <Toast
              onDismiss={() => setShowToast(false)}
              title="Cambios guardados"
            >
              El registro quedó actualizado correctamente.
            </Toast>
          </ToastRegion>
        ) : null}
      </section>
    </>
  );
}
