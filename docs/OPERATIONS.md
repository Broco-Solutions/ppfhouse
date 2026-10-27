# Ferraro Manager — Operations Runbook

Este runbook cubre la preparación y recuperación operativa de Ferraro Manager V1. No autoriza un deploy: producción requiere el gate humano definido en el Master Plan.

## Preflight de release

1. Usar Node 24, pnpm 11 y `pnpm install --frozen-lockfile`.
2. Validar variables con un build limpio; usar DB, bucket y secretos separados por ambiente.
3. Ejecutar `pnpm db:migrate:deploy` en preview sobre una copia/restauración reciente antes de producción.
4. Ejecutar `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm domain:reconcile` y `git diff --check`.
5. Verificar login ADMIN/STAFF, portal aislado, PDF, upload privado y `/api/health`.
6. Confirmar que el bucket no tenga acceso público y que CORS sólo acepte POST desde el origen de la app.

## Reanudación del release bloqueado

El release `2e029cafa85567edc7731de6e46f9983c3d919bd` está mergeado en `main`, pero el deployment de producción quedó `BLOCKED` por la atribución del committer `rcoirini@brocosolutions.com` en Vercel. No sortear este control modificando membresías, cuentas, integración Git, protección de deployments o infraestructura.

Cuando el acceso quede resuelto:

1. Comprobar que el committer/cuenta GitHub ya está admitido por Vercel.
2. Verificar que `main` contiene el código money + profitability en `2e029cafa85567edc7731de6e46f9983c3d919bd`.
3. Ejecutar o esperar el redeploy/latest deployment de `main` mediante la integración normal.
4. Verificar que el build termine correctamente y el deployment llegue a `READY`.
5. Verificar que el deployment ejecute `prisma migrate deploy` correctamente.
6. Confirmar que queden aplicadas estas migraciones: `20261010120000_money_profitability`, `20261010140000_money_consistency_constraints` y `20261010160000_direct_cost_consistency`.
7. Abrir `https://ferraro-manager.vercel.app` y comprobar que responde la versión nueva.
8. Hacer el smoke test de login ADMIN, dashboard, agenda, clientes, trabajos, finanzas, presupuestos, compras, inventario, USD/ARS, cotización ARS, costo directo, margen conocido y cobertura.
9. Revisar logs de build y runtime, además de errores 5xx.
10. Registrar el release como completado en `docs/EXECUTION_LOG.md` sólo después de confirmar todas las verificaciones.

El checkpoint quedó resuelto el 2026-10-10 mediante el deployment `dpl_4FCq5cKW2mWMBTLEZZM94wCTq7hd`, que llegó a `READY` y aplicó las tres migraciones en Railway. Si se retoma una nueva operación, conservar el procedimiento anterior para futuros releases y no volver a implementar la feature, recrear el merge, rehacer migraciones ni resetear `main`.

## Health y observabilidad

- Los PDF emitidos y las fotos comparten el adaptador privado. Vercel debe usar `STORAGE_DRIVER=s3`, con `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_BUCKET`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY` y `STORAGE_S3_FORCE_PATH_STYLE` según el proveedor. En Vercel el filesystem de la aplicación no es un destino persistente válido.
- Tras configurar storage, verificar escritura, lectura y borrado con un objeto de prueba de nombre único; luego crear un deployment nuevo para que reciba las variables. Las credenciales se almacenan como secretos y no se versionan.
- Una falla de emisión registra `quote_issue_failed` con identificador y código técnico; el detalle conserva una acción de reintento. El presupuesto sólo pasa a emitido después de guardar el PDF.

- `GET /api/health` comprueba conectividad de PostgreSQL y responde `200 {"status":"ok"}` o `503 {"status":"unavailable"}` sin revelar detalles.
- Configurar uptime externo sobre ese endpoint cada 1–5 minutos y alertar después de dos fallos consecutivos.
- Los eventos técnicos salen como JSON estructurado. No registrar contraseñas, tokens, URLs firmadas, contenido de fotos ni PII innecesaria.
- Centralizar logs y error tracking en el proveedor elegido antes de producción; alertar por errores 5xx sostenidos, fallos de auth anómalos y fallos de cleanup/reconciliación.
- Ejecutar `pnpm storage:cleanup` al menos diariamente. Sólo elimina intents no confirmados que llevan más de 24 horas expirados; nunca purga fotos confirmadas o borradas lógicamente.
- Ejecutar `pnpm domain:reconcile` diariamente y después de incidentes. Un exit code distinto de cero bloquea releases y requiere investigar ledger/materializados.

### Smoke test cliente → vehículo

- En `/app/calendar/new` y `/app/quotes/new`, buscar cliente por nombre, teléfono y email; confirmar que un cliente sin vehículo aparece y permite agregarlo inline.
- Crear un cliente con dos vehículos y comprobar que el turno/presupuesto conserva todo lo ya cargado. Repetir un teléfono o email existente y verificar que ofrece usar el cliente actual sin crear otro.
- Editar un turno directo sin downstream y reasignarlo; luego repetir sobre un caso con pago, quote aceptado o job y comprobar que la identidad queda bloqueada.
- En presupuesto USD y ARS, cambiar cantidad, precio, descuento de línea y descuento general. Confirmar subtotal − descuento general = total y equivalente USD para ARS; el servidor debe recalcular al guardar.
- Si `/app/quotes/new` cae en el error boundary, revisar primero volumen/latencia de las búsquedas server-side, respuestas 5xx y logs de Prisma. La carga inicial no debe volver a traer todos los clientes y vehículos al navegador.

## Backups

- PostgreSQL productivo debe ser administrado, con backups automáticos y point-in-time recovery. Default recomendado: retención mínima de 14 días.
- El bucket privado debe usar redundancia administrada y, si el proveedor lo permite, versionado o retención suficiente para cubrir borrados operativos accidentales.
- Backups de DB, storage y secretos son responsabilidades separadas. No guardar secretos dentro del backup de aplicación.
- Revisar mensualmente que backups y políticas estén activos. Un backup no se considera probado hasta restaurarlo.

## Restore drill

Ejecutar antes del primer deploy y trimestralmente, siempre en un ambiente aislado:

1. Crear una DB temporal vacía y restaurar el backup seleccionado según el proveedor.
2. Apuntar una instancia efímera de la app a esa DB y a una copia/namespace aislado del bucket.
3. Ejecutar `pnpm db:migrate:deploy`, `pnpm domain:reconcile` y `/api/health`.
4. Verificar login ADMIN, cliente/vehículo, un presupuesto/PDF, un trabajo con consumo, balances y una foto privada/publicada.
5. Registrar fecha, recovery point, duración, resultado y responsable; destruir el ambiente temporal de forma controlada.

Objetivos iniciales razonables para un negocio pequeño: RPO ≤ 24 h y RTO ≤ 8 h. El proveedor contratado puede mejorar estos valores, pero no deben prometerse sin un restore drill real.

## Migración y rollback

- Las migraciones son versionadas y sólo se aplican con `prisma migrate deploy`; nunca con `db push`.
- Money + profitability agrega `20261010120000_money_profitability`, `20261010140000_money_consistency_constraints` y `20261010160000_direct_cost_consistency`. Ejecutar `pnpm db:generate` y revisar/aplicar las tres con `pnpm db:migrate:deploy` primero en una base aislada de preview o copia restaurada. La primera agrega campos de origen/backfills compatibles: importes USD existentes se interpretan como USD, se copia el USD existente a `sourceAmount` donde aplica, la cotización queda `NULL` y `directCostUsd` queda `NULL`; no se crean cotizaciones ni costos históricos ficticios. La segunda añade checks de consistencia. La tercera conserva costo no imputado como cuatro `NULL`, exige igualdad origen/USD sin cotización para USD, e importe/cotización positiva para ARS; permite cero explícito y rechaza costos negativos. Confirmar con `pnpm prisma migrate status` que no queden migraciones pendientes, y probar la app anterior/nueva según la estrategia expand/contract antes de release.
- La auditoría del 2026-10-10 deja un advisory alto dev-only pendiente: `braces@3.0.3` (`GHSA-vfj7-8cjw-p6xm`) llega sólo por la cadena de lint de Next; `pnpm audit --prod` está limpio. No existe en npm la versión corregida `3.0.4` indicada por el advisory y el siguiente `eslint-config-next` conserva la misma cadena. Antes de cada release ejecutar `pnpm audit` y `pnpm audit --prod`; reevaluar al publicarse una corrección, sin instalar overrides no publicados.
- No se requiere ninguna variable de entorno nueva. La cotización ARS/USD se captura en cada operación/doc con moneda ARS; no hay FX externo.
- El rollback operativo consiste en volver al artifact de aplicación compatible y diagnosticar. No borrar columnas, reescribir `_prisma_migrations` ni revertir el backfill automáticamente: una reversión de esquema podría perder trazabilidad ya capturada. La recuperación de datos requiere backup/restauración aislada y decisión explícita.
- V1 usa cambios compatibles/expand-contract. Antes de migrar, confirmar backup recuperable y revisar el SQL.
- Si falla el deploy de aplicación pero la migración compatible ya fue aplicada, volver al artifact anterior y diagnosticar; no revertir datos a ciegas.
- Si una migración modifica datos de forma incorrecta, detener escrituras, preservar evidencia y restaurar en un ambiente aislado antes de decidir recuperación. No editar `_prisma_migrations` manualmente.
- Revertir objetos/storage mediante su mecanismo administrado; no borrar movimientos financieros o de stock para “acomodar” un rollback.

## Incidentes

1. Contener: deshabilitar la operación afectada o retirar el release sin alterar históricos.
2. Preservar: guardar logs, versión, timestamps y alcance sin copiar secretos.
3. Evaluar integridad con `pnpm domain:reconcile` y consultas de sólo lectura.
4. Recuperar usando compensaciones de dominio o restore validado; nunca modificar saldos silenciosamente.
5. Documentar causa, impacto y corrección en `docs/DECISIONS.md` sólo si cambia arquitectura, seguridad o fuentes de verdad.

## Rotación y acceso

- Rotar `BETTER_AUTH_SECRET`, credenciales DB y storage mediante el proveedor y una ventana controlada; cambiar el secreto de auth invalida sesiones activas.
- Usar credenciales de storage limitadas al bucket/prefijo de Ferraro y nunca compartirlas con PPF HOUSE.
- Mantener producción, preview y desarrollo completamente separados. PPF HOUSE no comparte repo, DB, bucket ni deployment.

## Borrado definitivo por ADMIN

Desde **Administración → Eliminar registros**, elegir módulo, buscar y confirmar. También hay accesos desde los detalles de clientes, vehículos, turnos, servicios, trabajos, compras, presupuestos e inventario. Los enlaces de dependencias llevan a los registros que deben eliminarse primero. Incluye archivados y anulados. Las cuentas de usuario siguen desactivándose desde Usuarios.

El borrado de compras/consumos retira sus movimientos y reversiones en una transacción, actualiza stock y bloquea resultados negativos. No eliminar un asiento de compra/consumo por separado: el mensaje enlaza a su origen. Para comprobar integridad, ejecutar `pnpm domain:reconcile`.

La migración compatible `20261019160000_permanent_deletion_cleanup` sólo añade una cola de archivos privados pendientes. No requiere variables nuevas. `pnpm storage:cleanup`, ya incluido en la rutina diaria, procesa ahora esa cola además de uploads vencidos. El borrado de datos se confirma aunque el storage esté caído; los archivos pendientes se reintentan con ese comando. Un rollback de aplicación no recupera registros eliminados: para eso se necesita el procedimiento de restauración de backup.
