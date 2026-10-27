"use client";

import {
  CheckIcon,
  CaretDownIcon,
  PlusIcon,
  SpinnerGapIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Button as AriaButton,
  ComboBox,
  Dialog,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
} from "react-aria-components";

import {
  quickCreateClientAction,
  quickCreateVehicleAction,
  searchClientsAction,
  searchVehiclesAction,
  type QuickClientInput,
  type QuickClientResult,
  type QuickVehicleResult,
} from "@/modules/clients/application/picker-actions";
import type {
  ClientPickerOption,
  VehiclePickerOption,
} from "@/modules/clients/application/client-service";
import { vehicleLabel } from "@/modules/clients/domain/client-vehicle-flow";

import styles from "./client-vehicle-picker.module.css";

type QuickMode = "client" | "vehicle" | null;

interface VehicleDraft {
  key: string;
}

interface ClientVehiclePickerProps {
  initialClients: ClientPickerOption[];
  initialClientId?: string;
  initialVehicles?: VehiclePickerOption[];
  initialVehicleId?: string;
}

function ErrorText({ children }: { children?: ReactNode }) {
  return children ? (
    <small className={styles.fieldError} role="alert">
      {children}
    </small>
  ) : null;
}

function fieldValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function VehicleFields({
  errors,
  prefix,
}: {
  errors?: Record<string, string>;
  prefix: string;
}) {
  return (
    <div className={styles.quickGrid}>
      <label className={styles.quickField}>
        <span>Marca *</span>
        <input
          aria-invalid={Boolean(errors?.[`${prefix}.brand`]) || undefined}
          autoComplete="off"
          maxLength={80}
          name={`${prefix}.brand`}
          required
        />
        <ErrorText>{errors?.[`${prefix}.brand`]}</ErrorText>
      </label>
      <label className={styles.quickField}>
        <span>Modelo *</span>
        <input
          aria-invalid={Boolean(errors?.[`${prefix}.model`]) || undefined}
          autoComplete="off"
          maxLength={80}
          name={`${prefix}.model`}
          required
        />
        <ErrorText>{errors?.[`${prefix}.model`]}</ErrorText>
      </label>
    </div>
  );
}

export function ClientVehiclePicker({
  initialClients,
  initialClientId,
  initialVehicles = [],
  initialVehicleId,
}: ClientVehiclePickerProps) {
  const initialClient = initialClients.find(
    (client) => client.id === initialClientId,
  );
  const initialVehicle = initialVehicles.find(
    (vehicle) => vehicle.id === initialVehicleId,
  );
  const [clients, setClients] = useState(initialClients);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [clientInput, setClientInput] = useState(
    initialClient?.displayName ?? "",
  );
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState("");
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [vehicleInput, setVehicleInput] = useState(
    initialVehicle ? vehicleLabel(initialVehicle) : "",
  );
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleError, setVehicleError] = useState("");
  const [quickMode, setQuickMode] = useState<QuickMode>(null);
  const [quickClientResult, setQuickClientResult] =
    useState<QuickClientResult | null>(null);
  const [quickVehicleResult, setQuickVehicleResult] =
    useState<QuickVehicleResult | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const vehicleCounter = useRef(1);
  const [vehicleDrafts, setVehicleDrafts] = useState<VehicleDraft[]>([
    { key: "vehicle-0" },
  ]);

  function openQuickCreate(mode: Exclude<QuickMode, null>) {
    setQuickMode(mode);
  }

  useEffect(() => {
    if (
      quickClientResult?.status !== "error" &&
      quickVehicleResult?.status !== "error"
    )
      return;
    window.requestAnimationFrame(() => {
      modalRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
    });
  }, [quickClientResult, quickVehicleResult]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setClientLoading(true);
      const result = await searchClientsAction({
        query: clientInput,
        selectedId: clientId || undefined,
      });
      if (cancelled) return;
      setClientLoading(false);
      if (result.status === "error") {
        setClientError(result.message);
        return;
      }
      setClientError("");
      setClients(result.items);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [clientId, clientInput]);

  useEffect(() => {
    if (!clientId) {
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setVehicleLoading(true);
      const result = await searchVehiclesAction({
        clientId,
        query: vehicleInput,
        selectedId: vehicleId || undefined,
      });
      if (cancelled) return;
      setVehicleLoading(false);
      if (result.status === "error") {
        setVehicleError(result.message);
        return;
      }
      setVehicleError("");
      setVehicles(result.items);
      if (!vehicleId && !vehicleInput && result.items.length === 1) {
        const onlyVehicle = result.items[0];
        if (onlyVehicle) {
          setVehicleId(onlyVehicle.id);
          setVehicleInput(vehicleLabel(onlyVehicle));
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [clientId, vehicleId, vehicleInput]);

  function selectClient(nextId: string, option?: ClientPickerOption) {
    const client = option ?? clients.find((item) => item.id === nextId);
    if (!client) return;
    setClients((current) => [
      client,
      ...current.filter((item) => item.id !== client.id),
    ]);
    setClientId(client.id);
    setClientInput(client.displayName);
    setVehicleId("");
    setVehicleInput("");
    setVehicles([]);
    setVehicleLoading(true);
  }

  async function selectDuplicateClient(id: string) {
    const result = await searchClientsAction({ selectedId: id });
    if (result.status === "success") {
      const client = result.items.find((item) => item.id === id);
      if (client) {
        selectClient(id, client);
        setQuickMode(null);
        setQuickClientResult(null);
      }
    }
  }

  function resetQuickCreate() {
    setQuickClientResult(null);
    setQuickVehicleResult(null);
    setVehicleDrafts([{ key: `vehicle-${vehicleCounter.current++}` }]);
  }

  async function submitQuickClient(
    event: FormEvent<HTMLFormElement>,
    allowNameSuggestion = false,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const client: QuickClientInput["client"] = {
      displayName: fieldValue(formData, "client.displayName"),
      phone: fieldValue(formData, "client.phone"),
    };
    const quickVehicles = vehicleDrafts.map((_, index) => ({
      brand: fieldValue(formData, `vehicles.${index}.brand`),
      model: fieldValue(formData, `vehicles.${index}.model`),
    }));
    setQuickSaving(true);
    const result = await quickCreateClientAction({
      client,
      vehicles: quickVehicles,
      allowNameSuggestion,
    });
    setQuickSaving(false);
    setQuickClientResult(result);
    if (result.status === "success") {
      setClients((current) => [
        result.client,
        ...current.filter((item) => item.id !== result.client.id),
      ]);
      setClientId(result.client.id);
      setClientInput(result.client.displayName);
      setVehicles(result.vehicles);
      const firstVehicle = result.vehicles[0];
      setVehicleId(firstVehicle?.id ?? "");
      setVehicleInput(firstVehicle ? vehicleLabel(firstVehicle) : "");
      setQuickMode(null);
      resetQuickCreate();
    }
  }

  async function submitQuickVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId) return;
    const formData = new FormData(event.currentTarget);
    setQuickSaving(true);
    const result = await quickCreateVehicleAction({
      clientId,
      vehicle: {
        brand: fieldValue(formData, "vehicle.brand"),
        model: fieldValue(formData, "vehicle.model"),
      },
    });
    setQuickSaving(false);
    setQuickVehicleResult(result);
    if (result.status === "success") {
      setVehicles((current) => [
        result.vehicle,
        ...current.filter((item) => item.id !== result.vehicle.id),
      ]);
      setVehicleId(result.vehicle.id);
      setVehicleInput(vehicleLabel(result.vehicle));
      setQuickMode(null);
      setQuickVehicleResult(null);
    }
  }

  const clientFields =
    quickClientResult?.status === "error"
      ? quickClientResult.fields
      : undefined;
  const vehicleFields =
    quickVehicleResult?.status === "error"
      ? quickVehicleResult.fields
      : undefined;

  return (
    <div className={styles.picker}>
      <input name="clientId" type="hidden" value={clientId} />
      <input name="vehicleId" type="hidden" value={vehicleId} />
      <div className={styles.pickerField}>
        <ComboBox
          allowsCustomValue={false}
          inputValue={clientInput}
          menuTrigger="input"
          onInputChange={(value) => {
            setClientInput(value);
            setClientLoading(true);
            const selected = clients.find((client) => client.id === clientId);
            if (selected && value !== selected.displayName) {
              setClientId("");
              setVehicleId("");
              setVehicleInput("");
              setVehicles([]);
            }
          }}
          onSelectionChange={(key) => {
            if (key) selectClient(String(key));
          }}
          selectedKey={clientId || null}
        >
          <Label>Cliente *</Label>
          <div className={styles.comboControl}>
            <Input
              aria-busy={clientLoading || undefined}
              aria-describedby={clientError ? "client-picker-error" : undefined}
              aria-invalid={Boolean(clientError) || undefined}
              placeholder="Buscar por nombre, teléfono o email"
              required
            />
            <AriaButton
              aria-label="Mostrar clientes"
              className={styles.comboButton}
            >
              {clientLoading ? (
                <SpinnerGapIcon aria-hidden className={styles.spinner} />
              ) : (
                <CaretDownIcon aria-hidden />
              )}
            </AriaButton>
          </div>
          {quickMode === null ? (
            <Popover className={styles.popover} placement="bottom start">
              <ListBox
                className={styles.listBox}
                items={clients}
                renderEmptyState={() => (
                  <div className={styles.emptyResult}>
                    No encontramos clientes con esa búsqueda.
                  </div>
                )}
              >
                {(client) => (
                  <ListBoxItem
                    className={styles.option}
                    id={client.id}
                    textValue={client.displayName}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>
                          <strong>{client.displayName}</strong>
                          <small>
                            {[client.phone, client.email]
                              .filter(Boolean)
                              .join(" · ") ||
                              (client.vehicleCount
                                ? `${client.vehicleCount} vehículo(s)`
                                : "Sin vehículos")}
                          </small>
                        </span>
                        {isSelected ? (
                          <CheckIcon aria-hidden weight="bold" />
                        ) : null}
                      </>
                    )}
                  </ListBoxItem>
                )}
              </ListBox>
              <AriaButton
                className={styles.createOption}
                onPress={() => {
                  resetQuickCreate();
                  openQuickCreate("client");
                }}
              >
                <PlusIcon aria-hidden />
                {clientInput.trim()
                  ? `Crear “${clientInput.trim()}”`
                  : "Crear nuevo cliente"}
              </AriaButton>
            </Popover>
          ) : null}
        </ComboBox>
        <button
          className={styles.inlineCreateClient}
          onClick={() => {
            resetQuickCreate();
            openQuickCreate("client");
          }}
          type="button"
        >
          <PlusIcon aria-hidden />
          Nuevo cliente + vehículo
        </button>
        {clientError ? (
          <small
            className={styles.fieldError}
            id="client-picker-error"
            role="alert"
          >
            {clientError}
          </small>
        ) : null}
      </div>

      <div className={styles.pickerField}>
        <ComboBox
          allowsCustomValue={false}
          inputValue={vehicleInput}
          isDisabled={!clientId}
          menuTrigger="input"
          onInputChange={(value) => {
            setVehicleInput(value);
            setVehicleLoading(true);
            const selected = vehicles.find(
              (vehicle) => vehicle.id === vehicleId,
            );
            if (selected && value !== vehicleLabel(selected)) setVehicleId("");
          }}
          onSelectionChange={(key) => {
            if (!key) return;
            const vehicle = vehicles.find((item) => item.id === String(key));
            if (vehicle) {
              setVehicleId(vehicle.id);
              setVehicleInput(vehicleLabel(vehicle));
            }
          }}
          selectedKey={vehicleId || null}
        >
          <Label>Vehículo *</Label>
          <div className={styles.comboControl}>
            <Input
              aria-busy={vehicleLoading || undefined}
              aria-describedby={
                vehicleError ? "vehicle-picker-error" : undefined
              }
              aria-invalid={Boolean(vehicleError) || undefined}
              placeholder={
                clientId
                  ? "Buscar por marca, modelo, versión o año"
                  : "Primero seleccioná un cliente"
              }
              required
            />
            <AriaButton
              aria-label="Mostrar vehículos"
              className={styles.comboButton}
            >
              {vehicleLoading ? (
                <SpinnerGapIcon aria-hidden className={styles.spinner} />
              ) : (
                <CaretDownIcon aria-hidden />
              )}
            </AriaButton>
          </div>
          {quickMode === null ? (
            <Popover className={styles.popover} placement="bottom start">
              <ListBox
                className={styles.listBox}
                items={vehicles}
                renderEmptyState={() => (
                  <div className={styles.emptyResult}>
                    Este cliente todavía no tiene vehículos que coincidan.
                  </div>
                )}
              >
                {(vehicle) => (
                  <ListBoxItem
                    className={styles.option}
                    id={vehicle.id}
                    textValue={vehicleLabel(vehicle)}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>
                          <strong>
                            {vehicle.brand} {vehicle.model}
                          </strong>
                          <small>
                            {[vehicle.version, vehicle.year, vehicle.color]
                              .filter(Boolean)
                              .join(" · ") || "Sin más datos"}
                          </small>
                        </span>
                        {isSelected ? (
                          <CheckIcon aria-hidden weight="bold" />
                        ) : null}
                      </>
                    )}
                  </ListBoxItem>
                )}
              </ListBox>
              <AriaButton
                className={styles.createOption}
                onPress={() => {
                  setQuickVehicleResult(null);
                  openQuickCreate("vehicle");
                }}
              >
                <PlusIcon aria-hidden /> Agregar vehículo
              </AriaButton>
            </Popover>
          ) : null}
        </ComboBox>
        {vehicleError ? (
          <small
            className={styles.fieldError}
            id="vehicle-picker-error"
            role="alert"
          >
            {vehicleError}
          </small>
        ) : null}
        {clientId && !vehicleLoading && vehicles.length === 0 ? (
          <div className={styles.noVehicles} role="status">
            <span>Este cliente todavía no tiene vehículos.</span>
            <button
              className={styles.inlineAction}
              onClick={() => openQuickCreate("vehicle")}
              type="button"
            >
              Agregar vehículo
            </button>
          </div>
        ) : null}
      </div>

      <ModalOverlay
        className={styles.overlay}
        isDismissable={!quickSaving}
        isOpen={quickMode !== null}
        onOpenChange={(open) => {
          if (!open && !quickSaving) {
            setQuickMode(null);
            resetQuickCreate();
          }
        }}
      >
        <Modal className={styles.modal} ref={modalRef}>
          <Dialog className={styles.dialog}>
            {({ close }) =>
              quickMode === "client" ? (
                <form
                  className={styles.quickForm}
                  onSubmit={(event) => void submitQuickClient(event)}
                >
                  <header>
                    <Heading slot="title">Crear cliente y vehículos</Heading>
                    <p>
                      Completá lo mínimo para seguir sin salir del formulario.
                    </p>
                  </header>
                  {quickClientResult?.status === "error" ? (
                    <p className={styles.formError} role="alert">
                      {quickClientResult.message}
                    </p>
                  ) : null}
                  <section className={styles.quickSection}>
                    <h3>Cliente</h3>
                    <div className={styles.quickGrid}>
                      <label
                        className={`${styles.quickField} ${styles.spanTwo}`}
                      >
                        <span>Nombre *</span>
                        <input
                          aria-invalid={
                            Boolean(clientFields?.["client.displayName"]) ||
                            undefined
                          }
                          autoFocus
                          defaultValue={clientId ? "" : clientInput}
                          maxLength={120}
                          name="client.displayName"
                          required
                        />
                        <ErrorText>
                          {clientFields?.["client.displayName"]}
                        </ErrorText>
                      </label>
                      <label className={styles.quickField}>
                        <span>Teléfono</span>
                        <input
                          autoComplete="tel"
                          inputMode="tel"
                          maxLength={40}
                          name="client.phone"
                        />
                      </label>
                    </div>
                  </section>

                  {quickClientResult?.status === "duplicate" ? (
                    <section className={styles.duplicates} aria-live="polite">
                      <h3>{quickClientResult.message}</h3>
                      <p>
                        {quickClientResult.blocking
                          ? "Para evitar duplicados, usá el registro existente."
                          : "Podés usar uno de estos clientes o crear el homónimo igualmente."}
                      </p>
                      {quickClientResult.matches.map((match) => (
                        <article key={match.id}>
                          <span>
                            <strong>{match.displayName}</strong>
                            <small>
                              {[match.phone, match.email]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </span>
                          {match.active ? (
                            <button
                              onClick={() =>
                                void selectDuplicateClient(match.id)
                              }
                              type="button"
                            >
                              Usar este cliente
                            </button>
                          ) : (
                            <small>Cliente archivado</small>
                          )}
                        </article>
                      ))}
                    </section>
                  ) : null}

                  <section className={styles.quickSection}>
                    <div className={styles.sectionTitle}>
                      <div>
                        <h3>Vehículos</h3>
                        <p>
                          Agregá uno o varios; el primero quedará seleccionado.
                        </p>
                      </div>
                      <button
                        className={styles.secondaryButton}
                        onClick={() =>
                          setVehicleDrafts((current) => [
                            ...current,
                            { key: `vehicle-${vehicleCounter.current++}` },
                          ])
                        }
                        type="button"
                      >
                        <PlusIcon aria-hidden /> Agregar otro
                      </button>
                    </div>
                    <ErrorText>{clientFields?.vehicles}</ErrorText>
                    <div className={styles.vehicleDrafts}>
                      {vehicleDrafts.map((draft, index) => (
                        <fieldset key={draft.key}>
                          <legend>Vehículo {index + 1}</legend>
                          {vehicleDrafts.length > 1 ? (
                            <button
                              aria-label={`Quitar vehículo ${index + 1}`}
                              className={styles.removeVehicle}
                              onClick={() =>
                                setVehicleDrafts((current) =>
                                  current.filter(
                                    (item) => item.key !== draft.key,
                                  ),
                                )
                              }
                              type="button"
                            >
                              <TrashIcon aria-hidden />
                            </button>
                          ) : null}
                          <VehicleFields
                            errors={clientFields}
                            prefix={`vehicles.${index}`}
                          />
                        </fieldset>
                      ))}
                    </div>
                  </section>
                  <footer className={styles.dialogActions}>
                    <button
                      className={styles.secondaryButton}
                      disabled={quickSaving}
                      onClick={close}
                      type="button"
                    >
                      Cancelar
                    </button>
                    {quickClientResult?.status === "duplicate" &&
                    !quickClientResult.blocking ? (
                      <button
                        className={styles.primaryButton}
                        disabled={quickSaving}
                        onClick={(event) => {
                          const form = event.currentTarget.form;
                          if (form)
                            void submitQuickClient(
                              {
                                preventDefault() {},
                                currentTarget: form,
                              } as FormEvent<HTMLFormElement>,
                              true,
                            );
                        }}
                        type="button"
                      >
                        Crear igualmente
                      </button>
                    ) : (
                      <button
                        className={styles.primaryButton}
                        disabled={quickSaving}
                        type="submit"
                      >
                        {quickSaving ? "Creando…" : "Crear y continuar"}
                      </button>
                    )}
                  </footer>
                </form>
              ) : (
                <form
                  className={styles.quickForm}
                  onSubmit={(event) => void submitQuickVehicle(event)}
                >
                  <header>
                    <Heading slot="title">Agregar vehículo</Heading>
                    <p>
                      Se agregará a{" "}
                      {
                        clients.find((item) => item.id === clientId)
                          ?.displayName
                      }
                      .
                    </p>
                  </header>
                  {quickVehicleResult?.status === "error" ? (
                    <p className={styles.formError} role="alert">
                      {quickVehicleResult.message}
                    </p>
                  ) : null}
                  <VehicleFields errors={vehicleFields} prefix="vehicle" />
                  <footer className={styles.dialogActions}>
                    <button
                      className={styles.secondaryButton}
                      disabled={quickSaving}
                      onClick={close}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button
                      className={styles.primaryButton}
                      disabled={quickSaving}
                      type="submit"
                    >
                      {quickSaving ? "Guardando…" : "Agregar y seleccionar"}
                    </button>
                  </footer>
                </form>
              )
            }
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}
