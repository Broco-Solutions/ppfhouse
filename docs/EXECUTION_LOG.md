# Ferraro Manager — Execution Log

Registro resumido de la ejecución autónoma de V1. El contrato funcional continúa en [`FERRARO_MASTER_PLAN.md`](./FERRARO_MASTER_PLAN.md).

## BUILD 0

- **Status:** COMPLETE
- **Commits:** `8f16bf2..7a1571e`
- **Tests:** unit, integración, E2E, lint, typecheck, format y build verdes; CI remota verde.
- **Migrations:** `20261002211623_foundation`
- **Decisions:** DEC-001 — Better Auth con sesiones persistidas.
- **Known issues:** ninguno bloqueante.

## BUILD 1

- **Status:** COMPLETE
- **Commits:** `91385ab` — `feat(clients): complete build 1 clients and vehicles`
- **Tests:** 10 unit, 5 integración y 4 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Revisión visual/a11y desktop 1440×900, tablet 820×1180 y mobile 390×844 sin overflow.
- **Migrations:** `20261002221400_clients_vehicles`; schema y migraciones sin drift.
- **Decisions:** ninguna.
- **Known issues:** ninguno.

## BUILD 2

- **Status:** COMPLETE
- **Commits:** `ebab05c` — `feat(services): complete build 2 service catalog`
- **Tests:** 13 unit, 7 integración y 5 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. ADMIN/STAFF y proyección sin precios verificados. Revisión visual/a11y desktop, tablet y mobile sin overflow.
- **Migrations:** `20261002223027_service_catalog`, `20261002223140_service_catalog_constraints`; schema y migraciones sin drift.
- **Decisions:** ninguna.
- **Known issues:** ninguno.

## BUILD 3

- **Status:** COMPLETE
- **Commits:** `b5e079c` — `feat(calendar): complete build 3 scheduling`
- **Tests:** 15 unit, 10 integración y 6 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Agenda y formularios revisados en desktop 1440 px, tablet 820 px y mobile 390 px sin overflow ni errores de consola.
- **Migrations:** `20261002224645_service_cases_calendar`, `20261002224830_calendar_constraints`; schema y migraciones sin drift.
- **Decisions:** calendario propio server-rendered para V1; DnD/resize diferidos hasta justificar una dependencia madura.
- **Known issues:** ninguno.

## BUILD 4

- **Status:** COMPLETE
- **Commits:** `9c4f5f9` — `feat(jobs): complete build 4 work history`
- **Tests:** 17 unit, 13 integración y 7 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Flujo turno→trabajo y carga directa verificados; desktop, tablet y mobile revisados sin overflow ni errores de consola.
- **Migrations:** `20261002230859_jobs`, `20261002231010_job_constraints`.
- **Decisions:** ninguna.
- **Known issues:** ninguno.

## BUILD 5

- **Status:** COMPLETE
- **Commits:** `c635ef0` — `feat(quotes): complete build 5 quotes and PDF`
- **Tests:** 20 unit, 14 integración y 9 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Presupuesto→PDF→aceptación→mismo `ServiceCase`→turno verificado. Lista/editor revisados en desktop 1440 px, tablet 768 px y mobile 390 px; PDF A4 inspeccionado visualmente en una página y cubierto en varias páginas por test.
- **Migrations:** `20261002234000_quotes`.
- **Decisions:** ninguna nueva; `@react-pdf/renderer` 4.9.0 y storage privado detrás de adapter ejecutan la arquitectura aprobada en el Master Plan.
- **Known issues:** ninguno.

## BUILD 6

- **Status:** COMPLETE
- **Commits:** `1caf1a0` — `feat(finance): complete build 6 deposits and balances`
- **Tests:** 24 unit, 18 integración y 11 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Señas, pagos parciales/completos, reversión compensatoria, importe acordado versionado y límites mensuales de Buenos Aires verificados. Revisión visual desktop 1440 px, tablet 768 px y mobile 390 px sin overflow.
- **Migrations:** `20261003000954_finance`; schema y migraciones sin drift.
- **Decisions:** ninguna nueva; `FinancialEntry` es el ledger único de caja y el saldo de `ServiceCase` permanece derivado, según el Master Plan.
- **Known issues:** ninguno.

## BUILD 7

- **Status:** COMPLETE
- **Commits:** `6a346e7` — `feat(inventory): complete build 7 stock ledger`
- **Tests:** 27 unit, 22 integración y 12 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Precisión decimal, idempotencia, deducciones concurrentes, compensaciones, conciliación y proyección STAFF sin costos verificadas. Revisión visual desktop 1280 px, tablet 768 px y mobile 390 px sin overflow.
- **Migrations:** `20261003003829_inventory_core`, `20261003003910_inventory_constraints`; schema y migraciones sin drift.
- **Decisions:** ninguna nueva; saldo agregado + ledger y factores explícitos ejecutan el Master Plan.
- **Known issues:** ninguno.

## BUILD 8

- **Status:** COMPLETE
- **Commits:** `e26f1b8` — `feat(purchases): complete build 8 atomic purchasing`
- **Tests:** 29 unit, 25 integración y 13 E2E verdes; lint sin warnings, typecheck, format, build, migraciones y diff verdes. Compra→snapshots→stock→egreso único, idempotencia, rollback y anulación compensatoria verificados. Revisión visual desktop 1280 px, tablet 768 px y mobile 390 px sin overflow.
- **Migrations:** `20261003010430_suppliers_purchases`; schema y migraciones sin drift.
- **Decisions:** ninguna nueva; V1 registra la compra como pagada al postear, según contrato.
- **Known issues:** ninguno.

## BUILD 9

- **Status:** COMPLETE
- **Commits:** `ab44ac0` — `feat(inventory): complete build 9 job consumptions`
- **Tests:** 31 unit, 29 integración y 14 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Consumo decimal, doble submit, stock insuficiente, concurrencia, corrección compensatoria y anulación de trabajo con restitución verificados. Revisión visual desktop 1280 px, tablet 768 px y mobile 390 px sin overflow.
- **Migrations:** `20261003013500_job_consumptions`; ledger conciliado después de altas, correcciones, concurrencia y anulaciones.
- **Decisions:** ninguna nueva; consumos y correcciones usan el ledger append-only definido en el Master Plan.
- **Known issues:** ninguno.

## BUILD 10

- **Status:** COMPLETE
- **Commits:** `16dd751` — `feat(photos): complete build 10 private job gallery`
- **Tests:** 33 unit, 32 integración y 14 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Upload múltiple con progreso/retry, MIME falso, límites, privacidad por defecto, publicación explícita, portada, orden y borrado lógico verificados. Revisión visual desktop 1280 px, tablet 768 px y mobile 390 px sin overflow; variantes sin EXIF y acceso anónimo rechazado.
- **Migrations:** `20261003021000_job_photos`; schema y migraciones sin drift.
- **Decisions:** DEC-002 — adapter privado S3-compatible en producción, filesystem local sólo para desarrollo/test y variantes procesadas con Sharp.
- **Known issues:** ninguno bloqueante; el cleanup físico de objetos expirados/eliminados queda como mantenimiento con política de retención, sin afectar privacidad ni trazabilidad V1.

## BUILD 11

- **Status:** COMPLETE
- **Commits:** `4312d51` — `feat(portal): complete build 11 private client access`
- **Tests:** 35 unit, 36 integración y 15 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Token/password hashes, límite persistente, expiración, revocación, regeneración, sesión corta, headers no-store y acceso de fotos verificados. Fixture adversarial con clientes de igual nombre/teléfono confirma aislamiento; turno oculto, fotos privadas y notas internas no salen. Revisión visual desktop 1280 px, tablet 768 px y mobile 390 px sin overflow.
- **Migrations:** `20261003022626_client_portal`, `20261003022800_client_portal_constraints`; un solo link activo por cliente y hashes validados por DB.
- **Decisions:** ninguna nueva; cookie firmada y ligada a token/password aplica la sesión corta aprobada sin sumar una tabla de workflow.
- **Known issues:** ninguno.

## BUILD 12

- **Status:** COMPLETE
- **Commits:** `91a2ef9` — `feat(dashboard): complete build 12 operations and search`
- **Tests:** 35 unit, 39 integración y 16 E2E verdes; lint, typecheck, format, build, migraciones y diff verdes. Fórmulas de cobrado, egresos, flujo, ticket acordado, saldo e importe por definir reconciliadas con el ledger y límites de Buenos Aires. ADMIN/STAFF reciben proyecciones distintas en dashboard y búsqueda. Revisión visual desktop 1280 px, tablet 768 px y mobile 390 px sin overflow.
- **Migrations:** ninguna; índices existentes cubren rangos operativos. Medición local en base de desarrollo: dashboard operativo 113.9 ms en cold run, dashboard ADMIN 15.2 ms y búsqueda 26.4 ms; `ILIKE contains` conserva scan simple apropiado al volumen V1, sin Elasticsearch/trigram prematuro.
- **Decisions:** ninguna nueva.
- **Known issues:** ninguno.

## BUILD 13

- **Status:** COMPLETE
- **Commits:** `afc3460` — `feat(hardening): complete build 13 production readiness`
- **Tests:** 35 unit, 42 integración y 17 E2E verdes; lint, typecheck, format, build y diff verdes. Auditoría de dependencias sin vulnerabilidades conocidas; health, cleanup y reconciliación ejecutados. Revisión visual desktop 1280×800, tablet 768×1024 y mobile 390×844 sin overflow ni errores de consola; menú mobile corregido y cubierto por E2E.
- **Migrations:** ninguna nueva. Restore drill local aplicó desde cero las migraciones versionadas sobre un schema aislado y verificó 38 tablas; el procedimiento productivo exige DB/restauración aislada del proveedor.
- **Decisions:** ninguna nueva. DEC-002 se precisó para usar POST prefirmado con política de MIME/tamaño exactos y cleanup de intents expirados.
- **Known issues:** ningún issue crítico/alto de código. Antes de producción falta el gate humano y validar un restore real con los proveedores contratados de DB/storage.

## FRONTEND BUILD FE-00 — Auditoría y extracción de marca

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Base:** `feat/ferraro-frontend-redesign` en `0cabbab`, idéntica a `origin/main` al iniciar; working tree limpio.
- **Scope:** auditoría de 39 rutas, 9 loadings, 247 selectores globales y UI por rol; extracción de ocho SVG oficiales desde el PDF vectorial, manifiesto y checksums.
- **Evidence:** 18 capturas privadas en `/tmp/ferraro-redesign-evidence/fe00` para login, dashboard ADMIN y STAFF en los seis viewports obligatorios; contact sheet de assets en `/tmp/ferraro-brand-audit/optimized-contact.png`.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. Prisma local aislado con 17 migraciones al día.
- **Security:** STAFF sin contenido financiero en HTML visible; baseline sin overflow horizontal mobile. No se usó producción ni servicios cloud.
- **Assets:** paths preservados; no autotrace, no fuente web para el wordmark; comparación manual páginas 1–5 aprobada internamente.
- **Gate:** GATE 1 marca, `approved for continued autonomous execution`; tokens, fuente, iconos y primitives continúan en FE-01/02.
- **Known issues:** preview/DB/auth/storage cloud aislados todavía no provisionados; no bloquean trabajo local y quedan sin declarar como validados.

## FRONTEND BUILD FE-01 — Foundations y tokens

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** tokens semánticos, cascade layers, foundations, utilidades mínimas, aliases heredados, Inter Variable local y `/app/design-system` inicial protegida para ADMIN.
- **Typography:** Inter Variable 5.3.0 elegida después de comparación óptica y métrica con IBM Plex Sans 5.3.0; una sola familia/subset latino, `display: swap`, fallback estable y licencia OFL versionada.
- **Evidence:** comparación tipográfica y tres capturas privadas de `/app/design-system` en `/tmp/ferraro-redesign-evidence/fe01`; 1440×900, 768×1024 y 390×844 sin overflow horizontal ni errores de consola.
- **Accessibility:** combinaciones de texto y estados entre 5.01:1 y 21:1; foco 6.52:1 sobre canvas, reduced motion global, targets base de 44 px y STAFF recibe forbidden server-side en el catálogo.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. Fuente cargada localmente y confirmada en navegador.
- **Gate:** GATE 1 foundations/tipo, `approved for continued autonomous execution`; primitives e iconografía continúan en FE-02.
- **Known issues:** aliases y hardcodes heredados continúan bajo migración controlada; preview cloud aislada aún no disponible y no fue sustituida por producción.

## FRONTEND BUILD FE-02 — Componentes base y design system

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** primitives P0, assets de marca, patterns de página/form, overlays headless, Phosphor y catálogo vivo ADMIN. El `window.confirm` compartido fue reemplazado por `ConfirmDialog` sin modificar server actions; el uso específico del portal migra en FE-12.
- **Architecture:** controles simples nativos; React Aria Components 1.22.1 para dialog/drawer/tooltip/confirmación; Phosphor Icons 2.1.10 como único set con imports por entorno. Boundaries cliente limitadas a overlays, confirmación y showcase interactivo.
- **Evidence:** cinco capturas privadas en `/tmp/ferraro-redesign-evidence/fe02`: catálogo 1440×900, 768×1024, 390×844, drawer mobile y confirmación mobile. Sin overflow horizontal ni errores de consola; aborts observados correspondieron a prefetch RSC cancelado durante navegación completa, no a respuestas fallidas.
- **Accessibility:** 2 E2E del design system verdes; axe WCAG A/AA sin violations, Escape/cierre/retorno de foco verificados, cancelación recibe foco inicial en acción destructiva y controles táctiles parten de 44 px.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. E2E relacionado: 4/4 (catálogo/axe y presupuesto ADMIN/STAFF con confirmación real).
- **Gate:** GATE 1 completo, `approved for continued autonomous execution`; marca, tipo, tokens, iconos, primitives y overlays habilitan FE-03/04.
- **Known issues:** el catálogo aún se monta dentro del shell heredado; su navegación y fixed mobile se reemplazan en FE-03. Preview cloud aislada sigue pendiente y producción no fue usada.

## FRONTEND BUILD FE-03 — Shell, navegación e iconografía

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** shell completo, navegación agrupada por rol, activo inequívoco, sidebar 280/72 persistida, tablet compacta, header/drawer/bottom-nav mobile, breadcrumbs, skip link y búsqueda integrada. No cambiaron destinos, queries ni autorización.
- **Evidence:** ocho capturas privadas en `/tmp/ferraro-redesign-evidence/fe03`: ADMIN/STAFF en los seis viewports obligatorios, ADMIN 1440 colapsada y drawer STAFF 390. Sin overflow horizontal ni errores de consola.
- **Security:** items derivados de `getNavigationForRole` en servidor; STAFF sin Finanzas/Compras/Administración en drawer, bottom-nav, DOM no-JS ni navegación desktop. Las rutas continúan autorizadas server-side.
- **Accessibility:** landmarks y `aria-current`, links reales sin JS, skip link, nombre accesible en compacto, tooltip por foco, targets 44 px, Escape y retorno de foco del drawer. Axe A/AA del catálogo integrado: 0 violations.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. E2E relacionado auth/design-system/shell: 8/8, incluido axe A/AA.
- **Gate:** GATE 2 shell, `approved for continued autonomous execution`; GATE 2 completo se cierra junto con login/estados en FE-04.
- **Known issues:** evidencia preview cloud integrada no disponible; validación local product build cubre el shell. Estilos globales heredados sin consumidores se retiran en FE-14.

## FRONTEND BUILD FE-04 — Login y estados globales

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** login Ferraro responsive con lockup oficial, primitives de formulario y feedback; `StatePage` para error/403/404, loading estructural y toast base consumido por el catálogo. Better Auth, proxy, redirects y contratos permanecen intactos.
- **Evidence:** ocho capturas privadas en `/tmp/ferraro-redesign-evidence/fe04`: login idle en seis viewports, error mobile y not-found mobile. Sin overflow; consola limpia en idle. El 401 de credencial inválida y 404 de la ruta adversarial son respuestas esperadas del caso probado.
- **Accessibility:** autofocus real en Email tras hidratación, labels/autocomplete conservados, inputs 48 px, loading `aria-busy`, error live, valores preservados y foco/contraste visibles. Axe login y catálogo: 0 violations A/AA.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. Auth/auth-ui 7/7 y design-system 2/2 en ejecuciones finales; submitting, invalid credentials, 403, 404 y toast cubiertos.
- **Gate:** GATE 2 completo, `approved for continued autonomous execution`; shell, navegación, login y estados habilitan migración modular.
- **Known issues:** preview cloud aislada no disponible; Better Auth Preview URL continúa pendiente de validación cloud. Producción no fue usada.

## FRONTEND BUILD FE-05 — Dashboard

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** dashboard operativo reordenado alrededor de la jornada: turnos de hoy y próximos primero, accesos rápidos por rol, actividad/stock como soporte y seguimiento administrativo separado. Para ADMIN, flujo neto es el KPI financiero principal; cobrado y egresos permanecen secundarios. No se agregaron métricas, gráficos, queries ni reglas de negocio.
- **Evidence:** seis capturas privadas en `/tmp/ferraro-redesign-evidence/fe05`, cubriendo ADMIN en 1440×900, 1280×800 y 1024×768, y STAFF en 820×1180, 768×1024 y 390×844. Estados vacíos, jerarquía financiera, sidebar/tablet/mobile y barra inferior fueron inspeccionados sin clipping ni overflow horizontal.
- **Accessibility:** dashboard ADMIN y STAFF con axe WCAG A/AA en 0 violations; headings, landmarks, `time`, enlaces completos, targets y foco preservados. La información financiera no existe para STAFF. Consola limpia; requests RSC cancelados al cerrar contextos corresponden a prefetch abortado, no a respuestas de aplicación fallidas.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. E2E relacionado dashboard/search ADMIN/STAFF 1/1, con proyecciones por rol y axe en ambas sesiones.
- **Gate:** GATE 3 dashboard parcial, `approved for continued autonomous execution`; se completa con agenda en FE-06.
- **Known issues:** evidencia cloud aislada no disponible; validación en production build local con PostgreSQL local y datos E2E sintéticos. Producción no fue usada.

## FRONTEND BUILD FE-06 — Agenda

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** agenda día/semana/mes, toolbar y selector de fecha navegable, eventos proporcionales con carriles de solape, continuidad multidía, bloqueo tramado, estados explícitos y formularios/detalle. Mobile usa lista temporal del día seleccionado; no comprime siete columnas. No se añadieron DnD, resize, capacidad, recordatorios ni reglas de colisión.
- **Evidence:** seis baselines en `/tmp/ferraro-redesign-evidence/fe06/baseline` y ocho capturas finales en `/tmp/ferraro-redesign-evidence/fe06/final`: las seis resoluciones obligatorias distribuidas entre ADMIN/STAFF y día/semana/mes, más formulario desktop y detalle mobile. Fixtures locales reversibles cubrieron vacío, solape, multidía, bloqueo, confirmado, realizado y cancelado; fueron eliminadas después de capturar.
- **Responsive:** día temporal proporcional en desktop, semana de siete columnas legibles con scroll/snap en tablet y día elegido como lista en mobile; mes con seis semanas completas, encabezados y `+N`, reducido al día elegido en mobile. Cero overflow del documento en 1440×900, 1280×800, 1024×768, 820×1180, 768×1024 y 390×844.
- **Accessibility:** estado por texto, icono, borde/forma y color; rango/duración en nombres accesibles; orden cronológico; teclado para view switcher y fecha nativa; axe WCAG A/AA en 0 violations. Emulación de 200% efectiva (640 CSS px, DPR 2) sin overflow y `prefers-reduced-motion: reduce` confirmado. Consola y respuestas HTTP limpias en las capturas.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. Agenda E2E 2/2; gate conjunto agenda/dashboard/portal 4/4 con roles, proyecciones y aislamiento conservados.
- **Gate:** GATE 3 completo, `approved for continued autonomous execution`.
- **Known issues:** preview cloud aislada no disponible; validación local sobre production build y PostgreSQL local. La página de turno sigue siendo la fuente de verdad y no se agregó drawer opcional. Producción no fue usada.

## FRONTEND BUILD FE-07 — Clientes, vehículos y servicios

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** listas, filtros, fichas, garage, historial, presupuestos ADMIN, formularios de cliente/vehículo y catálogo ADMIN con categorías, precio base, duración y variantes. No se agregaron capacidades CRM, marcas visuales de fabricantes, transferencias ni reglas de pricing.
- **Evidence:** seis baselines en `/tmp/ferraro-redesign-evidence/fe07/baseline` y nueve capturas finales en `/tmp/ferraro-redesign-evidence/fe07/final`. Las seis resoluciones obligatorias se distribuyeron entre ADMIN/STAFF, lista/ficha/catálogo/form; evidencia adicional cubre archivado, duplicado sugerido, filtro sin resultados, servicio inactivo, a cotizar, variantes y datos largos. Fixtures locales reversibles eliminados al terminar.
- **Responsive:** filas densas pasan a bloques de lectura sin perder nombre/contacto/garage/estado; ficha reordena resumen, vehículos e historial; forms compartidos pasan a una columna. Cero overflow en 1440×900, 1280×800, 1024×768, 820×1180, 768×1024 y 390×844; consola y respuestas HTTP limpias.
- **Accessibility:** fields compartidos enlazan label/descripción/error, estados no dependen sólo de color, targets preservados y formularios mantienen controles nativos/autocomplete. Axe WCAG A/AA en 0 violations para lista STAFF y detalle de servicio ADMIN.
- **Security:** ADMIN conserva catálogo, precios, presupuestos y portal; STAFF recibe 403 server-side en Servicios y no recibe presupuestos/portal en la ficha. Queries y proyecciones existentes no cambiaron.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. E2E clientes/servicios 2/2 con alta, vehículo, búsqueda por modelo, categoría, servicio, excepción de modelo y denegación STAFF.
- **Gate:** GATE 4 primer corte modular, `approved for continued autonomous execution`; se completa con FE-08 a FE-12.
- **Known issues:** el gestor visual del link privado se rediseña en FE-12 y sólo fue preservado aquí; preview cloud aislada no disponible. Producción no fue usada.

## FRONTEND BUILD FE-08 — Trabajos, consumos y fotografías

- **Status:** COMPLETE LOCAL / CLOUD PERSISTENCE PENDING — approved for continued autonomous execution.
- **Scope:** historial, alta y detalle de trabajos; servicios snapshot, consumos/correcciones/anulación y galería privada con upload, progreso, etapa, portada, orden, publicación y eliminación. El lightbox React Aria reemplaza la apertura en pestaña y conserva foco/Escape. No cambiaron contratos, stock, procesamiento, storage ni autorización.
- **Evidence:** seis baselines de lista vacía en `/tmp/ferraro-redesign-evidence/fe08/baseline` y seis capturas finales del detalle poblado en `/tmp/ferraro-redesign-evidence/fe08/final`, para 1440×900, 1280×800, 1024×768, 820×1180, 768×1024 y 390×844. Fixtures locales reversibles cubrieron turno convertido, snapshot, corrección, 1 foto y visibilidad privada/pública; fueron eliminadas por teardown.
- **Responsive:** historial recompone filas sin perder fecha/vehículo/cliente/servicios/estado; resumen 3→2→1, galería 4→3→2→1 y queue compacta. Los seis viewports pasan chequeo programático de overflow horizontal.
- **Accessibility:** estado por texto/icono/color; controles de galería nombrados; modal con título, focus trap, Escape y retorno; progreso live y alt contextual. Axe WCAG A/AA/2.2 AA en 0 violations después de corregir el contraste heredado del disclosure.
- **Security:** thumbnail/preview continúan detrás de endpoints autorizados; acceso anónimo devuelve 401; foto privada por defecto y publicación explícita verificadas. STAFF accede a operación, no a cobros ADMIN.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. E2E jobs 2/2: turno→trabajo, consumo→corrección con movimientos compensatorios, upload local, privacidad, publicación y lightbox por teclado.
- **Gate:** GATE 4 continúa, `approved for continued autonomous execution` para la validación local.
- **Known issues:** no existe storage Preview persistente y aislado; por regla del plan, la persistencia remota de FE-08 no se declara cerrada. Producción no fue usada. El procesamiento se validó exclusivamente con filesystem local y datos sintéticos.

## FRONTEND BUILD FE-09 — Presupuestos y PDF

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** lista/filtros, editor con resumen, detalle/document sheet, acciones de lifecycle, agenda desde aceptado y PDF A4. Cálculos, precisión decimal, estados, artefacto congelado y autorización permanecen intactos.
- **Brand/PDF:** el wordmark tipográfico fue eliminado del renderer. El PDF inserta el lockup FERRARO DETAIL oficial como los mismos paths del SVG verificado, usa negro/gris/amarillo oficiales, papel blanco e Inter Variable TTF embebida (`4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf`).
- **Evidence:** seis baselines en `/tmp/ferraro-redesign-evidence/fe09/baseline`; seis capturas UI, PDF original, raster color, raster gris y extracción de texto en `/tmp/ferraro-redesign-evidence/fe09/final`. A4 de una línea inspeccionado visualmente; prueba unitaria genera además 35 líneas multipágina.
- **Responsive/accessibility:** editor 2 columnas + resumen sticky pasa a flujo único; document sheet conserva jerarquía y montos tabulares. Seis viewports sin overflow horizontal; axe WCAG A/AA/2.2 AA en 0 violations. PDF conserva texto extraíble, metadata, numeración, encabezado de tabla repetido y filas no partidas.
- **Security/lifecycle:** STAFF recibe 403 en UI y PDF; preview/final continúan `private, no-store`; emitir congela el artefacto, aceptar fija importe y convertir reutiliza el mismo caso. Ningún cobro se registra por estas acciones.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. Quote E2E 2/2: crear, preview PDF válido, emitir, aceptar, agendar, reconciliar USD 800.00 y denegación STAFF.
- **Gate:** GATE 4 UI continúa y GATE 5 PDF parcial, `approved for continued autonomous execution`.
- **Known issues:** no existe preview cloud aislada; el artefacto se validó con filesystem local, sin producción.

## FRONTEND BUILD FE-10 — Finanzas

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** resumen mensual, ledger, filtros, movimientos/categorías, estado financiero por caso, importe acordado, cobros, revisiones y reversión compensatoria. Sólo cambió presentación; moneda, signos, balances y reglas permanecen intactos.
- **Hierarchy:** entradas/salidas sostienen contexto y flujo neto ocupa la superficie oscura dominante. Importe acordado, cobrado neto y saldo pendiente/a favor/indefinido conservan etiquetas diferentes; ningún total depende sólo del color.
- **Evidence:** seis baselines en `/tmp/ferraro-redesign-evidence/fe10/baseline` y seis capturas finales del caso poblado en `/tmp/ferraro-redesign-evidence/fe10/final`, cubriendo todos los viewports obligatorios. Sin overflow horizontal.
- **Accessibility/security:** montos tabulares con signo y label, timeline textual, confirmación robusta y axe WCAG A/AA/2.2 AA en 0 violations. STAFF no recibe navegación financiera y obtiene 403 server-side tanto en lista como caso.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. Finance E2E 2/2: importe por definir→acordado, cobro parcial, saldo USD 750.00 y denial STAFF.
- **Gate:** GATE 4 continúa, `approved for continued autonomous execution`.
- **Known issues:** preview cloud aislada no disponible; datos sintéticos PostgreSQL local, sin producción.

## FRONTEND BUILD FE-11 — Inventario, compras y proveedores

- **Status:** COMPLETE — approved for continued autonomous execution.
- **Scope:** inventario/filtros/estados, detalle y ajustes, categorías/presentaciones, compras/lista/editor/detalle y proveedores. No cambiaron unidades, factores, ledger, cálculos ni permisos.
- **Hierarchy:** stock actual y unidad se leen juntos; mínimo y estado completan la decisión. Compra muestra snapshot, factor de conversión, cantidad base ingresada, costo/total e integridad enlazada de inventario/caja.
- **Evidence:** seis baselines en `/tmp/ferraro-redesign-evidence/fe11/baseline` y seis capturas finales de compra poblada en `/tmp/ferraro-redesign-evidence/fe11/final`, cubriendo viewports obligatorios sin overflow horizontal.
- **Accessibility/security:** disponible/bajo usan icono+texto+color, unidad acompaña cantidad y targets preservan 44 px. Axe WCAG A/AA/2.2 AA en 0 violations para detalle de compra ADMIN y detalle de inventario STAFF. Costos/ajustes no se proyectan a STAFF; Compras devuelve 403.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. Inventory/purchases E2E 2/2: categoría, artículo, ajuste, presentación 1=15 m, compra 2 rollos→+30 m, egreso USD 1200 y denegaciones.
- **Gate:** GATE 4 módulos operativos/comerciales completo, `approved for continued autonomous execution`.
- **Known issues:** preview cloud aislada no disponible; validación local reversible, sin producción.

## FRONTEND BUILD FE-12 — Búsqueda, administración y portal

- **Status:** COMPLETE LOCAL / CLOUD PERSISTENCE PENDING — approved for continued autonomous execution.
- **Scope:** resultados globales agrupados, administración honesta con capacidades existentes, gestor de acceso privado y portal cliente mobile-first con garage, turnos, trabajos y galería. No se agregó command palette, acciones administrativas ni información financiera.
- **Portal:** lockup DETAIL oficial, composición editorial separada del backoffice y lightbox React Aria sobre endpoints de portal. Se eliminó el último `window.confirm`; revocación usa confirmación accesible con consecuencia explícita.
- **Evidence:** seis baselines en `/tmp/ferraro-redesign-evidence/fe12/baseline` y portal poblado en los seis viewports en `/tmp/ferraro-redesign-evidence/fe12/final`. Estados invalid/password/full y regenerado/revocado cubiertos por E2E; sin overflow horizontal.
- **Privacy/accessibility:** fixture adversarial con dos clientes homónimos/teléfono igual confirma aislamiento; no aparecen vehículo B, turno oculto, notas internas ni foto ajena. Request sin sesión al thumbnail portal devuelve 401. Axe WCAG A/AA/2.2 AA en 0 violations; lightbox cierra con Escape.
- **Search/roles:** dashboard/search E2E confirma que ADMIN recibe presupuestos y STAFF no, mientras ambos mantienen clientes/vehículos/trabajos/servicios según proyección existente. STAFF no recibe gestor de portal.
- **Tests:** lint, typecheck, 35 unit, 42 integración, build y `git diff --check` verdes. Gate relacionado dashboard/search/portal 2/2; portal separado 1/1 con password, headers no-store/no-referrer/noindex, regeneración y revocación inmediata.
- **Gate:** GATE 5 portal parcial, `approved for continued autonomous execution` para validación local.
- **Known issues:** DB/auth/storage Preview aislados no están disponibles. Por regla del plan, persistencia remota y Better Auth Preview no se declaran cerrados; producción no fue usada.

## FRONTEND BUILD FE-13 — Responsive, accesibilidad y hardening visual

- **Status:** COMPLETE — GATE 5 local approved for continued autonomous execution.
- **Scope:** auditoría transversal de seis viewports, 200% efectivo, reduced motion, roles, portal, teclado, metadata, axe, overflow, consola/respuestas y suite completa. No se añadieron features ni cambios de dominio.
- **Findings/fixes:** la suite total detectó dos selectores/sincronizaciones E2E tras cambios legítimos: heading de Administración y ejecución de axe antes de metadata Next. Se actualizaron a heading real y espera explícita de `<title>`; no se ocultaron reglas ni se redujo cobertura.
- **Evidence:** 12 capturas ADMIN/STAFF + zoom en `/tmp/ferraro-redesign-evidence/fe13/final`; `crawl-report.json` contiene 36 combinaciones ruta/rol/viewport con 0 overflow, 0 páginas sin título, 0 page errors y 0 respuestas 5xx. Viewports: 1440×900, 1280×800, 1024×768, 820×1180, 768×1024 y 390×844.
- **Zoom/motion:** emulación 200% efectiva a 640 CSS px/DPR 2, sin overflow; `prefers-reduced-motion: reduce` verdadero en todo el crawl. Focus trap/Escape/retorno, navegación mobile, shortcuts, formularios y agenda por teclado están cubiertos por E2E.
- **Accessibility:** axe WCAG 2 A/AA, 2.1 y 2.2 AA en login, design system, dashboard ADMIN/STAFF, clientes, agenda, trabajos, finanzas, inventario, compras, servicios, presupuestos y portal: 0 violations en ejecuciones finales.
- **Tests:** suite E2E completa 25/25 verde (1.1 min), 35 unit y 42 integración verdes; lint, typecheck, build y `git diff --check` verdes. No hay `window.confirm`, segunda librería de iconos, Tailwind ni errores de consola de aplicación.
- **Gate:** GATE 5 QA local, `approved for continued autonomous execution`; FE-14 habilitado.
- **Known issues:** validación cloud de Preview/Auth/storage continúa pendiente y no se sustituye por producción. No quedan issues críticos/altos; la deuda de CSS legacy/aliases se aborda en FE-14.

## FRONTEND BUILD FE-14 — Limpieza, documentación y portabilidad

- **Status:** COMPLETE — approved for final human review.
- **Cleanup:** se eliminaron 941 líneas de CSS global sin consumidores: listas/detalles migrados de trabajos, presupuestos, inventario, compras y finanzas; uploader/galerías antiguas; portal/search legacy y media queries huérfanas. `globals.css` bajó de 70.542 bytes/3.823 líneas a 52.497 bytes/2.889 líneas antes del format final, sin borrar forms/details compartidos aún activos.
- **Ownership:** `docs/FERRARO_BRAND_UI.md` define límites de assets, config, tokens, primitives, módulos y servicios; incluye procedimiento de swap a PPF House sin assets Ferraro, multiempresa ni runtime theming.
- **Assets/licenses:** manifiesto final de SVG sigue en `public/brand/manifest.json`; se añadió `src/design-system/fonts/manifest.json` con versión, OFL y SHA-256 de WOFF2/TTF. El PDF y UI no dependen de red.
- **Accessibility finding:** el primer cierre E2E alcanzó el skeleton de Inventario durante axe y expuso `aria-label` sobre un `div` genérico. El patrón se corrigió en los ocho loading backoffice con `role="status"`, `aria-busy` y texto `sr-only`; la suite completa posterior confirma la corrección sin silenciar reglas.
- **Verification:** lint, typecheck, build y `git diff --check` verdes después del cleanup; 35/35 unit, 42/42 integración y 25/25 E2E Chromium verdes. El cierre vuelve a cubrir login, ADMIN, STAFF, portal, agenda, formularios, fotos, PDF, roles y axe.
- **Evidence:** seis capturas post-cleanup en `/tmp/ferraro-redesign-evidence/fe14/final`, 1440×900, 1280×800, 1024×768, 820×1180, 768×1024 y 390×844. Inspección desktop/mobile, 0 overflow del documento, 0 page errors y 0 respuestas 5xx.
- **Gate:** FE-00 a FE-14 completos; GATE 5 local aprobado. Release/merge a `main` requieren revisión humana separada.
- **Known issues:** Preview cloud aislada sigue no disponible; persistencia remota FE-08/12 y Better Auth Preview quedan pendientes reales. Los 14 aliases `--color-*` permanecen sólo en consumers globales activos; owner: frontend, retiro incremental al migrar esos forms/details, sin fecha de release bloqueante.

## MONEY + PROFITABILITY — Entrada USD/ARS y costo directo opcional

- **Fecha:** 2026-10-10
- **Branch:** `feat/ferraro-money-profitability`
- **Base:** `origin/main`, SHA `fda749c7bf634add77b5087a8aced59485bd4f71`; contiene el frontend aprobado posterior a FE-14.
- **Objetivo:** aceptar importes de origen USD o ARS con USD canónico, conservar importe/cotización de origen y exponer margen sólo cuando existe importe acordado y costo directo informado.
- **Decisión de dominio:** el costo directo nullable vive en `ServiceCase`, junto al acuerdo comercial del caso que puede abarcar varios jobs. `null` es “sin imputar”; `0` es costo conocido cero. No se infiere costo desde inventario ni se bloquea la operación. Margen parcial se llama “Margen conocido” y se acompaña de cobertura; flujo de caja y margen permanecen separados.
- **Auditoría de montos:** inputs con origen USD/ARS: movimientos financieros, monto acordado/correcciones, costo directo, presupuestos e items, compras e items. Cálculos y agregados permanecen USD canónico. Catálogo de servicios/variantes e `InventoryItem.costHintUsd` siguen siendo referencias internas USD; no agregan selector. Cantidades de inventario no son dinero.
- **Modelo/migraciones:** enum `SourceCurrency`; campos de origen en `FinancialEntry`, `ServiceCase`, revisiones, `Quote`/`QuoteItem`, `Purchase`/`PurchaseItem`; costo directo en `ServiceCase`. Migraciones `20261010120000_money_profitability`, `20261010140000_money_consistency_constraints` y `20261010160000_direct_cost_consistency`. Backfill: registros existentes se interpretan como USD, su valor USD se copia al campo original correspondiente, tasa queda null y costo directo queda null; no se crea FX/costo histórico ficticio.
- **Módulos:** abstracción Decimal compartida en `src/modules/money`; server actions y servicios de finanzas, presupuestos, compras y dashboard; MoneyField reutilizable; snapshot de moneda en PDF de presupuesto; proyección ADMIN para costo/margen y STAFF/portal sin esos datos.
- **Validación de migración:** se aplicaron las tres migraciones a la DB local existente `ferraro_manager` (PostgreSQL 127.0.0.1:5434) y se aplicaron las 20 migraciones desde cero a `ferraro_money_clean_20261010`, DB temporal luego eliminada. `pnpm prisma migrate status`: sin migraciones pendientes. No se usaron DB/infra de producción.
- **Validación técnica:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (43 unit, 46 integración), `pnpm build` y `pnpm test:e2e` (29 E2E) verdes. Axe WCAG A/AA/2.1/2.2 AA sin violaciones en las superficies MoneyField/costo revisadas.
- **Responsive/evidencia:** Playwright comprobó que no hay overflow horizontal y guardó capturas privadas en `/tmp/ferraro-money-evidence` para finanzas, casos/jobs, presupuestos y compras en 1440×900, 1280×800, 1024×768, 820×1180, 768×1024 y 390×844. También comprobó reflow sin overflow a 640 CSS px (ancho equivalente a 200% de zoom desde 1280 px). Los artefactos temporales no se versionan.
- **Documentación:** README, Master Plan, Decisions, Operations, Brand UI y este Execution Log actualizados. Se revisó `FERRARO_FRONTEND_MASTER_PLAN.md` y se dejó intacto por ser un plan histórico; el patrón MoneyField actual queda documentado en Brand UI. No se agregaron variables de entorno.
- **Commits de implementación:** `37f28ef` modelo USD/ARS y conversión Decimal; `656c48c` presupuestos/PDF; `bb8d631` compras; `d9bfc41` finanzas y rentabilidad opcional; `202a2e0` cobertura unitaria/integración/E2E; `661f2b3` estabilidad del MoneyField y reflow compacto.
- **Restricciones/pendientes:** sin deploy, cambios en `main` ni producción. Preview cloud separada no disponible; esta tarea sólo valida local. En cada push GitHub notificó una vulnerabilidad alta existente en la branch por defecto; el aviso no identificó paquete/advisory en la salida y no se investigó dentro de esta feature.

## Cierre técnico — Money + profitability

- **Fecha:** 2026-10-10
- **Branch/base:** `feat/ferraro-money-profitability`, base `fda749c7bf634add77b5087a8aced59485bd4f71` (`origin/main` al inicio).
- **Objetivo:** endurecer la consistencia persistida de costo directo y evaluar el advisory alto informado por GitHub sin ampliar funcionalidad ni tocar producción.
- **Migración:** `20261010160000_direct_cost_consistency` reemplaza la constraint de `service_cases`: conserva el estado sin imputar como cuatro `NULL`; USD exige `directCostSourceAmount = directCostUsd` y cotización `NULL`; ARS exige costo USD, importe de origen y cotización positiva. Ambos importes admiten cero y rechazan negativos. La DB local existente no tenía costos directos incompatibles; no hubo backfill.
- **Pruebas de migración:** `pnpm db:migrate:deploy` aplicó la migración sobre `ferraro_manager` local. Las 20 migraciones se aplicaron desde cero en `ferraro_money_clean_20261010`, temporal y eliminada al finalizar. En esa DB la constraint rechazó: USD con importe origen distinto, ARS sin cotización, costo USD negativo y origen ARS negativo; aceptó costo cero y el estado `NULL` completo.
- **Seguridad:** `pnpm audit` identificó únicamente `braces@3.0.3`, advisory alto `GHSA-vfj7-8cjw-p6xm` / CWE-674 (denial of service por patrones profundamente anidados). Es transitivo y dev-only: `eslint-config-next@16.3.8` → `@next/eslint-plugin-next@16.3.8` → `fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`; `pnpm audit --prod` reportó cero vulnerabilidades. No se ejecuta en el runtime de Ferraro. El advisory declara corrección desde `3.0.4`, pero esa versión no está publicada en npm; `eslint-config-next@16.4.0` sigue fijando `fast-glob@3.3.1`. No se forzó override ni upgrade mayor sin release corregido disponible; queda documentada como deuda dev-only a reevaluar cuando el ecosistema publique la corrección.

## RELEASE MERGED / PRODUCTION DEPLOYMENT BLOCKED

- **Fecha:** 2026-10-10
- **Código aprobado:** `2e029cafa85567edc7731de6e46f9983c3d919bd`.
- **Git:** `feat/ferraro-money-profitability` llegó a `main` mediante fast-forward y `main` fue pusheado correctamente a `origin/main`. No hubo force push, merge commit ni rebase destructivo; el worktree estaba limpio.
- **Deployment Vercel:** proyecto `ferraro-manager`; deployment `dpl_7vqLWL8xcU6gkhUhmFHM1whYGY6q`; producción `https://ferraro-manager.vercel.app`; estado `BLOCKED` antes del build.
- **Producción:** no corrió build, no corrió `prisma migrate deploy`, no se aplicaron las tres migraciones y no se desplegó el frontend/backend nuevo. Producción continúa sirviendo la versión anterior; el smoke test de este release no fue ejecutado.
- **Causa:** bloqueo de colaboración/atribución del committer `rcoirini@brocosolutions.com` en Vercel/GitHub. No es un problema del código ni de las migraciones. No se modificaron membresías, cuentas, integración Git, protección de deployments, Vercel ni Railway.
- **Base de datos:** el producto aún no está en uso operativo y no hay datos productivos relevantes para este release; por eso no se exigió backup previo. Esto no es una política general: cuando existan datos reales, cada release con migraciones debe evaluar backup, rollback e impacto explícitamente.
- **Seguridad:** permanece pendiente el advisory dev-only `GHSA-vfj7-8cjw-p6xm`, `braces@3.0.3`, CWE-674, HIGH; `pnpm audit --prod` reporta cero vulnerabilidades y no existe publicada la versión `braces@3.0.4` indicada como fix.
- **Próximo paso:** **PENDIENTE DE ACCESO VERCEL**. Al retomar, resolver la asociación/aprobación del committer, desplegar nuevamente el último `main`, esperar `READY`, verificar build y Prisma, confirmar las tres migraciones, ejecutar smoke test de USD/ARS, presupuestos, compras, finanzas, costo directo, margen y cobertura, revisar logs y actualizar este log sólo cuando el release productivo sea exitoso.

## RELEASE DEPLOYED — Money + profitability

- **Fecha:** 2026-10-10
- **Código:** `main` en `e5dc479d4addc48ac7eb4875c6d244789934babf`.
- **Deployment:** Vercel `dpl_4FCq5cKW2mWMBTLEZZM94wCTq7hd`, origen CLI autorizado sobre el proyecto existente `ferraro-manager`, estado `READY`, alias `https://ferraro-manager.vercel.app`.
- **Build:** completado correctamente con `pnpm db:generate && pnpm db:migrate:deploy && pnpm build`; Next.js 16.3.8 compiló y generó las rutas sin error.
- **Producción:** las tres migraciones quedaron aplicadas en Railway: `20261010120000_money_profitability`, `20261010140000_money_consistency_constraints` y `20261010160000_direct_cost_consistency`.
- **Smoke test:** `/login` respondió 200; `/api/health` respondió `{"status":"ok"}`; `/app`, `/app/calendar` y `/app/finance` redirigieron anónimamente a `/login` con 307; las rutas productivas principales respondieron correctamente al seguimiento de redirección. No se crearon datos productivos.
- **Runtime:** no se encontraron logs `error` ni `fatal` para el deployment durante la ventana posterior al release.
- **Seguridad:** continúa documentado `GHSA-vfj7-8cjw-p6xm` / `braces@3.0.3` como advisory HIGH, transitivo y dev-only; `pnpm audit --prod` permanece en cero.
- **Estado:** release productivo completado. La validación autenticada de ADMIN y los flujos que requieren datos queda para una sesión con credenciales operativas; no se inventaron usuarios ni datos.

## CLIENT → VEHICLE FLOW UX — Agenda y Presupuestos

- **Fecha:** 2026-10-16.
- **Branch/base:** `feat/client-vehicle-flow-ux`, creada y pusheada desde `origin/main` en `a5d37d5a62a1ec899839783359438aa0553666af`. Al cierre `origin/main` seguía en ese mismo SHA; `main` local y remoto no fueron modificados. Los commits recientes revisados antes de empezar fueron `a5d37d5` (usuarios ADMIN), `037f3aa` (CORS), `8d57d15` y `29437ad` (CSS/design system).
- **Problema reportado por Lolo:** nuevo turno y presupuesto exigían salir del flujo para crear Cliente → Vehículo; clientes sin vehículo desaparecían. En edición, cliente/auto quedaban siempre fijos sin explicar la razón.
- **Baseline:** instalación frozen, Prisma generate, lint, typecheck, build y unit verdes. La primera integración encontró la DB local configurada en `localhost:5434` detenida; no fue un fallo de código. Se levantó PostgreSQL efímero local con Prisma Dev, se aplicaron las 20 migraciones y el baseline completo quedó verde. No se cambió schema ni se creó migración.
- **Picker compartido:** `ClientVehiclePicker` usa React Aria, debounce 250/200 ms, búsqueda server-side de hasta 20 clientes/vehículos, teclado, touch, estados loading/error/vacío y cancelación de respuestas obsoletas. Busca cliente por nombre, teléfono normalizado, email y marca/modelo; vehículo por tokens de marca/modelo/versión/año. Clientes activos sin vehículo permanecen visibles y el vehículo previo se limpia al cambiar de cliente.
- **Quick create:** dialog desktop/sheet mobile sin navegación, por lo que conserva fecha, horario, servicios, responsables, líneas, descuentos, moneda, notas y condiciones. Crea cliente + 1..10 vehículos en una transacción `Serializable`, o agrega un vehículo al cliente actual; inserta y selecciona el resultado sin reload. Server Actions autentican, revalidan schemas existentes, actividad y pertenencia vehículo→cliente.
- **Anti-duplicados:** teléfono normalizado y email case-insensitive son coincidencias fuertes y bloquean el alta ofreciendo “Usar este cliente”. Nombre normalizado sin acentos/case es sugerencia no bloqueante. Se reutilizó y amplió `findPossibleDuplicates`; no existe constraint por nombre.
- **Agenda:** `/app/calendar/new` funciona con cero clientes, clientes sin garage o clientes con vehículos. Se conservaron idempotencia, horarios, servicios, responsables, notas y portal. La identidad de un turno sólo se reasigna transaccionalmente cuando el caso es `DIRECT_APPOINTMENT`, tiene exactamente una appointment y no posee quote aceptado, Job, FinancialEntry, monto/costo/fuente/revisión económica. El servidor repite toda la validación; un caso con historia muestra identidad fija y explicación.
- **Presupuestos:** nuevo y edición DRAFT usan el picker común. La card oscura conserva descuentos por línea y general; ahora expresa `subtotal − descuento general = total`, ayuda de única aplicación, total dominante, equivalente USD en ARS y formato visual `es-AR`. El preview reacciona a cantidad, precio, ambos descuentos, moneda y cotización; Decimal server-side continúa autoritativo.
- **Error recuperable:** no se reprodujo un error boundary con escenarios válidos ni apareció una traza concluyente. La auditoría encontró como riesgo real la carga inicial no acotada de todos los clientes con vehículo y sus vehículos; se sustituyó por proyección inicial limitada y búsquedas server-side. La regresión verifica `/app/quotes/new`, navegación directa, 25 clientes extra, ausencia de `pageerror`, respuestas 5xx y “Error recuperable”. Los logs Vercel read-only no estuvieron disponibles porque el CLI no pudo leer/crear su configuración de autenticación en el entorno restringido; no se modificó Vercel ni se infiere una causa no demostrada.
- **Testing final:** `pnpm db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (20 archivos/59 unit y 15 archivos/55 integración), `pnpm test:e2e` (35/35 Chromium), `pnpm build` y `git diff --check` verdes. Axe WCAG 2 A/AA, 2.1 A/AA y 2.2 AA quedó sin violaciones en picker/dialog/formularios representativos. La suite cubre búsqueda, clientes sin vehículo, multi-vehículo, duplicados, estado conservado, relación server-side, reasignación segura/bloqueada, USD/ARS, permisos, PDF y regresiones generales. No apareció el warning conocido de `pg`. El chequeo opcional `pnpm format:check` conserva un warning preexistente en `tests/e2e/auth.spec.ts`, archivo idéntico a `origin/main`; no se amplió el alcance para reformatearlo.
- **Estabilidad E2E:** el test preexistente de rentabilidad ARS necesitó timeout explícito de 60 s y espera de login de 15 s en el runner restringido; ejecutó todos sus pasos y pasó en 35,3 s dentro de la suite global. No se eliminó ni relajó ninguna aserción.
- **Responsive/evidencia:** Playwright verificó 1440×900, 1280×800, 1024×768, 820×1180, 768×1024 y 390×844 sin overflow horizontal. Capturas de Agenda, quick create, formulario/resumen/detalle de presupuesto y PDF, además de regresiones visuales, quedaron como artifacts privados en `/tmp/ferraro-client-vehicle-flow-evidence-20261016`. Se inspeccionaron manualmente desktop y mobile.
- **Documentación:** README, Master Plan, Decisions (`DEC-012`), Execution Log, Brand UI y Operations actualizados. `FERRARO_FRONTEND_MASTER_PLAN.md` permanece intacto como documento histórico porque no existe contradicción crítica.
- **Commits de implementación:** `4be5362` picker/búsqueda/quick create/duplicados; `2314e5a` estados asincrónicos y overlays; `72ec709` Agenda y reasignación segura; `ad1fa54` Presupuestos y resumen. La documentación y el ajuste de estabilidad E2E se cierran en commits posteriores de esta misma branch.
- **Infra/release:** no hubo merge, deploy, cambios de Vercel/Railway, datos reales ni mensajes a usuarios. Producción no fue consultada con credenciales ni modificada.

## RELEASE DEPLOYED — Client → Vehicle Flow UX

- **Fecha:** 2026-10-16.
- **Git:** `main` avanzó por fast-forward desde `a5d37d5a62a1ec899839783359438aa0553666af` hasta el código aprobado `25fdf34d6f5c007817045ddb22d230fb1a42ad8d` y se publicó en `origin/main`. No hubo merge commit, force push ni rebase destructivo.
- **Vercel:** deployment Git productivo `dpl_6L5adZT5xQ8c57W4db6eP6h99TKp`, commit `25fdf34d6f5c007817045ddb22d230fb1a42ad8d`, estado `READY` y alias `https://ferraro-manager.brocosolutions.com`. Next.js compiló correctamente; el paso Prisma existente informó `No pending migrations to apply`.
- **Smoke productivo:** sesión ADMIN y respuestas 200 en `/login`, `/app`, `/app/calendar`, `/app/calendar/new`, `/app/quotes`, `/app/quotes/new`, `/app/clients` y `/app/admin`. Agenda confirmó picker buscable, vehículo dependiente, quick create con Escape/retorno de foco y cliente real sin vehículo con acción inline. Presupuestos confirmó picker, card oscura con subtotal/descuento/total separados, helper de aplicación única, estados USD/ARS y equivalente USD. No se guardaron ni alteraron datos productivos.
- **Calidad visual/runtime:** sin error boundary, overflow horizontal en 1440 px o 390 px, respuestas 5xx, `pageerror`, errores de consola ni fallos de red relevantes. Evidencia privada en `/tmp/ferraro-prod-calendar-new-1440.png`, `/tmp/ferraro-prod-quotes-new-1440.png` y `/tmp/ferraro-prod-quotes-new-390.png`. Logs del deployment sin `error`/`fatal` ni coincidencias de Prisma, Better Auth, 500 o excepciones en la ventana posterior al release.
- **Alcance operativo:** no se añadieron migraciones ni cambios de schema, dependencias, configuración o infraestructura; Railway no fue operado. El único acceso de datos fue el flujo normal de lectura/autenticación del smoke y el chequeo de migraciones ya configurado en el build de Vercel.

## FIX — Emisión de presupuestos y carga mínima de turnos

- **Fecha:** 2026-10-19.
- **Causa confirmada:** logs productivos de Vercel mostraron `ENOENT`, `mkdir /var/task/.data`, al emitir un presupuesto. El adaptador estaba usando filesystem local y el proyecto no tenía las variables S3 de conexión, aunque Railway ya tenía el bucket privado `ferraro-private`.
- **Storage:** se verificaron escritura/lectura/borrado con un objeto temporal de nombre único en el bucket real. Se configuraron en Vercel, sólo para producción, `STORAGE_DRIVER=s3` y las seis variables de conexión S3; access key y secret key quedaron como secretos. El objeto de verificación fue eliminado. Las variables requieren un deployment nuevo para llegar al runtime activo.
- **Presupuestos:** emisión con estado pendiente, botón bloqueado y error dentro del detalle; logging técnico sin valores de credenciales. La generación y persistencia del PDF preceden al cambio a `SENT`. Se agregó validación de configuración S3 y rechazo del storage local en Vercel.
- **Turnos:** el detalle es de consulta; el formulario se movió a `/app/calendar/[appointmentId]/edit`. Crear un turno directo o desde presupuesto aceptado abre el detalle con confirmación específica. Estado histórico y reglas de reasignación se mantienen.
- **Clientes/vehículos:** acceso persistente «Nuevo cliente + vehículo», alta rápida con nombre/teléfono opcional/marca/modelo, un vehículo inicial y múltiples vehículos opcionales. Los formularios de vehículos muestran sólo marca/modelo. Los atributos históricos omitidos permanecen en la DB y se preservan al editar; no hubo migración.
- **Pruebas:** Node 24; lint, typecheck, build, 63 unitarias y 55 de integración verdes. Integración se ejecutó en un PostgreSQL 17 temporal local con las migraciones existentes. En la pasada E2E general pasaron 32/35; tras corregir una selección ambigua del alert de Next y agregar espera de navegación en el test de servicios, el rerun de presupuestos/servicios pasó 5/5, cubriendo los tres fallos de esa pasada. Los 35 escenarios quedaron verificados. Se comprobó falla real de escritura del PDF, borrador conservado, reintento, descarga estable, USD/ARS, permisos, detalle/edición, duplicados y conservación de atributos históricos.
- **Responsive/accesibilidad:** axe sin violaciones en formularios, diálogo y detalle representativos; revisión visual de escritorio y móvil sin overflow. Evidencia temporal en `/tmp/ferraro-ux-fixes-evidence-20261019`. Detector mecánico de UI sin hallazgos.
- **Calidad adicional:** `domain:reconcile` sin diferencias y `git diff --check` verde. `format:check` sólo señala el formato preexistente de `tests/e2e/auth.spec.ts`, que no se modificó.
- **Entrega:** cambios de código locales y configuración S3 productiva preparada. No hubo push, merge, deployment, migraciones productivas ni alteraciones de clientes/presupuestos reales. Queda pendiente publicar y verificar el release para activar los cambios y las variables en producción.

## FIX — Agenda de 24 horas y scroll diario

- **Fecha:** 2026-10-19.
- **Causa:** la grilla diaria terminaba a las 20:00; un turno a esa hora se posicionaba al 100% de su altura y se recortaba por el contenedor. Los turnos posteriores quedaban fuera de la superficie.
- **Cambio:** día de 00:00 a 24:00, escala horaria uniforme y región con scroll vertical nativo y foco de teclado en escritorio. Abre a las 07:00 al cambiar de día y permite recorrer horarios anteriores/posteriores. Se reserva espacio inferior para las tarjetas de altura mínima cercanas a medianoche. Mobile mantiene la lista y el scroll de página.
- **Verificación:** lint y build con TypeScript verdes; 6/6 E2E de Agenda. La regresión crea un turno real a las 20:00, verifica rueda de mouse, Home/End, eventos a las 06:00, 23:45 y 23:55, apertura del detalle, continuidad después de medianoche, mobile, ausencia de overflow horizontal y axe sin violaciones. Capturas revisadas en `/tmp/ferraro-calendar-scroll-evidence`.
- **Alcance:** presentación y navegación de la agenda; sin migraciones, variables nuevas ni cambios en reglas de turnos, duración o solapamientos.

### 2026-10-19 — Borrado definitivo exclusivo de ADMIN

- Se incorporó `/app/admin/records`, con búsqueda/paginación para veinte tipos de registros, incluidos archivados, anulados y fotos retiradas; accesos contextuales desde los módulos principales.
- La server action y la transacción exigen ADMIN activo. Confirmación irreversible, errores recuperables y enlaces a dependencias. Borrado físico sin cascadas entre entidades comerciales.
- Compras/consumos retiran asientos y reversiones propios y ajustan stock con bloqueos y Decimal; se rechazan salidas sin stock suficiente. Se protege contra solicitudes concurrentes y resultados idempotentes eliminados. Trabajos reabren su turno; casos vacíos restituyen el presupuesto emitido.
- Migración `20261019160000_permanent_deletion_cleanup` aplicada en la base local aislada y Railway producción: agrega únicamente la cola durable para eliminar archivos. `storage:cleanup` reintenta pendientes, sin nuevas variables.
- Validación: lint, typecheck, build, formato de archivos modificados y diff sin errores; 63 pruebas unitarias, suite de integración y 14 casos específicos de borrado; conciliación local con cero diferencias; 38 E2E en una pasada final, incluido ADMIN/STAFF, confirmación/cancelación, dependencias, borrado real, accesibilidad y móvil. Se sincronizaron dos E2E existentes con el destino de navegación/título antes de interactuar o auditar.
