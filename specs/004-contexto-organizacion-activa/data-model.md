# Data Model: Contexto de organización activa del superadmin

Esta spec no agrega tablas nuevas — extiende dos piezas ya creadas en la
spec 003. Solo se documenta el delta; el resto del esquema (`organizaciones`,
`usuarios_organizacion`, `clientes`, `superadmins`,
`superadmin_organizacion_activa`) queda sin cambios, ver
`specs/003-fundacion-multitenant/data-model.md`.

## `superadmin_entradas` (columna nueva)

| Campo | Tipo | Notas |
|---|---|---|
| `accion` | `text` | `not null default 'entrada'`, `check (accion in ('entrada', 'salida'))` — el `default` hace que las filas ya existentes (todas entradas, de antes de esta spec) queden migradas sin intervención manual |

El resto de las columnas (`id`, `user_id`, `organizacion_id`, `entrado_en`)
no cambian de tipo ni de nombre — se mantiene `entrado_en` como nombre de
columna aunque ahora también registre el momento de una salida, para no
tocar una columna ya en uso por una migración aditiva. Sigue siendo
append-only, nunca se actualiza ni se borra.

## Funciones (delta)

- **`salir_de_organizacion() returns void`** (nueva, `security definer`):
  valida que quien llama sea superadmin (`private.is_superadmin()`); si no
  tiene fila en `superadmin_organizacion_activa`, es un no-op (Clarifications,
  Q1); si tiene una, la borra e inserta en `superadmin_entradas` una fila
  con `accion = 'salida'` para esa organización.
- **`entrar_a_organizacion(org_id uuid) returns void`** (modificada, spec
  003 → esta spec): antes del `upsert` en `superadmin_organizacion_activa`,
  si ya existía una fila con una `organizacion_id` distinta a `org_id`,
  inserta en `superadmin_entradas` una fila con `accion = 'salida'` para
  esa organización anterior. Después, hace el `upsert` (sin cambios) e
  inserta la fila de `accion = 'entrada'` para `org_id` (sin cambios de
  comportamiento respecto a la spec 003, solo se le suma el paso de
  salida cuando corresponde). Si no había ninguna organización activa
  antes, el comportamiento es idéntico al de la spec 003 (solo entrada).

## Relaciones

Sin cambios respecto a la spec 003 — `superadmin_entradas` sigue
relacionada con `auth.users` y `organizaciones` de la misma forma; la
columna `accion` es un atributo de esa misma tabla, no una relación nueva.
