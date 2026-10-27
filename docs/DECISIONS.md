# Ferraro Manager — Decision Log

Este archivo registra únicamente desviaciones o decisiones estructurales posteriores al Master Plan. No reemplaza a [`FERRARO_MASTER_PLAN.md`](./FERRARO_MASTER_PLAN.md); lo complementa y debe leerse junto con él.

## DEC-001 — Better Auth para credenciales y sesiones persistidas

- **Fecha:** 2026-10-02
- **Estado:** aceptada
- **Build afectado:** BUILD 0 — Foundation

### Contexto

El Master Plan exige usuarios provisionados, signup público cerrado, contraseña Argon2id y sesiones opacas almacenadas en PostgreSQL. La opción inicialmente indicada, Auth.js con Credentials, no persiste usuarios de credenciales y limita ese proveedor a sesiones JWT. Esto contradice el requisito de sesión de base.

### Decisión

Usar Better Auth con adaptador Prisma/PostgreSQL, email y contraseña, signup deshabilitado, hashing Argon2id configurable y sesiones persistidas en base. Los únicos roles de producto siguen siendo `ADMIN` y `STAFF`; toda autorización continúa validándose en servidor.

### Alternativas consideradas

- **Auth.js Credentials + JWT:** descartada porque incumple la fuente de verdad de sesiones persistidas.
- **Auth propia completa:** descartada por aumentar superficie de seguridad y mantenimiento.
- **Proveedor administrado:** válido, pero innecesario para dos roles internos y agrega dependencia operativa/costo.

### Consecuencias

- Se agregan las tablas técnicas requeridas por Better Auth (`Session`, `Account`, `Verification` y `RateLimit`).
- El bootstrap de usuarios continúa siendo interno, idempotente y sin signup público.
- No cambia el modelo de dominio, los permisos, el alcance ni la experiencia definida por el Master Plan.
- Un cambio futuro de proveedor deberá preservar estos contratos y registrarse aquí.

## DEC-002 — Storage privado S3-compatible con procesamiento server-side

- **Fecha:** 2026-10-03
- **Estado:** aceptada
- **Build afectado:** BUILD 10 — Photos

### Contexto

Las fotos de trabajos contienen información privada y deben admitir carga directa, variantes livianas y una futura publicación selectiva en el portal. Guardarlas en PostgreSQL o hacer público el bucket rompería el contrato de privacidad y complicaría el escalado.

### Decisión

Usar un adapter de storage privado: filesystem sólo en desarrollo/test y S3-compatible en preview/producción. El navegador recibe una URL de carga corta ligada a un intent de un solo uso; el servidor valida firma real, tamaño y MIME con Sharp, aplica orientación y genera preview/thumbnail sin metadata EXIF. Los objetos nunca son públicos: backoffice y portal los sirven mediante endpoints autorizados específicos.

### Alternativas consideradas

- **Vercel Blob público:** descartado porque no ofrece el aislamiento privado requerido como default.
- **Uploads pasando siempre por Next.js:** válido para local, pero descartado en producción por límites de payload, memoria y duración.
- **Blobs en PostgreSQL:** descartado por costo de backups, rendimiento y acoplamiento.

### Consecuencias

- Se agregan AWS SDK S3/Presigned Post y Sharp como dependencias estructurales. La política del POST prefirmado exige el MIME y tamaño declarados antes de aceptar el objeto; la firma real vuelve a validarse al confirmar.
- Producción requiere bucket privado, credenciales limitadas y CORS para `POST` desde el origen permitido.
- Los borrados de usuario son lógicos para conservar trazabilidad. El mantenimiento sólo purga uploads nunca confirmados después de 24 horas; una futura purga de fotos borradas requerirá una política de retención explícita.
- El proveedor puede cambiar sin modificar el dominio mientras conserve el contrato S3-compatible.

## DEC-003 — Inter Variable y tokens semánticos nativos

- **Fecha:** 2026-10-10
- **Estado:** aceptada
- **Build afectado:** FRONTEND BUILD FE-01 — Foundations y tokens

### Contexto

La UI heredada dependía de Avenir instalada en el sistema, valores visuales globales sin semántica y una hoja de estilos monolítica. El rediseño necesita render estable entre plataformas, contraste verificable y separación estricta entre marca, interacción y estados.

### Decisión

Usar Inter Variable 5.3.0 con subset latino, archivos WOFF2 locales y `next/font/local`. La comparación directa contra IBM Plex Sans 5.3.0 en titulares, texto operativo, montos y tabla densa no mostró una mejora clara que justificara cambiar la primera opción: Inter conservó una fila un píxel más compacta, lectura neutra y cifras estables.

Centralizar color, tipografía, spacing, geometría, layout, motion y z-index en `src/design-system/tokens.css`, ordenados mediante cascade layers. Los colores oficiales permanecen inmutables; interacción y estados usan familias semánticas propias. Los aliases heredados se mantienen temporalmente sólo para evitar una migración global accidental y se eliminarán en FE-14.

### Consecuencias

- La familia queda autocontenida, con licencia OFL versionada, sin dependencia de red ni FOIT por proveedor externo.
- El wordmark continúa siendo el SVG oficial y nunca se reconstruye con Inter.
- Los nuevos componentes no pueden consumir aliases heredados ni agregar hex fuera del archivo de tokens, salvo texto documental que exhiba el valor oficial.
- PPF House puede sustituir fuente y tokens sin modificar primitives ni lógica de dominio.

## DEC-004 — React Aria Components y Phosphor como infraestructura visual

- **Fecha:** 2026-10-10
- **Estado:** aceptada
- **Build afectado:** FRONTEND BUILD FE-02 — Componentes base y design system

### Contexto

Dialog, drawer, tooltip y confirmación requieren focus trap, Escape, retorno de foco, scroll/modal semantics y comportamiento consistente con teclado/touch. Implementar esos contratos a mano ampliaría la superficie de errores. La iconografía debe ser única, tree-shakeable, legible y con variantes de peso suficientes para navegación y estado.

### Decisión

Usar React Aria Components 1.22.1 como capa headless para overlays, conservando inputs, selects, textareas, checkbox y botones simples como controles nativos. Reemplazar el `window.confirm` del componente compartido por `ConfirmDialog`, con cancelación enfocada por defecto y consecuencia explícita. La confirmación específica del portal migra junto a ese módulo en FE-12.

Adoptar Phosphor Icons 2.1.10 como única librería de iconos, con imports individuales: `dist/ssr` para Server Components y el entrypoint normal sólo dentro de boundaries cliente. La comparación con Lucide 1.54.0 mostró que ambas opciones soportan tree shaking y SSR; Phosphor ofrece pesos más útiles para distinguir navegación/estado sin mezclar estilos. El chunk cliente que contiene el set real del showcase quedó en 28.770 bytes sin comprimir, por lo que no apareció el riesgo de bundle que justificaría cambiar a Lucide.

### Consecuencias

- Los primitives no contienen copy de Ferraro, rutas de dominio ni colores de marca.
- Overlays mantienen foco, cierre por Escape/click exterior y retorno al disparador por contratos probados de React Aria.
- `@axe-core/playwright` queda disponible para gates A/AA automatizados; no reemplaza teclado, zoom ni revisión manual.
- No se instala ni mezcla una segunda librería de iconos.

## DEC-005 — Shell responsive con navegación derivada del rol

- **Fecha:** 2026-10-10
- **Estado:** aceptada
- **Build afectado:** FRONTEND BUILD FE-03 — Shell, navegación e iconografía

### Contexto

El shell heredado usaba puntos genéricos, no marcaba la ruta activa, comprimía una sidebar intermedia y resolvía mobile con `<details>`. La nueva navegación debe conservar exactamente los destinos filtrados en servidor, funcionar sin JavaScript y evitar que la preferencia visual se confunda con autorización.

### Decisión

Mantener `getNavigationForRole` como única fuente de destinos y añadir allí sólo metadata presentacional (`group` e `icon`). El Server Component `AppShell` filtra por rol antes de pasar datos serializables a un `ShellFrame` cliente acotado. Desktop usa sidebar de 280 px, colapsable a 72 px; tablet fuerza el modo compacto por CSS; mobile usa header, drawer React Aria y cinco accesos rápidos.

La preferencia desktop se guarda por dispositivo en `localStorage` y se consume mediante `useSyncExternalStore`, con snapshot servidor expandido. Ruta activa, label accesible, tooltip/fallback `title`, breadcrumbs, skip link y enlaces reales sobreviven independientemente del estado visual.

### Consecuencias

- Colapsar la sidebar no cambia permisos, rutas ni HTML entregado según rol.
- ADMIN y STAFF comparten estructura, pero STAFF nunca recibe enlaces de finanzas, compras o administración.
- El drawer controla foco, Escape, scrim y retorno mediante React Aria; no se conserva el patrón `<details>`.
- Search backend y destinos permanecen intactos; sólo cambian composición, iconos y ergonomía.

## DEC-006 — Agenda propia server-first con layouts adaptativos

- **Fecha:** 2026-10-10
- **Estado:** aceptada
- **Build afectado:** FRONTEND BUILD FE-06 — Agenda

### Contexto

La agenda existente ya tenía queries por rango, reglas de solape/bloqueo, timezone y navegación por URL. Incorporar un calendar framework completo traería interacción DnD/resize, bundle y abstracciones que el alcance no necesita; conservar una semana de siete columnas comprimida tampoco cumple la lectura mobile.

### Decisión

Mantener el render server-first y las queries actuales. Día usa un layout temporal proporcional con asignación visual de carriles; semana conserva siete días con ancho mínimo y scroll/snap en tablet; mes genera seis semanas completas. En mobile, semana y mes presentan sólo el día seleccionado como lista/resumen. Un único input nativo cliente actualiza `view` y `date` en URL mediante una boundary mínima.

La página de turno sigue siendo la fuente de verdad. No se implementan drawer, DnD, resize, capacidad, recordatorios ni cambios de colisión.

### Consecuencias

- El algoritmo de carriles es puramente presentacional y no altera disponibilidad, consultas, timestamps ni estado.
- Los estados incluyen texto e icono además de color; bloqueo usa trama y label explícito.
- La continuidad multidía se recorta visualmente por jornada, pero conserva y anuncia el rango real.
- Una futura librería sólo se evalúa si aparece una necesidad funcional aprobada que el render actual no pueda resolver de forma accesible y mantenible.

## DEC-007 — Galería autorizada sin URLs persistentes en cliente

- **Fecha:** 2026-10-10
- **Estado:** aceptada con validación cloud pendiente
- **Build afectado:** FRONTEND BUILD FE-08 — Trabajos, consumos y fotografías

### Contexto

El módulo ya almacena objetos privados y sirve variantes mediante endpoints que verifican sesión/portal. El rediseño necesita lightbox, estados de visibilidad y controles de orden sin trasladar autorización al cliente ni revelar object keys o URLs firmadas persistentes.

### Decisión

Mantener intacto el flujo de intents, confirmación, procesamiento y endpoints privados. La galería recibe sólo metadata serializable autorizada por el Server Component y construye `thumbnail`/`preview` contra rutas internas. React Aria controla el lightbox y el servidor sigue resolviendo toda mutación mediante server actions existentes. La foto permanece privada por defecto y la publicación requiere una acción textual explícita.

### Consecuencias

- El HTML no contiene claves de storage ni URLs firmadas reutilizables.
- Abrir, ordenar, publicar, elegir portada o eliminar no modifica el contrato de privacidad existente.
- El lightbox hereda focus trap, Escape y retorno de foco; los botones mantienen nombres accesibles aun cuando el layout muestre sólo iconos.
- La implementación queda validada con filesystem local. No se declara persistencia remota completa hasta disponer de storage Preview aislado; producción no se usa como sustituto.

## DEC-008 — PDF comparte assets y tipografía de la interfaz

- **Fecha:** 2026-10-10
- **Estado:** aceptada
- **Build afectado:** FRONTEND BUILD FE-09 — Presupuestos y PDF

### Contexto

El renderer anterior escribía “FERRARO” con Helvetica y un tono dorado ajeno al núcleo digital. Eso reconstruía el logo con una fuente y separaba la propuesta impresa de la identidad aprobada.

### Decisión

Insertar en React PDF los paths exactos del lockup FERRARO DETAIL negro extraído del manual, sin autotrace ni rasterización. Usar Inter Variable TTF oficial embebida para el contenido, negro `#000000`, gris `#706F6F`, amarillo `#FFCE13` y papel blanco. Mantener el documento textual, A4, paginado y sin cambiar el contrato de artefacto congelado.

### Consecuencias

- Wordmark y DETAIL mantienen proporción/path oficial y no dependen de una fuente instalada.
- El TTF queda versionado junto a los WOFF2 de interfaz y documentado por checksum; no hay fetch en runtime.
- El PDF sigue siendo extraíble y buscable; sólo el lockup es geometría vectorial.
- El amarillo se limita a la regla institucional; grises y estructura sostienen impresión monocroma.

## DEC-009 — USD canónico, origen USD/ARS y costo directo opcional por caso

- **Fecha:** 2026-10-10
- **Estado:** aceptada
- **Build afectado:** Money + profitability

### Contexto

La operación necesita registrar importes originalmente recibidos en pesos sin cambiar la base común de saldos y comparaciones en Ferraro. El margen sólo es defendible cuando existe un costo directo efectivamente imputado.

### Decisión

USD permanece como moneda canónica. Los flujos monetarios editables admiten únicamente USD y ARS; la cotización se ingresa manualmente y siempre significa ARS por 1 USD. No hay proveedor de FX ni cotización automática. Se conserva el importe y moneda de origen y, para ARS, la cotización usada. Los registros históricos que sólo tenían USD se interpretan como USD: el backfill copia el valor USD existente a sus campos de origen cuando aplica y deja la cotización nula; no se inventan cotizaciones.

El costo directo opcional vive en `ServiceCase`, junto al importe acordado y sus revisiones, porque un caso puede reunir varios jobs y presupuesto/cobros. `directCostUsd = null` significa sin imputar; cero explícito significa costo conocido de cero. No se infiere desde movimientos de inventario ni se exige para continuar el flujo. Sólo ADMIN puede gestionarlo y ver costo/margen; STAFF y el portal no reciben esos datos.

El margen conocido requiere importe acordado y costo directo informado. Se permite margen negativo y margen cero. Para agregados se muestran margen conocido, casos con costo imputado y cobertura; cobertura parcial no se presenta como ganancia neta, rentabilidad total o resultado operativo. Flujo neto y margen son métricas distintas.

### Consecuencias

- `exchangeRateArsPerUsd` es positiva y representa ARS/USD; la conversión y el redondeo monetario ocurren server-side con Decimal.
- Presupuestos y compras usan una sola moneda de origen por documento; sus snapshots originales/cotización y montos USD canónicos coexisten.
- `FinancialEntry` mantiene amountUsd canónico y reversión compensatoria con semántica monetaria trazable.
- Migraciones aditivas preservan registros existentes; costo previo no se inventa ni se completa con cero.
- No se amplían permisos, módulos ni el ledger de inventario.

## DEC-010 — Invariante de procedencia para costo directo

- **Fecha:** 2026-10-10
- **Estado:** aceptada
- **Build afectado:** Cierre técnico Money + profitability

### Contexto

La primera migración de money + profitability ya distinguía el costo directo no imputado de un costo conocido y exigía la metadata básica de moneda. Faltaba reforzar en PostgreSQL la igualdad entre el costo USD y su origen cuando la carga nació en USD.

### Decisión

La migración incremental `20261010160000_direct_cost_consistency` reemplaza exclusivamente `service_cases_direct_cost_currency_check`. El estado sin costo sigue siendo las cuatro columnas `NULL`. Para USD, `directCostSourceAmount` debe ser igual a `directCostUsd` y la cotización debe ser `NULL`. Para ARS se requieren importe de origen, costo USD y cotización positiva. Los importes de costo canónico y de origen no pueden ser negativos; el cero explícito permanece válido.

### Consecuencias

- No hay backfill ni conversión de `NULL` a cero: la DB local existente no contenía costos directos que requirieran corrección.
- La aplicación mantiene su validación Decimal server-side y ahora la persistencia rechaza estados parciales, cotizaciones ausentes e importes negativos.
- La constraint es compatible con los registros históricos sin costo y no altera permisos, cálculos de margen ni el flujo operativo.

## DEC-011 — Gestión de usuarios por ADMIN con baja lógica

- **Fecha:** 2026-10-14
- **Estado:** aceptada
- **Build afectado:** ABM de usuarios

### Contexto

El alta de usuarios sólo era posible con `admin:bootstrap`, porque el signup público está deshabilitado. Hacía falta que un ADMIN pudiera crear, editar, desactivar y restablecer el acceso del equipo desde el backoffice. `User` es referenciado por decenas de columnas de auditoría, por lo que un borrado físico rompería integridad o perdería trazabilidad.

### Decisión

`/app/admin/users` (módulo `src/modules/users`) es exclusivo de ADMIN y valida rol en cada página y server action. La baja es lógica (`active = false`) y borra las sesiones del usuario en la misma transacción; el hook de creación de sesión ya impide nuevos ingresos. El ADMIN define la contraseña inicial y puede restablecerla (Argon2id, cuenta `credential` con `accountId = user.id`, igual que el bootstrap); el reset y los cambios de rol también cierran las sesiones abiertas. Un ADMIN no puede desactivarse ni quitarse el rol a sí mismo, y no se puede desactivar ni degradar al último ADMIN activo: el chequeo bloquea las filas ADMIN con `FOR UPDATE` dentro de la transacción.

### Consecuencias

- No hay migración: se reutilizan `role`, `active` y `lastLoginAt`.
- No hay envío de emails ni invitaciones; la contraseña se comparte por fuera del sistema.
- Un ADMIN que restablece su propia contraseña cierra su sesión y debe volver a ingresar.

## DEC-012 — Identidad editable sólo antes de historia comercial

- **Fecha:** 2026-10-16
- **Estado:** aceptada
- **Build afectado:** flujo cliente → vehículo

### Contexto

Crear turnos y presupuestos obligaba a navegar primero por Clientes, y la edición de turno bloqueaba siempre cliente/vehículo. Desbloquearla sin reglas permitiría reescribir la identidad de un `ServiceCase` que ya posee presupuesto, cobros, costos o trabajos históricos.

### Decisión

Agenda y Presupuestos comparten `ClientVehiclePicker`, con búsqueda server-side acotada y quick create transaccional. Clientes activos sin vehículo siguen siendo elegibles. Un alta se bloquea por teléfono normalizado o email case-insensitive ya existentes; una coincidencia de nombre sólo sugiere el registro porque los homónimos son válidos.

La reasignación de turno actualiza `ServiceCase.clientId` y `vehicleId` en transacción sólo si el caso tiene origen `DIRECT_APPOINTMENT`, exactamente una appointment y ninguna dependencia comercial o histórica: quote aceptado, job, movimiento financiero, importe acordado, costo directo o revisión económica. El servidor vuelve a comprobar elegibilidad, actividad y pertenencia vehículo→cliente al guardar.

### Consecuencias

- El usuario resuelve cliente y garage sin salir ni perder fecha, servicios, líneas o importes del formulario.
- Un caso con historia muestra identidad fija y una explicación; para otra identidad corresponde cancelar y crear un turno nuevo según la operación.
- No hay migración ni constraint por nombre. Las reglas existentes de descuentos, Decimal, permisos e idempotencia no cambian.

## DEC-013 — Turnos con detalle de consulta y alta mínima

- **Fecha:** 2026-10-19
- **Estado:** aceptada

Guardar un turno abre su detalle de consulta, con confirmación explícita; editar requiere entrar a `/app/calendar/[appointmentId]/edit`. Se conservan los controles de estado e identidad de DEC-012. El alta desde presupuesto aceptado tiene el mismo destino.

El alta rápida compartida pide nombre, teléfono opcional y marca/modelo, con un vehículo inicial y opción secundaria de agregar otro. Los formularios de vehículos sólo muestran marca/modelo; los atributos omitidos se preservan en registros existentes y no se elimina ninguna columna.

La emisión de presupuestos maneja errores dentro de su detalle y bloquea el botón mientras procesa. El runtime de Vercel exige almacenamiento S3 privado: los logs productivos mostraron que escribir en `/var/task/.data` impedía guardar el PDF. Se reutiliza el bucket `ferraro-private` de Railway; no se agrega infraestructura ni una migración.

## DEC-2026-10-19 — Borrado definitivo de registros por ADMIN

- **Estado:** aceptada por el cliente
- **Alcance:** clientes, vehículos, turnos, bloqueos, servicios y variantes, categorías, presupuestos, casos comerciales, trabajos, consumos y fotos, proveedores, compras, inventario y movimientos financieros.

El usuario pidió expresamente borrado físico y eligió bloquearlo cuando existen registros asociados. Esta decisión reemplaza la restricción anterior de sólo archivar/anular para estos módulos; las cuentas del equipo conservan su política de desactivación.

`/app/admin/records` permite buscar también registros archivados/anulados. Los detalles principales enlazan al registro a eliminar. Cada operación exige confirmación irreversible y valida ADMIN activo tanto en la server action como dentro de la transacción. Las dependencias se muestran con enlaces para eliminarlas primero. No hay borrado en cadena de clientes, vehículos, turnos o trabajos.

Se consideran partes propias los ítems de presupuesto/compra, asignaciones, variantes, revisiones comerciales, enlaces de portal y fotos/archivos del trabajo. Las compras y consumos se eliminan junto con sus asientos y reversiones, recalculando stock con Decimal y bloqueo de filas; se rechaza una salida neta que empeore stock negativo. Un movimiento de compra/consumo sólo se elimina mediante su operación de origen. Las reversiones manuales deben eliminarse antes del asiento original. Eliminar un trabajo reabre su turno completado; eliminar un caso sin dependencias devuelve su presupuesto aceptado al estado emitido.

Los archivos privados se encolan en `pending_storage_deletions` dentro de la misma transacción. Se intenta borrarlos al terminar y `pnpm storage:cleanup` reintenta pendientes; una caída de storage no revierte ni oculta un borrado físico exitoso. Se invalidan referencias de resultados idempotentes eliminados, conservando la protección contra reejecuciones.

## Sueldos recurrentes (2026-10-20)

Los sueldos se administran exclusivamente por ADMIN en Finanzas → Sueldos, con personas independientes de los usuarios. La recurrencia mantiene el importe en ARS y crea una obligación independiente por mes. Las excepciones mensuales y los cambios permanentes conservan el historial; los meses pagados no se reescriben. La baja de recurrencia no elimina deudas.

El pago completo crea atómicamente un egreso `SALARY_PAYMENT`, normalizado a USD con cotización manual de la fecha efectiva, y marca la obligación pagada. Revertir desde cualquier entrada financiera vuelve a abrir la obligación en la misma transacción. Los pendientes se informan en ARS y no afectan caja hasta pagarse. El margen conocido sigue siendo una métrica por caso, sin imputación automática de sueldos. La generación bajo demanda recupera meses omitidos sin cron. Ver [operación y contratos](SALARIES.md).

## Sueldos denominados en USD (2026-10-21)

Por indicación del cliente, la moneda de todo el módulo de sueldos pasa a USD: los empleados cobran en dólares. Esta decisión reemplaza el contrato ARS del 2026-10-20 para sueldos. Los pagos no solicitan cotización y su importe de origen coincide con el USD del egreso; los pendientes se agregan directamente en USD. Se verificó producción sin registros de sueldos antes de la migración, que además bloquea una reinterpretación accidental si se detectan registros existentes. Las demás operaciones financieras siguen admitiendo USD/ARS.
