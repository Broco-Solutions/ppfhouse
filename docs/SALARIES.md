# Sueldos mensuales

Disponible para ADMIN en **Finanzas → Sueldos**. Las personas se cargan por nombre y no necesitan usuario en la aplicación.

## Uso

1. **Agregar sueldo:** nombre, importe mensual en USD y mes de inicio. Un inicio anterior genera también las obligaciones pendientes hasta el mes actual.
2. **Ajustar:** elegir “Solo este mes” para una excepción o “Desde este mes en adelante” para cambiar la base recurrente. El aumento permanente reemplaza también cualquier aumento futuro programado y las obligaciones pendientes posteriores; conserva los meses pagados y anulados. Desde el detalle se puede programar un aumento para el próximo mes.
3. **Registrar pago:** fecha/hora y medio de pago. Se paga el importe completo; ajustar primero si corresponde.
4. **Corregir pago:** revertir con motivo desde el detalle o desde Finanzas. La compensación se registra en caja y el mes vuelve a pendiente, permitiendo corregirlo y pagarlo nuevamente.
5. **Dejar de repetir:** indicar el último mes a incluir, desde el actual en adelante. No elimina obligaciones ni pagos existentes. Una carga mensual errónea pendiente puede anularse por separado con motivo; la anulación no detiene la recurrencia.

Los importes aceptan coma o punto decimal, sin separadores de miles. No se calculan recibos, liquidaciones laborales, cargas sociales, aguinaldo, adelantos ni pagos parciales.

## Indicadores

- Los totales de Sueldos corresponden al **mes del sueldo** y se expresan en USD. Las cargas anuladas se excluyen.
- El aviso de deudas anteriores abre una lista de todos los pendientes hasta el mes seleccionado.
- Inicio y Finanzas muestran los pendientes acumulados hasta el mes actual, en USD, incluyendo meses anteriores.
- El pago genera un único `FinancialEntry` de tipo `SALARY_PAYMENT`, con origen USD, sin conversión ni cotización. Impacta egresos y flujo neto en la **fecha efectiva del pago**, aunque el sueldo corresponda a otro mes.
- Los pendientes no descuentan caja. “Margen conocido” conserva su cálculo por caso y costos directos.
- Las reversiones usan el ledger compensatorio existente. Un reintento del pago original después de revertirlo no genera otro pago; se debe abrir un nuevo formulario.

## Operación técnica

`Salary` define la recurrencia y su versión para detectar formularios desactualizados. `SalaryRate` guarda importes con vigencia mensual. `SalaryMonth` conserva el importe y estado independiente de cada mes. `SalaryEvent` registra cambios, autor y fecha. El pago activo se vincula al ledger y sus reversiones conservan la referencia al mes.

La generación es idempotente, recupera meses omitidos y se ejecuta al consultar Sueldos o los indicadores administrativos. No requiere cron ni variables de entorno adicionales. Usa la zona horaria de Buenos Aires y transacciones con bloqueo por sueldo para coordinar generación, ajustes, pagos y reversiones. La doble carga del alta y del pago se protege además por clave de idempotencia.

Despliegue: ejecutar `pnpm db:generate`, `pnpm db:migrate:deploy` y construir la aplicación antes de habilitar la nueva versión. La migración `20261020150000_salaries` es aditiva y no convierte ni modifica egresos manuales históricos. Los sueldos que ya se hayan registrado manualmente deben revisarse antes de cargar sus pagos en este módulo para evitar duplicar caja.

Pruebas específicas: `tests/unit/salary-schema.test.ts`, `tests/unit/salary-actions.test.ts`, `tests/integration/salaries.test.ts` y `tests/e2e/salaries.spec.ts`. Las pruebas de integración y E2E requieren una base local con las migraciones aplicadas; no deben ejecutarse sobre producción.

## Moneda de sueldos (2026-10-21)

Los empleados cobran en USD: alta, aumentos, obligaciones mensuales, pagos, historial y pendientes utilizan USD. Un sueldo de USD 850 genera un pago y un egreso de USD 850, sin pedir cotización. El resto de Finanzas conserva sus opciones de moneda.

La migración `20261021000000_salary_usd` actualiza el contrato de pagos a USD. Se verificó que producción no tenía sueldos, meses ni pagos antes de este cambio. La migración vuelve a comprobarlo y se detiene si aparecieron registros, para exigir una revisión explícita en lugar de reinterpretar pesos como dólares. No modifica el ledger. Los nombres físicos anteriores de las columnas se conservan para compatibilidad durante el despliegue; Prisma los expone como `amountUsd` mediante `@map`.
