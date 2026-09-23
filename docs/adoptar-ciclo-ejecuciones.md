# Adoptar el Ciclo de Ejecuciones en un producto derivado

Guía de proceso para traer la capacidad de la spec 016 a un producto que ya
existe (US3/FR-011). Contrato técnico:
`specs/016-ciclo-ejecuciones-workers/contracts/adopcion-reconciliacion.md`.

## 0. Prerrequisitos

El producto conserva los mecanismos del template que esta capacidad
reutiliza: organizaciones, `conexiones`, RLS, roles `worker_<org>`, Vault y
rol `kestra_orquestacion` (specs 013/014). Si el fork modificó alguno,
reconciliarlo primero — las funciones nuevas no calzan sin ellos.

## 1. Comparar antes de migrar

En el Supabase local del producto, relevar:

- ¿Existe una tabla propia de historial/ejecuciones? Anotar nombre y
  columnas y mapearlas a `capacidades_ejecucion` / `ejecuciones_worker`
  (`specs/016-ciclo-ejecuciones-workers/data-model.md`). Si los nombres o
  firmas no coinciden, el mapeo queda documentado acá abajo: **no hay
  renombre automático** (FR-011).
- ¿Cómo guarda evidencia hoy (Storage, disco del worker, nada)? Definir el
  mapeo a `evidencias-ejecuciones/<organizacion_id>/<capacidad>/
  <ejecucion_id>/`.
- ¿Sus flows llaman ya a `iniciar`/`cerrar` con otra firma? Adaptar el orden
  de llamadas al contrato, sin tocar la lógica de dominio del flow.

## 2. Migrar (solo aditivo)

1. Copiar `supabase/migrations/20260920000000_ciclo_ejecuciones_workers.sql`
   al producto tal cual.
2. Ejecutar las pruebas: `pnpm test` (incluye
   `supabase/tests/database/ciclo_ejecuciones_workers.test.sql`).
3. Registrar la versión de origen:
   `select registrar_adopcion_ciclo('016');`
4. Verificar: `select version from adopciones_template;` y cero
   tablas/historiales duplicados (SC-005).

## 3. Reglas de reconciliación

- Permitido: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  backfill de `tiempo_max_seg` / `habilitada`, creación del bucket si falta,
  grants a roles `worker_*` ya existentes (mismo `format(...)` de la
  migración).
- Prohibido en el mismo PR: `DROP`/`RENAME` de columnas o tablas, borrado
  de historial, traslado de automatizaciones o tablas de dominio al template
  (FR-011, Technology Gates).
- La tabla de dominio del producto no se toca: ni se migra, ni se renombra,
  ni se mueve al template.

## 3.1 Despacho durable (spec 019)

Cuando el producto adopte la outbox de ejecuciones, debe crear la orden en la
misma transacción que la ejecución y hacer que Kestra la reclame mediante el
contrato de `specs/019-outbox-ejecuciones/contracts/despacho-outbox.md`.
No debe conservar ni crear un trigger SQL que envíe HTTP, use `pg_net` o lea
una URL de webhook para despachar un worker. La primera adopción se valida con
un disparo manual recuperable antes de migrar schedules.

## 4. Mapeo de este producto

_(Completar al adoptar: tabla propia → tabla del template, columna por
columna, y decisión de evidencia.)_

- Historial propio: —
- Capacidades propias → `capacidades_ejecucion`: —
- Evidencia actual → bucket `evidencias-ejecuciones`: —
- Diferencias incompatibles y cómo se resolvieron sin renombre automático: —
