"use client";

import { useActionState, useState } from "react";

import { FormActions, FormGrid, FormSection } from "@/components/patterns/page";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  createCategoryAction,
  createVariantAction,
  saveServiceAction,
  type CatalogFormState,
} from "@/modules/services/application/actions";

import styles from "./services.module.css";

const initialState: CatalogFormState = { status: "idle" };

function ErrorMessage({ state }: { state: CatalogFormState }) {
  return state.message ? (
    <p className={styles.formError} role="alert">
      {state.message}
    </p>
  ) : null;
}

export function CategoryForm() {
  const [state, action, pending] = useActionState(
    createCategoryAction,
    initialState,
  );
  return (
    <form action={action} className={styles.categoryForm}>
      <Field label="Nueva categoría" required>
        <Input name="name" placeholder="Ej. Protección" required />
      </Field>
      <input name="sortOrder" type="hidden" value="0" />
      <Button loading={pending} type="submit" variant="secondary">
        Agregar
      </Button>
      {state.message ? (
        <div className={styles.categoryError}>
          <ErrorMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}

interface ServiceValues {
  id?: string;
  categoryId?: string;
  name?: string;
  internalDescription?: string | null;
  commercialDescription?: string | null;
  basePriceUsd?: string | null;
  estimatedDurationMinutes?: number | null;
  sortOrder?: number;
}

export function ServiceForm({
  categories,
  values = {},
}: {
  categories: { id: string; name: string }[];
  values?: ServiceValues;
}) {
  const [state, action, pending] = useActionState(
    saveServiceAction,
    initialState,
  );
  return (
    <form action={action} className={styles.form}>
      {values.id ? <input name="id" type="hidden" value={values.id} /> : null}
      <ErrorMessage state={state} />
      <FormSection
        description="Nombre y categoría para toda la operación."
        title="Servicio"
      >
        <FormGrid>
          <Field label="Categoría" required>
            <Select defaultValue={values.categoryId} name="categoryId" required>
              <option value="">Seleccionar</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nombre" required>
            <Input defaultValue={values.name} name="name" required />
          </Field>
          <Field label="Precio base USD" optional>
            <Input
              defaultValue={values.basePriceUsd ?? ""}
              inputMode="decimal"
              name="basePriceUsd"
              placeholder="A cotizar"
            />
          </Field>
          <Field label="Duración estimada (min)" optional>
            <Input
              defaultValue={values.estimatedDurationMinutes ?? ""}
              inputMode="numeric"
              name="estimatedDurationMinutes"
            />
          </Field>
          <Field label="Orden" optional>
            <Input
              defaultValue={values.sortOrder ?? 0}
              inputMode="numeric"
              name="sortOrder"
            />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection
        description="Una interna para el equipo y otra comercial para presupuestos."
        title="Descripciones"
      >
        <FormGrid>
          <Field
            className={styles.fieldSpan}
            label="Descripción interna"
            optional
          >
            <Textarea
              defaultValue={values.internalDescription ?? ""}
              name="internalDescription"
              rows={3}
            />
          </Field>
          <Field
            className={styles.fieldSpan}
            label="Descripción comercial"
            optional
          >
            <Textarea
              defaultValue={values.commercialDescription ?? ""}
              name="commercialDescription"
              rows={4}
            />
          </Field>
        </FormGrid>
      </FormSection>
      <FormActions>
        <Button loading={pending} size="lg" type="submit">
          {values.id ? "Guardar cambios" : "Crear servicio"}
        </Button>
      </FormActions>
    </form>
  );
}

export function VariantForm({ serviceId }: { serviceId: string }) {
  const [state, action, pending] = useActionState(
    createVariantAction,
    initialState,
  );
  const [type, setType] = useState<"VEHICLE_CLASS" | "MODEL_EXCEPTION">(
    "VEHICLE_CLASS",
  );

  return (
    <form action={action} className={styles.compactForm}>
      <input name="serviceId" type="hidden" value={serviceId} />
      <ErrorMessage state={state} />
      <FormGrid>
        <Field label="Tipo" required>
          <Select
            name="type"
            onChange={(event) => setType(event.target.value as typeof type)}
            value={type}
          >
            <option value="VEHICLE_CLASS">Segmento</option>
            <option value="MODEL_EXCEPTION">Marca/modelo exacto</option>
          </Select>
        </Field>
        <Field label="Etiqueta" required>
          <Input
            name="label"
            placeholder={
              type === "VEHICLE_CLASS" ? "Ej. SUV" : "Ej. Ford Raptor"
            }
            required
          />
        </Field>
        {type === "VEHICLE_CLASS" ? (
          <Field label="Segmento" required>
            <Select name="vehicleClass" required>
              <option value="">Seleccionar</option>
              <option value="SEDAN">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="PICKUP">Pickup</option>
              <option value="OTHER">Otro</option>
            </Select>
          </Field>
        ) : (
          <>
            <Field label="Marca exacta" required>
              <Input name="matchBrand" required />
            </Field>
            <Field label="Modelo exacto" required>
              <Input name="matchModel" required />
            </Field>
          </>
        )}
        <Field label="Precio USD" required>
          <Input inputMode="decimal" name="priceUsd" required />
        </Field>
        <Field label="Duración (min)" optional>
          <Input inputMode="numeric" name="estimatedDurationMinutes" />
        </Field>
        <Field label="Prioridad" optional>
          <Input defaultValue="0" inputMode="numeric" name="priority" />
        </Field>
      </FormGrid>
      <FormActions>
        <Button loading={pending} type="submit">
          Agregar variante
        </Button>
      </FormActions>
    </form>
  );
}
