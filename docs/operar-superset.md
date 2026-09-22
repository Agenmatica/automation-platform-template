# Operar Superset local

Conocimiento operativo encontrado al ejercitar por primera vez la analítica
embebida (spec 007) contra datos reales en un producto derivado — no es una
funcionalidad de negocio, es infraestructura/configuración que cualquier
producto derivado que use este Superset va a pisar igual. `infra/superset/`
tiene la configuración real (`superset_config.py`,
`crear_cuenta_servicio_guest_token.py`, `compose.yaml`).

## Red cruzada entre proyectos Docker

El contenedor de Edge Functions de Supabase y el de Superset son de dos
`docker compose` distintos, cada uno con su propia red — el nombre de
servicio `superset` no resuelve entre ellos por defecto, y
`host.docker.internal` tampoco funciona desde el runtime de Edge Functions
(sandboxea la red de cada isolate; el request cuelga hasta el timeout de
wall-clock en vez de fallar rápido).

Solución: conectar el contenedor de Superset a la red de Supabase con
alias:

```sh
docker network connect --alias superset <red-supabase> <contenedor-superset>
```

**No persiste solo** — hay que repetirlo si se recrea cualquiera de los dos
contenedores (sí sobrevive un `docker restart` normal de cualquiera de los
dos).

## El rol `Guest` no trae permisos de datos por defecto

`GUEST_ROLE_NAME` en `superset_config.py` (`"Guest"`) viene, apenas creado,
con un único permiso: `can_read` sobre `Dashboard`. Sin permisos
adicionales, cada chart embebido devuelve `"Data error: Forbidden"` aunque
el guest token se emita bien — el guest token en sí resuelve *a qué*
dashboard/recurso accede (vía `resources`/RLS del propio token), no *qué
puede hacer* ese rol una vez adentro.

Este permiso vive en la metadata DB de la propia app Superset, **no en
ningún archivo versionado de este repo todavía** — no sobrevive un volumen
de Postgres de Superset recreado desde cero. A diferencia de
`crear_cuenta_servicio_guest_token.py` (que sí automatiza el alta de la
cuenta de servicio), esto **no tiene automatización propia acá**: se
otorgó a mano, por API, la primera vez que se ejercitó. Queda documentado
para que el primer producto derivado que lo necesite decida si lo
automatiza (`superset shell`, mismo mecanismo que el script existente) o
lo repite a mano, según le convenga.

Permisos necesarios (otorgados vía
`POST /api/v1/security/roles/<id>/permissions`, con
`permission_view_menu_ids`, después de resolver esos IDs vía
`GET /api/v1/security/permissions-resources/` filtrando por
`permission.name`/`view_menu.name`):

| Permiso | View menu |
|---|---|
| `can_read` | `Chart` |
| `can_read` | `Dataset` |
| `can_get` | `Datasource` |
| `can_external_metadata` | `Datasource` |
| `can_external_metadata_by_name` | `Datasource` |
| `can_query` | `Api` |
| `can_time_range` | `Api` |
| `can_query_form_data` | `Api` |
| `can_csv` | `Superset` — habilita exportar a CSV/Excel/imagen desde el menú "..." de cada chart |
| `can_share_chart` | `Chart` — mantiene "Copy permalink"/"Share by email"; "Embed code" se bloquea aparte (ver sección siguiente), no sacando este permiso |
| `datasource_access` | uno por cada tabla/dataset real que use un chart embebido — no hay lista genérica posible, depende de los datasets de cada producto |

**A propósito NO otorgar** `can_view_query` (`Dashboard`) — "View query" no
debe quedar visible para quien entra por guest token.

## "Embed code" no se puede aislar solo con permisos de rol

Superset agrupa "Copy permalink to clipboard", "Share chart by email" y
"Embed code" bajo el mismo permiso de rol (`can_share_chart`) — sacar el
permiso saca los tres juntos, no se puede aislar solo "Embed code" a nivel
de rol. Por eso `EMBEDDABLE_CHARTS` va en `False` en `FEATURE_FLAGS` de
`superset_config.py` (default real de Superset: `True`) en vez de resolverse
con permisos — así se conserva "Copy permalink"/"Share by email" sin
exponer "Embed code" a nadie. Requiere reiniciar el contenedor de Superset
para tomar el cambio (`docker restart` alcanza, no hace falta recrear — el
alias de red de arriba sobrevive un restart).

## Mapeo de UUIDs: dashboard propio vs. UUID de embedding

Cada dashboard tiene dos UUIDs distintos, fáciles de confundir:

- `dashboard.uuid` — identidad interna del dashboard en Superset.
- El UUID de **embedding** (`POST /api/v1/dashboard/<id>/embedded`) — es el
  que se usa como `dashboard_uuid` en el guest token y en la tabla de
  reportes de cada producto (spec 007). Son distintos: el título interno
  del dashboard en Superset no tiene por qué coincidir con el nombre de
  negocio que el producto le da al reporte.
