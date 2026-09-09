# Research: Analítica embebida por organización

## 1. Mecanismo de embedding de Superset

**Decisión**: usar el flujo oficial de "Embedded Dashboards" de Superset —
SDK `@superset-ui/embedded-sdk` del lado del cliente, feature flag
`EMBEDDED_SUPERSET = True` del lado del servidor, y un guest token de vida
corta emitido por `/api/v1/security/guest_token/`.

**Rationale**: es el único mecanismo de Superset pensado para mostrar un
dashboard dentro de otra aplicación sin que quien lo mira tenga sesión
propia en Superset — encaja exacto con FR-008/FR-013 (sin acceso directo a
Superset, sin exponer su URL/credenciales).

**Alternativas consideradas**: iframe directo a la URL pública de un
dashboard (rechazado — expondría la URL de Superset y no permite filtrar
por organización sin que el usuario pueda alterar el filtro); replicar los
charts con una librería de gráficos propia consultando la base directo
(rechazado — duplica todo el trabajo de Superset, contradice la razón de
tenerlo en el stack).

## 2. Quién habilita un dashboard para embedding

**Decisión**: es un paso manual que el superadmin hace en la propia UI de
Superset (Dashboard → Embed dashboard), que genera el UUID de embedding.
Ese UUID es el que se registra en el catálogo interno vía `registrar_reporte`.

**Rationale**: coherente con la Assumption de la spec de que la autoría
(crear/editar/preparar un reporte) ocurre en Superset, fuera de este
producto — este código no necesita llamar a la API de Superset para
habilitar el embedding, solo para pedir el guest token de un dashboard ya
habilitado.

## 3. Emisión del guest token

**Decisión**: la Edge Function `emitir-acceso-reporte` hace dos llamadas
server-to-server a la API de Superset: `POST /api/v1/security/login` con
una cuenta de servicio dedicada (no la cuenta interactiva del superadmin)
para obtener un `access_token`, y `POST /api/v1/security/guest_token/` con
ese token, pidiendo el `resource` (el dashboard) y una cláusula `rls` que
fuerza `organizacion_id = '<uuid>'`.

**Rationale**: separar la cuenta de servicio de la cuenta interactiva del
superadmin es menor privilegio — si se filtran las credenciales de esta
Edge Function, lo único que permiten es pedir guest tokens de solo lectura,
no editar nada en Superset.

**Alternativas consideradas**: reusar `SUPERSET_ADMIN_USERNAME/PASSWORD`
(rechazado — innecesariamente amplio para lo que hace falta acá).

## 4. Convención de columna para el filtro `rls`

**Decisión**: todo dataset de Superset usado en un reporte de esta
funcionalidad DEBE exponer una columna `organizacion_id` con los mismos
valores que `organizaciones.id`. La Edge Function siempre arma la cláusula
como `organizacion_id = '<uuid>'`, sin parametrizar el nombre de columna.

**Rationale**: mantenerlo fijo evita que el catálogo interno (`reportes`)
necesite guardar metadata adicional sobre el dataset de cada reporte; el
costo es una convención que el superadmin debe seguir al armar datasets en
Superset — documentado acá porque es un requisito técnico real, aunque la
autoría en sí quede fuera del alcance de esta spec.

## 5. Duración y refresco del guest token

**Decisión**: se usa el valor por defecto de Superset
(`GUEST_TOKEN_JWT_EXP_SECONDS`) sin overridearlo, y se confía en el
refresco automático que ya trae `@superset-ui/embedded-sdk` (vuelve a
invocar el callback `fetchGuestToken` antes de que expire).

**Rationale**: la spec no fija ninguna duración de sesión como requisito de
negocio (Assumptions) — no hay motivo para una configuración custom.

## 6. Cómo se resuelve la autorización (FR-010) sin duplicar lógica

**Decisión**: la Edge Function arma un cliente de Supabase con el JWT de
quien llama (no con la service-role) y hace un `select` simple contra
`reportes_organizaciones_roles` filtrando por `reporte_id`. La propia RLS
de esa tabla (organización activa + rol del que llama) decide si aparece
alguna fila. Cero filas → no autorizado; una fila → autorizado.

**Rationale**: evita mantener la misma regla de autorización escrita dos
veces (una en SQL para la UI, otra en TypeScript para la Edge Function) —
si mañana cambia la regla de RLS, la Edge Function la hereda gratis. Es el
mismo principio que ya usa el resto del producto (autorización real en
RLS, el resto es UI).

**Alternativas consideradas**: una función `private.puede_ver_reporte(...)`
expuesta como RPC aparte (rechazado — es estrictamente más código para el
mismo resultado que ya da un `select` respetando RLS).

## 7. Helper `puede_gestionar_reportes` vs. reusar el de la spec 005

**Decisión**: definir `private.puede_gestionar_reportes(organizacion_id)`
como una función nueva y autocontenida dentro de la migración de esta
spec, con la misma lógica que `private.puede_gestionar_membresias` de la
spec 005 (administrador de esa organización, o superadmin con esa
organización activa).

**Rationale**: esta spec parte de la rama `main`, que todavía no tiene
mergeado el PR de la spec 005 (#4, abierto). Depender de una función que
puede no existir todavía en el momento de implementar sería frágil. Queda
documentada acá la duplicación deliberada — una futura consolidación en un
único helper genérico (`private.es_admin_de(organizacion_id)`) es una
mejora posible, no parte de esta spec.

## 8. Alcance de testing

**Decisión**: pgTAP nuevo y obligatorio para las tablas/RLS/RPCs (aislamiento
multi-tenant, exige la constitución). Sin test de la Edge Function ni del
SDK de embedding — mismo criterio que las specs 003/004 (no hay tests de
función ya en el repo, y mockear un SDK de terceros completo no da señal
real). Se agregan tests de Vitest puntuales para el componente de la
grilla de permisos (checkboxes) y el estado de "sin reportes asignados" /
"analítica no disponible", que sí son lógica propia y determinística.

**Rationale**: consistente con dónde ya está el aislamiento (Postgres) y
con el patrón de testing que este repo ya sostiene en specs anteriores.

## 9. Configuración de Superset a tocar

**Decisión**: en `infra/superset/superset_config.py` agregar
`FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}`, `GUEST_TOKEN_JWT_SECRET`
(nuevo secreto, distinto de `SUPERSET_SECRET_KEY`), y habilitar CORS
(`ENABLE_CORS`, `CORS_OPTIONS`) para el origen de Refine. `TALISMAN_ENABLED`
ya está en `False` (TLS lo termina el reverse proxy del VPS) — no hace
falta tocar cabeceras de framing adicionales; se verifica empíricamente en
el quickstart que el iframe del SDK carga sin bloqueos, en vez de
sobre-especificar acá una configuración de CSP que Superset podría no
necesitar.

**Rationale**: son los únicos cambios documentados como requisito del SDK
oficial; cualquier ajuste adicional de cabeceras se resuelve si el
quickstart lo detecta, no de antemano.
