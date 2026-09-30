# Modelo de datos: Conexiones OAuth de plataforma vía Nango

Todas las tablas viven en `public` (mismo criterio que `conexiones`,
`servidores_organizacion`, etc. — spec 013: `private` es inalcanzable por
PostgREST, así que toda función que Refine llame directo vive en `public`).
Ninguna guarda un token ni un secreto de proveedor: eso queda en `nango-db`,
fuera de Supabase.

## `integraciones_oauth`

Catálogo de plataforma: qué proveedores OAuth están dados de alta en el motor
de autenticación compartido (Nango) y disponibles para que un producto
derivado los ofrezca a sus organizaciones.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()`. |
| `clave` | `text` UNIQUE NOT NULL | `provider_config_key` de Nango, p. ej. `google`. |
| `nombre` | `text` NOT NULL | Nombre visible, p. ej. "Google". |
| `habilitada` | `boolean` NOT NULL DEFAULT `true` | Si es `false`, ninguna organización puede iniciar una conexión nueva (no afecta conexiones ya activas). |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

- **Alta/baja**: únicamente vía `public.registrar_integracion_oauth(clave,
  nombre)` y `public.actualizar_integracion_oauth(id, habilitada)`, restringidas
  a superadmin. Agregar un proveedor nuevo no requiere una migración (FR-006):
  requiere esta fila más su alta correspondiente como "Integration" en el
  dashboard de Nango (client id/secret del proveedor, fuera de Git).
- **Lectura**: cualquier persona autenticada con contexto de organización
  activo puede leer `clave`, `nombre`, `habilitada` (para poblar la pantalla de
  conexiones). Sin RLS por organización — es catálogo de plataforma, no dato de
  una organización.

## `conexiones_oauth`

La autorización concreta de una organización para una integración.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()`. **Se reutiliza tal cual como `connection_id` de Nango** — no existe una columna de mapeo aparte. |
| `organizacion_id` | `uuid` NOT NULL | `references organizaciones (id) on delete cascade`. |
| `integracion_id` | `uuid` NOT NULL | `references integraciones_oauth (id) on delete restrict` (no se borra una integración con conexiones activas). |
| `estado` | `text` NOT NULL DEFAULT `'pendiente'` | `check (estado in ('pendiente', 'activa', 'con_error'))`. |
| `created_by` | `uuid` | `references auth.users (id) on delete set null`. |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | Se actualiza en cada transición de estado. |

- **`unique (organizacion_id, integracion_id)`**: a propósito, distinto del
  criterio de `conexiones` (spec 013 permite varias conexiones al mismo
  sistema externo, R10/FR-021). Acá una conexión OAuth es un login de una
  persona en nombre de la organización — no tiene sentido más de una activa
  para el mismo proveedor a la vez. Reautorizar reutiliza la misma fila y el
  mismo `connection_id` de Nango.
- **RLS**: `select` permitido a administrador de esa organización o
  superadmin (mismo nivel que `conexiones`, FR-009 de spec 013 por analogía).
  Sin `insert`/`update`/`delete` directo para `authenticated` — todo pasa por
  las funciones `SECURITY DEFINER` de abajo.
- **Índice**: `conexiones_oauth_organizacion_id_idx on (organizacion_id)`.

## `eventos_conexion_oauth`

Auditoría mínima (Principio III), mismo criterio que `alertas` (spec 013).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` PK | `generated always as identity`. |
| `conexion_id` | `uuid` NOT NULL | `references conexiones_oauth (id) on delete cascade`. |
| `tipo` | `text` NOT NULL | `check (tipo in ('creada', 'reautorizada', 'invalidada'))`. |
| `actor` | `uuid` | `references auth.users (id) on delete set null` — `null` cuando el evento lo produce un backend/worker sin sesión de usuario (p. ej. `invalidada`). |
| `motivo` | `text` | Obligatorio para `invalidada` (motivo sanitizado, nunca el token ni el error crudo del proveedor); opcional para el resto. |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

- **Índice**: `eventos_conexion_oauth_conexion_id_id_idx on (conexion_id, id desc)`.
- **RLS**: `select` con el mismo criterio que `conexiones_oauth` (join
  implícito por `conexion_id`). Sin escritura directa — solo vía las funciones
  de abajo.

## Funciones (`public`, `SECURITY DEFINER`, `set search_path = ''`)

| Función | Quién | Qué hace |
|---|---|---|
| `iniciar_conexion_oauth(organizacion_id, integracion_id)` | administrador de esa organización o superadmin | `insert ... on conflict (organizacion_id, integracion_id) do nothing`, después `select` de la fila (existente o nueva). Devuelve `id` (= `connection_id` de Nango) e `integraciones_oauth.clave` para que el frontend inicie `nango.auth(clave, id)`. Falla si la integración no está `habilitada`. |
| `confirmar_conexion_oauth(conexion_id)` | administrador de esa organización o superadmin, y solo sobre una fila de su propia organización | Pone `estado = 'activa'`, `updated_at = now()`; inserta un evento `creada` (primera vez) o `reautorizada` (ya existía en `con_error`/`activa`). |
| `marcar_conexion_oauth_invalida(conexion_id, motivo)` | únicamente `service_role` (uso esperado: backend/worker de un producto derivado) — sin GRANT a `authenticated`, mismo criterio que `private.marcar_conexion_credencial_invalida` de spec 013: reporta un fallo detectado por un backend, no una acción de una persona | Pone `estado = 'con_error'`, `updated_at = now()`; inserta evento `invalidada` con el motivo saneado. `motivo` NUNCA debe incluir el token ni la respuesta cruda del proveedor — responsabilidad del llamador (mismo criterio que `contracts/ejecucion-segura.md` de spec 014). |
| `registrar_integracion_oauth(clave, nombre)` | superadmin únicamente | Alta de un nuevo tipo de integración en el catálogo. |
| `actualizar_integracion_oauth(integracion_id, habilitada)` | superadmin únicamente | Habilita/deshabilita una integración para nuevas conexiones. |

Ninguna de estas funciones hace una llamada HTTP saliente ni conoce el
`NANGO_SECRET_KEY` — ese secreto vive únicamente en el entorno del backend o
worker del producto derivado que consume `contracts/obtener-token-oauth.md`.

## Relación con conceptos existentes

- **`organizaciones`**: dueña de cada `conexiones_oauth`, igual que dueña de
  cada `conexiones` (spec 013) — mismo mecanismo de aislamiento, dos tablas
  distintas por tener modelos de custodia de secreto incompatibles (ver
  `research.md` R4).
- **`private.es_administrador_de(organizacion_id)`** (spec 013): se reutiliza
  tal cual como chequeo de permiso dentro de las funciones nuevas — no se
  duplica esa lógica.
