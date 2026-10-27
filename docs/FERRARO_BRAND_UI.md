# Ferraro Brand UI

> Fuente de implementación del frontend Ferraro. El manual oficial sigue siendo la autoridad visual; este documento registra su traducción digital verificable.

## Fuente y procedencia

- Fuente maestra: `docs/brand/source/FERRARO_manual_marca.pdf`.
- SHA-256: `efe1227d30607fc00f90dc8c5fa9374eeabcb0b23951ae68b9afd516aad97251`.
- Origen detectado: PDF 1.6 de 5 páginas exportado por Adobe Illustrator; conserva paths vectoriales.
- Extracción: PDF.js sobre el contenido vectorial, aislamiento por bounding box y matriz de transformación. No se utilizó autotrace ni reconstrucción tipográfica.
- Validación: comparación óptica contra las cinco páginas rasterizadas del manual, revisión de `viewBox`, paths, proporción, color y legibilidad.
- Derechos: activos propietarios de Ferraro, autorizados para Ferraro Manager. No son un paquete público ni reutilizable por PPF House.

## Activos oficiales

El manifiesto legible por tooling vive en `public/brand/manifest.json` y registra checksum individual.

| Asset                                | Uso                                                                | Fuente        |
| ------------------------------------ | ------------------------------------------------------------------ | ------------- |
| `ferraro-lockup-detail-tricolor.svg` | Login, portal y firma institucional clara                          | Página 3      |
| `ferraro-lockup-detail-black.svg`    | PDF e impresión sobre blanco                                       | Página 4      |
| `ferraro-logo-tricolor.svg`          | Superficie clara con presencia institucional                       | Página 3      |
| `ferraro-logo-black.svg`             | UI clara compacta                                                  | Página 4      |
| `ferraro-logo-white.svg`             | Shell y fondos oscuros; geometría oficial de la variante monocroma | Páginas 2 y 4 |
| `ferraro-logo-outline.svg`           | Recurso decorativo de baja frecuencia                              | Página 5      |
| `ferraro-mark-tricolor.svg`          | App icon y acento institucional claro                              | Página 3      |
| `ferraro-mark-outline.svg`           | Navegación compacta monocroma                                      | Páginas 1 y 4 |

Reglas: no deformar, inclinar, sombrear, separar letras, reconstruir el wordmark con una fuente web ni aplicar colores de módulo. El área de exclusión mínima provisional es el ancho del isotipo. El descriptor `DETAIL` exige al menos 160 px de ancho óptico; debajo se usa logo sin descriptor. El logo compacto exige 110 px y el isotipo se usa entre 20 y 64 px según contexto.

## Color

Núcleo de marca aprobado para digital:

- `#000000` negro.
- `#706F6F` gris.
- `#FFCE13` amarillo.
- `#FFFFFF` blanco.

Contrastes medidos: negro/blanco 21.00:1; negro/amarillo 14.09:1; blanco/gris 5.01:1. Negro/gris es 4.19:1 y no se usa como combinación de texto normal que requiera 4.5:1. El amarillo nunca recibe texto blanco y no representa por sí mismo `warning`.

Los tonos derivados viven como tokens semánticos. Primitives y módulos no consumen hex de marca directamente.

## Tipografía e iconografía

- Familia aprobada: Inter Variable 5.3.0, subset latino, una sola familia, números tabulares y carga local mediante `next/font/local`.
- Inter e IBM Plex Sans se compararon lado a lado con copy de login/dashboard, vehículo, estados, montos y tabla densa. No apareció una mejora clara con IBM Plex: Inter preservó el carácter sobrio, una fila 1 px más compacta y una lectura más neutral. Evidencia privada: `/tmp/ferraro-redesign-evidence/fe01/type-comparison.png`.
- Los WOFF2 y su licencia OFL viven en `src/design-system/fonts`; checksums SHA-256: normal `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`, italic `7291b5970da2237441273c03b424a504b70b18f09791473fab99687dcc314720`.
- Wordmark: siempre SVG oficial; nunca texto Inter/IBM Plex.
- Iconografía: Phosphor por defecto, imports individuales. Lucide sólo reemplaza la elección completa si el spike demuestra una desventaja real de bundle, SSR o accesibilidad.

En FE-02 Phosphor Icons 2.1.10 quedó aprobado como único set. Se usan imports `dist/ssr` en Server Components y el entrypoint cliente sólo en boundaries interactivos. La muestra real de acciones/estados produjo un chunk cliente de 28.770 bytes sin comprimir y no mostró problemas SSR; Lucide 1.54.0 no ofreció una mejora que justificara perder las variantes de peso de Phosphor.

## Foundations y tokens

- Fuente única: `src/design-system/tokens.css`; las capas se ordenan como `reset`, `tokens`, `base`, `components`, `patterns`, `modules`, `utilities` y `overrides`.
- Namespaces: `--brand-*`, superficies/foreground/border, interacción, estados, tipografía, spacing, geometría, controles, layout, z-index y motion.
- Breakpoints de referencia: 30, 48, 64 y 80 rem. Gutters: 1 rem mobile, 1.5 rem tablet y 2 rem desktop. Anchos de contenido: 45, 76 y 90 rem.
- Targets interactivos parten de 44 px. El foco claro usa `#6B5500` con 6.52:1 sobre canvas; el amarillo oficial se reserva como acento complementario.
- Aliases `--color-*` sostienen únicamente selectores heredados durante la migración. Componentes nuevos consumen tokens semánticos y FE-14 elimina aliases sin referencias.

Contrastes verificados en FE-01: foreground/canvas 16.03:1; muted/canvas 5.80:1; blanco/gris 5.01:1; success 6.47:1; warning 6.60:1; danger 6.12:1; info 6.37:1 sobre sus superficies.

## Componentes y patrones

Contratos de producción disponibles desde FE-02:

- Marca: `BrandLogo`, `BrandMark`, `BrandLockup`; encapsulan activos oficiales, variantes y mínimos.
- Controles: `Button`, `IconButton`, `Field`, `FieldError`, `Input`, `Textarea`, `Select`, `Choice`.
- Estado: `Badge`, `Alert`, `Spinner`, `Skeleton`, `EmptyState`.
- Superficie: `Card` flat/raised/interactive.
- Overlays: `Dialog`, `Drawer`, `Tooltip` integrado en `IconButton` y `ConfirmDialog`, respaldados por React Aria Components 1.22.1.
- Página/form: `Page`, `PageHeader`, `SectionHeader`, `DetailHeader`, `DataToolbar`, `FormSection`, `FormGrid`, `FormActions`.

Los controles nativos preservan semantics y autocompletado. React Aria se limita a interacción compleja. El catálogo vivo `/app/design-system` es ADMIN-only, importa los componentes productivos y muestra estados idle/loading/disabled/error, responsive y overlays; no es una implementación paralela.

## Shell y navegación

- Desktop amplio: sidebar grafito de 280 px con logo oficial inverso, grupos Operación/Comercial/Insumos/Administración, activo con superficie + línea amarilla + `aria-current`, cuenta y salida.
- Desktop compacto: 72 px, isotipo oficial, labels accesibles y tooltip por foco; preferencia persistida localmente sin afectar autorización.
- Tablet 768–1024: compacto forzado para preservar ancho operativo.
- Mobile: header claro con logo oficial, búsqueda y drawer; barra inferior de cinco destinos operativos con icono, texto y activo no dependiente sólo del color.
- Contenido: ancho máximo 90 rem, gutters responsive, topbar de búsqueda sticky, breadcrumbs semánticos y skip link al `main`.

El mapa de iconos usa exclusivamente Phosphor regular/bold en cajas ópticas de 20–24 px. La navegación se filtra en servidor mediante `getNavigationForRole`; CSS nunca oculta una capacidad como mecanismo de seguridad.

## Acceso y estados globales

- Login desktop: composición editorial 45/55, panel grafito con geometría derivada del isotipo, lockup FERRARO DETAIL oficial sobre placa blanca y formulario claro sin fotografía genérica.
- Login tablet: conserva ambas regiones mientras cada columna mantiene ancho usable; mobile usa un formulario único con lockup oficial, foco inicial en Email y controles de 48 px.
- Auth: mismo Better Auth, mismos nombres/autocomplete, sin signup/reset/social. Loading localizado, error live y valores preservados.
- Estados: `StatePage` unifica error recuperable/global, 403 y 404 con isotipo, código, heading, explicación y acción segura; no revela contenido protegido.
- Loading/toast: skeleton estructural con `aria-busy` y `ToastRegion` live, dismissible y fuera de la navegación de foco automática.

El amarillo aparece como señal institucional y línea de composición. Sobre superficie clara, labels pequeños usan `--focus-ring` (6.52:1), no el amarillo oficial de 1.35:1.

## Dashboard operativo

- La operación de hoy ocupa la primera lectura después del encabezado y de los accesos rápidos: turno, hora, vehículo, cliente y servicio forman una sola fila accionable.
- El estado vacío conserva estructura y una siguiente acción clara; no se rellena la pantalla con métricas o gráficos sin utilidad operativa.

## MoneyField y datos monetarios

`src/modules/money/ui/money-field.tsx` implementa el patrón compartido para importes de finanzas, presupuestos, compras y costo directo del caso. El campo conserva el lenguaje visual de `Field`, `Input` y `Select` existentes; USD es el valor inicial. Cambiar a ARS revela la cotización manual, siempre rotulada “ARS por USD”, y una ayuda de equivalente aproximado en USD. Cambiar a USD oculta la cotización. El componente presenta preview solamente: el servidor valida y calcula el monto canónico con Decimal.

El label permanece asociado al input/select, las descripciones y errores usan IDs accesibles y el equivalente se anuncia como ayuda sin depender del color. La composición fluye a una columna en mobile y permite el ancho extra de importes ARS; en desktop/tablet conserva la grilla del formulario. Para presupuestos y compras la moneda aplica al documento completo. Una selección ARS mantiene visibles origen, cotización y equivalente donde aportan trazabilidad; en documentos PDF se expresa la moneda efectivamente ofertada.

En el caso de servicio, el costo directo es opcional. La UI distingue “Sin imputar” (null) de un cero conocido y sólo ADMIN ve el costo y el margen. Margen positivo/negativo se acompaña de texto y monto con signo, no sólo color. Los agregados usan “Margen conocido” y “Cobertura de costos”; no se muestran como resultado neto.

- ADMIN recibe un bloque financiero separado. Flujo neto usa la única superficie oscura del conjunto y es el KPI dominante; cobrado, egresos, cantidad de trabajos y saldo pendiente quedan subordinados.
- STAFF comparte agenda, trabajos y stock, pero el servidor no le entrega KPIs, seguimientos comerciales ni accesos administrativos.
- Desktop usa una grilla 2:1 para la jornada y mosaicos financieros; tablet colapsa la jornada a una columna y mantiene datos escaneables; mobile omite finanzas por rol y usa listas verticales con acciones rápidas en scroll horizontal.
- DashboardSection, Kpi y DashboardEmpty son patrones locales del módulo: consumen tokens y primitives compartidos, pero no se promueven a componentes genéricos hasta existir un segundo consumidor real.

Evidencia FE-05: `/tmp/ferraro-redesign-evidence/fe05`, seis viewports obligatorios combinados entre ADMIN y STAFF, sin overflow y con axe WCAG A/AA en cero violations.

## Agenda temporal

- Día desktop representa las 24 horas con altura proporcional y scroll vertical interno accesible por mouse y teclado; abre a las 07:00 y permite recorrer horarios anteriores y posteriores. Los eventos cercanos a medianoche conservan espacio para su altura mínima. Los carriles son sólo de layout; duración y solapes continúan definidos por los timestamps existentes. En mobile se conserva la lista cronológica con scroll de página.
- Semana mantiene siete columnas con ancho mínimo y scroll/snap en tablet. Mobile muestra el día elegido como lista cronológica y no reduce la semana a columnas ilegibles.
- Mes siempre muestra seis semanas completas, días externos atenuados, encabezados lunes–domingo, tres eventos resumidos y contador `+N`. En mobile se presenta el día elegido.
- Confirmado, realizado, cancelado y bloqueo difieren por texto, icono, borde/forma y color. El bloqueo usa trama y confirmación accesible; no se interpreta el amarillo como warning.
- Toolbar conserva anterior/siguiente/hoy, input nativo de fecha y vista en URL. La página de detalle continúa siendo la fuente de verdad; no existe edición en drawer.
- Formularios nativos usan secciones editoriales, targets de 44–48 px, una columna mobile y acciones dentro del flujo para no superponerse con la navegación inferior.

Evidencia FE-06: `/tmp/ferraro-redesign-evidence/fe06`, baseline y ocho capturas finales con vacío, solape, multidía, bloqueo y tres estados. Axe WCAG A/AA sin violations, 200% efectivo sin overflow y reduced motion verificado.

## Picker cliente y vehículo

- Agenda y Presupuestos reutilizan `ClientVehiclePicker`: dos combobox React Aria con teclado, foco visible, loading, error y vacíos explícitos. Cliente consulta como máximo 20 resultados server-side después de un debounce corto; vehículo depende siempre del cliente activo seleccionado.
- Un cliente sin garage sigue siendo seleccionable y muestra “Este cliente todavía no tiene vehículos” con la acción inline correspondiente. Cambiar de cliente limpia inmediatamente el vehículo previo; un único vehículo activo puede autoseleccionarse.
- Quick create usa un dialog centrado en desktop y sheet inferior en mobile, conserva el formulario que queda detrás y devuelve el foco. Permite cliente más varios vehículos, o sólo un vehículo para el cliente actual. Los errores enfocan el primer control inválido.
- Coincidencias fuertes por teléfono normalizado o email bloquean el alta y ofrecen usar el registro existente. Nombres equivalentes sin acentos/case sólo sugieren porque pueden existir homónimos.
- La edición de turno muestra el mismo picker sólo mientras el caso directo carezca de historia comercial. Cuando está bloqueada conserva la identidad como lectura y explica la protección del historial.

## Relaciones, garage y catálogo

- La lista de clientes es una secuencia plana, no una grilla de cards: nombre/contacto domina, garage resume vehículos reales y estado/acción cierran la fila. En mobile se recompone en dos niveles.
- La ficha ordena contacto y estado → garage → alta de vehículo → historial → contenido ADMIN. No usa iniciales ni siluetas genéricas como identidad del vehículo; marca, modelo, versión, año y color son la identidad.
- Vehículos activos/archivados comparten estructura y difieren por label, contraste y acción explícita. Los textos largos envuelven sin desplazar controles.
- Catálogo ADMIN agrupa por categoría con divisores editoriales. Cada fila comunica descripción, duración, variantes, precio/a cotizar y estado sin convertir cada servicio en una card independiente.
- Variantes exponen segmento o excepción exacta marca/modelo y prioridad, sin ocultar reglas de pricing. STAFF no accede al catálogo ni a precios.
- Formularios de clientes, vehículos y servicios reutilizan `Field`, controles nativos, `FormSection`, `FormGrid` y `FormActions`; errores están asociados mediante `aria-describedby` y la acción mobile permanece en el flujo para no competir con la barra inferior.

Evidencia FE-07: `/tmp/ferraro-redesign-evidence/fe07`, seis baselines y nueve capturas finales con estados llenos/vacíos/filtrados/archivados, duplicado sugerido y textos largos; axe A/AA sin violations.

## Trabajos, trazabilidad y media

- La lista de trabajos usa una secuencia editorial densa: fecha, vehículo/cliente, servicios snapshot y estado forman una única entrada. En mobile se recompone, nunca se convierte en una cuadrícula de cards.
- El detalle sigue el orden operativo identidad → origen/estado/equipo → servicios → notas → consumos → fotos → anulación. Los snapshots y movimientos conservan su naturaleza histórica; la UI no los presenta como datos editables normales.
- Consumos activos, corregidos y anulados muestran label e icono además de color. La corrección continúa creando movimientos compensatorios; la presentación no oculta el registro reemplazado.
- La galería usa 4 columnas amplias, 3 intermedias, 2 tablet y 1 mobile. Cada foto exhibe portada y privacidad, incluye controles con nombre accesible y abre un lightbox React Aria con focus trap, Escape y retorno de foco.
- Fotos nuevas permanecen privadas. Publicar al cliente es una acción explícita; thumbnail y preview se solicitan por endpoints autorizados y nunca se exponen object keys ni URLs firmadas en el markup.
- El uploader conserva validación MIME/tamaño, progreso live, retry y procesamiento de variantes existentes. La UI muestra queue local, pero no introduce edición, before/after automático ni procesamiento nuevo.

Evidencia FE-08: `/tmp/ferraro-redesign-evidence/fe08`, seis baselines y seis capturas finales; E2E local cubre upload, acceso anónimo 401, publicación, corrección de consumo, lightbox y axe sin violations. La persistencia cloud continúa pendiente hasta existir storage Preview aislado.

## Presupuestos y documento A4

- La lista es una secuencia de propuestas con número/fecha, cliente/vehículo, total y estado. Borrador, enviado, aceptado, rechazado y vencido tienen texto/icono y semántica propia.
- El editor reserva una columna oscura para subtotal, descuento general y total en desktop; en tablet/mobile el resumen vuelve al flujo. El descuento general permanece editable, se explica como una única resta sobre el subtotal y no reemplaza los descuentos por línea. Separador, jerarquía y amarillo controlado hacen dominante el total. Los montos se presentan con locale `es-AR`; el valor visual es orientativo y el servidor conserva el recálculo Decimal autoritativo.
- El detalle adopta una hoja clara con regla amarilla controlada, identidades, líneas y total. Las acciones de emitir/aceptar/rechazar/duplicar/agendar permanecen fuera de la hoja y explican su impacto.
- El PDF usa A4 blanco, una regla amarilla, negro/gris oficiales, Inter Variable embebida y el lockup FERRARO DETAIL vectorial oficial. El logo no se reconstruye con texto ni se rasteriza; sus paths son los del asset verificado.
- Encabezado, cabecera de tabla, footer y paginación soportan multipágina. La información comercial sigue siendo texto extraíble y legible en impresión en grises.

Evidencia FE-09: `/tmp/ferraro-redesign-evidence/fe09/final`; incluye UI en seis viewports, PDF, raster color/grises y texto extraído. El TTF embebido tiene SHA-256 `4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf`.

## Finanzas y saldos

- Finanzas es ADMIN-only y usa densidad de ledger, no un dashboard de cards. Flujo neto es el dato principal; entradas y salidas aportan contexto con signo, label y color semántico.
- Cada movimiento conserva tipo, caso/categoría, fecha, monto firmado, vínculo al saldo y reversión. Revertir siempre abre confirmación y crea compensación; nunca aparenta borrar historia.
- El caso separa importe acordado, cobrado neto y saldo pendiente/a favor. “Importe por definir” y “No calculable” son estados explícitos, no ceros decorativos.
- Desktop presenta tres KPIs/columnas; tablet usa 2+1 y mobile una secuencia. El ledger recompone monto/acción sin truncar cliente ni motivo.
- Los montos usan cifras tabulares. Verde/rojo nunca son la única señal: signo, dirección, tipo y texto acompañan todos los valores.

Evidencia FE-10: `/tmp/ferraro-redesign-evidence/fe10`, seis baselines y seis capturas finales; axe sin violations y denial STAFF verificado en navegación y ruta.

## Inventario y abastecimiento

- Inventario prioriza nombre/categoría/SKU, stock actual+unidad, mínimo y estado. Disponible, bajo y agotado se comunican con texto/icono y no con color aislado.
- ADMIN recibe categorías, artículo, costo, ajustes y presentaciones. STAFF recibe la proyección operativa de cantidad/movimientos, sin costos ni acciones de configuración.
- Compras es ADMIN-only. La lista concentra número/proveedor/fecha, ítems, total y estado; el detalle explica cantidad comprada, costo unitario, factor snapshot y cantidad base que impactó stock.
- El bloque de integridad hace visible que inventario y caja tienen movimientos vinculados. Anular conserva la compra y compensa ambos lados; el conflicto por stock consumido conserva su explicación específica.
- Las filas prioritarias se recomponen en dos columnas mobile. No se usan imágenes genéricas de producto ni se inventan forecast, recepción parcial o nuevas unidades.

Evidencia FE-11: `/tmp/ferraro-redesign-evidence/fe11`, seis baselines y seis capturas finales; axe sin violations, proyección STAFF y denial de Compras verificados.

## Búsqueda, administración y portal privado

- Búsqueda agrupa clientes, vehículos, trabajos, servicios y presupuestos en secciones planas de dos columnas/una mobile. El total y los grupos se derivan de la proyección server-side del rol.
- Administración enumera sólo control de acceso y catálogo visual, las capacidades realmente existentes. No promete usuarios, auditoría o settings no implementados.
- El portal no replica el dashboard: usa una página editorial mobile-first con lockup FERRARO DETAIL, saludo, garage oscuro, próximos turnos, historial y fotos publicadas.
- Vehículos se identifican por marca/modelo/datos reales, sin iniciales decorativas ni stock photography. Fotos abren en lightbox accesible y siguen pasando por endpoints portal autorizados.
- Link inválido/revocado, password, empty y full comparten marco de marca. El documento usa `noindex`, `no-store` y `no-referrer`; ninguna nota interna, precio, URL firmada u object key aparece en la proyección.
- El gestor ADMIN muestra protección, vencimiento y último acceso; crear/regenerar/revocar son acciones explícitas. Revocar usa `ConfirmDialog`, no confirmación nativa.

Evidencia FE-12: `/tmp/ferraro-redesign-evidence/fe12`, seis baselines y seis finales. Aislamiento adversarial, headers, password, regeneración, revocación, foto 401 anónima, axe y Escape verificados localmente.

## Hardening responsive y accesible

- Matriz cerrada: 1440×900, 1280×800, 1024×768, 820×1180, 768×1024 y 390×844 para ADMIN/STAFF, más portal en los seis tamaños.
- Reflow a 200% se valida a 640 CSS px con DPR 2; no existe overflow del documento. Scroll horizontal queda reservado al canvas semanal de agenda y a acciones rápidas explícitas.
- `prefers-reduced-motion: reduce` desactiva transiciones/animaciones no esenciales. No se añadieron animaciones decorativas.
- Teclado: skip link, foco visible, Ctrl/Cmd+K, navegación, fecha/vistas, Dialog/Drawer/Confirm/Lightbox con Escape y retorno, y formularios nativos.
- Ningún estado depende sólo de color. Badges usan icono/texto, movimientos usan signo/tipo, agenda usa forma/icono/texto y foco supera contraste AA.
- El crawl local de 36 combinaciones registra título presente, cero overflow, cero page errors y cero 5xx. Axe final registra cero violations en todas las superficies representativas.

Evidencia FE-13: `/tmp/ferraro-redesign-evidence/fe13/final`, incluyendo `crawl-report.json`, capturas por rol/viewport y zoom 200%.

## Geometría y tono

La UI deriva del isotipo su ritmo vertical y división en tres, sin convertirlos en patrón ornamental repetitivo. El shell es grafito y el área de trabajo clara. La identidad proviene de activo, tipografía, alineación, ritmo y detalle; el amarillo se reserva para marca, foco y selección controlada.

## Baseline FE-00

- 39 rutas `page.tsx`, 9 estados `loading.tsx`, 247 selectores globales de primer nivel y 3 componentes transversales previos al rediseño.
- 18 capturas locales privadas: login, dashboard ADMIN y dashboard STAFF en 1440×900, 1280×800, 1024×768, 820×1180, 768×1024 y 390×844.
- Ubicación local: `/tmp/ferraro-redesign-evidence/fe00` (no versionada, datos E2E sintéticos).
- Baseline técnico: lint y typecheck verdes; 35 unit y 42 integración verdes; build Next.js verde.
- Baseline de permisos: STAFF no recibe el resumen financiero; no hubo overflow horizontal a 390 px.

## Arquitectura y portabilidad

Ferraro conserva ownership de assets y composición institucional. Los primitives sólo consumen contratos semánticos. Para PPF House se sustituyen manifiesto, `brand.config`, tokens, fuente, login y slots de PDF; no se copian assets Ferraro, auth, DB, storage ni datos.

### Ownership

- `public/brand/` y su manifiesto pertenecen a Ferraro; ningún primitive importa un SVG por ruta directa fuera de `BrandLogo`, `BrandMark` o `BrandLockup`.
- `src/config/brand.ts` concentra nombre, copy institucional, location, assets y configuración documental.
- `src/design-system/tokens.css` posee contratos semánticos. Los componentes consumen `--foreground`, `--surface-*`, `--primary`, estados, spacing y geometría; no “amarillo Ferraro” como dependencia funcional.
- `src/components/ui/` y `src/components/patterns/` son portables. Los módulos de dominio, auth, permisos, DB, storage y datos no forman parte del paquete visual.
- CSS Modules pertenecen a su superficie. `globals.css` conserva únicamente foundations/compatibilidad para formularios y details aún compartidos; FE-14 retiró 941 líneas muertas verificadas.

### Swap controlado a PPF House

1. Reemplazar `public/brand/manifest.json` y activos con paths oficiales propios, preservando los contratos de `Brand*`.
2. Crear configuración PPF House equivalente a `brand.ts`; reemplazar nombre, location, copy y metadata sin bifurcar primitives.
3. Sustituir tokens `--brand-*`, tipografía local/licencia/manifiesto y validar contrastes semánticos AA.
4. Rediseñar únicamente slots de marca en login, shell, portal y PDF. No copiar geometría/lockup Ferraro ni hardcodear PPF House en primitives.
5. Repetir gates: catálogo 1440/768/390, shell por rol, seis viewports, axe, 200%, reduced motion, PDF color/grises y portal adversarial.
6. Mantener repositorio/infra/auth/DB/storage separados. Esta guía porta el sistema visual, no convierte el producto en multiempresa ni runtime theming.

### Artefactos y licencias

- Checksums de SVG oficiales: `public/brand/manifest.json`.
- Checksums/licencia de Inter WOFF2/TTF: `src/design-system/fonts/manifest.json` y `OFL-Inter.txt`.
- Baselines visuales: artifacts privados `/tmp/ferraro-redesign-evidence`, retención objetivo 14 días; no se versionan imágenes.

## Deuda y evidencia pendiente

- Preview cloud aislada, DB preview, Better Auth preview y storage persistente todavía no están disponibles/verificados en esta ejecución.
- Las capturas de Playwright permanecen como artifacts privados con retención objetivo de 14 días; no se versionan.
- La validación de persistencia remota de fotos en FE-08/FE-12 quedará explícitamente pendiente si no se provisiona storage preview aislado.
- Catorce aliases `--color-*` sostienen formularios y details globales todavía compartidos. No tienen usos nuevos y deben retirarse módulo por módulo cuando esas superficies migren; eliminarlos masivamente en FE-14 habría elevado riesgo sin valor visual.
