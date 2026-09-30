# Contrato: obtener un access token vigente para un backend/worker

Este es el contrato que consume un producto derivado (backend o worker,
**nunca el navegador**) para operar la API de un proveedor externo (p. ej.
Google Sheets) en nombre de una organización, sin implementar refresh propio
ni tocar un secreto de Nango o del proveedor fuera de su propio entorno.

No requiere leer el código de esta spec: alcanza con este documento.

## Paso 1 — Resolver el `conexion_id` (Supabase, sin secretos)

```sql
select c.id, c.estado
from conexiones_oauth c
join integraciones_oauth i on i.id = c.integracion_id
where c.organizacion_id = :organizacion_id
  and i.clave = :clave -- p. ej. 'google'
```

- Se ejecuta con cualquier credencial que ya use el backend/worker contra
  Supabase (RLS aplica igual; `service_role` la bypassea si el proceso corre
  fuera de una sesión de usuario, como cualquier worker de este template).
- Si no hay fila, o `estado <> 'activa'`, el backend NO debe pedir un token:
  debe tratarlo como "conexión no disponible" (mostrar/loguear ese estado, no
  reintentar contra Nango).

### Variante: un flow de Kestra (JDBC directo, sin PostgREST)

Un flow que corre como `kestra_orquestacion` (mismo patrón que
`plantilla-generico.yml`/`plantilla-dedicado.yml`, spec 013) no tiene `select`
directo sobre `conexiones_oauth`/`integraciones_oauth` — igual que no lo tiene
sobre `conexiones`/`servidores_organizacion`. Para ese caso, el Paso 1 es:

```sql
select private.datos_despacho_conexion_oauth(:organizacion_id, :clave);
```

Devuelve el `conexion_id` activo, o falla con `P0002` si la organización no
tiene una conexión activa a esa integración (el flow trata ese error igual
que "conexión no disponible": no pasa a pedir un token). Ningún token ni dato
de Nango sale de esta función — eso lo sigue haciendo el worker en el Paso 2,
con su propio `NANGO_SECRET_KEY_*`, nunca el flow.

## Paso 2 — Pedir el token a Nango (fuera de Supabase, servidor a servidor)

```
GET {NANGO_SERVER_URL}/connection/{conexion_id}?provider_config_key={clave}&refresh_token=true
Authorization: Bearer {NANGO_SECRET_KEY}
```

- `{NANGO_SERVER_URL}`: URL del propio `nango-server` que opera el producto
  derivado (mismo valor configurado en `infra/nango/.env`).
- `{NANGO_SECRET_KEY}`: secreto de plataforma (uno por entorno —
  `NANGO_SECRET_KEY_DEV`/`NANGO_SECRET_KEY_PROD` en el self-host, o la llave
  "Default - Full access" del dashboard de Nango). Vive únicamente en el
  entorno del backend/worker, igual que la SSH key de Kestra
  (`contracts/ejecucion-segura.md`, spec 014) — nunca en Supabase, nunca en el
  navegador, nunca en Git.
- **Respuesta 200**: JSON con `credentials.access_token` ya vigente — Nango
  lo refresca automáticamente si había vencido. El backend lo usa
  inmediatamente y lo descarta al terminar el intento; no lo persiste.
- **Respuesta de error** (credencial revocada o refresh fallido): el backend
  pasa al paso 3.

### Alternativa: proxy de Nango (sin manejar el token en absoluto)

Para llamadas simples a la API del proveedor, Nango también permite invocarla
sin recibir nunca el `access_token`:

```
{METHOD} {NANGO_SERVER_URL}/proxy/{ruta-de-la-api-externa}
Authorization: Bearer {NANGO_SECRET_KEY}
Connection-Id: {conexion_id}
Provider-Config-Key: {clave}
```

Usar esta variante cuando el backend no necesita un cliente SDK propio del
proveedor (por ejemplo, llamadas REST puntuales). El worker de Google Sheets
que use la librería oficial `googleapis` normalmente preferirá el Paso 2
(necesita el `access_token` para inicializar su propio cliente OAuth2).

## Paso 3 — Reportar una conexión inválida

Si Nango responde que la credencial no pudo refrescarse (revocada o
inválida):

```sql
select marcar_conexion_oauth_invalida(:conexion_id, :motivo_sanitizado);
```

- `:motivo_sanitizado` es un texto corto y sin datos sensibles (nunca el
  token, nunca la respuesta cruda de Nango o del proveedor) — mismo criterio
  de saneamiento que `contracts/ejecucion-segura.md` (spec 014).
- Después de esta llamada, `conexiones_oauth.estado` pasa a `con_error` y
  queda visible para quien administra la organización (Historia 3 de
  `spec.md`), que puede reautorizar repitiendo `contracts/conectar-oauth.md`.

## Errores esperados y qué hacer

| Situación | Cómo se manifiesta | Qué hace el backend/worker |
|---|---|---|
| La organización nunca conectó ese proveedor | Paso 1 no devuelve fila | Tratar como "no conectado"; no llamar a Nango. |
| Conexión `pendiente` (nunca confirmada) | Paso 1 devuelve `estado = 'pendiente'` | Tratar como "no conectado". |
| Token revocado por el usuario en Google | Paso 2 responde error de refresh | Ejecutar Paso 3 y devolver el error al llamador de negocio. |
| `nango-server` inaccesible | Paso 2 falla por red/timeout | Falla técnica transitoria: reintentar con backoff, igual que cualquier dependencia externa; NO es un `marcar_conexion_oauth_invalida` (esa función es solo para credenciales inválidas, no para caídas de infraestructura). |

## Fuera de este contrato (a propósito)

- Este documento no cubre cómo un backend se autentica contra Supabase (eso
  ya lo define el mecanismo de despacho de cada producto — Kestra, cola
  propia, etc.); solo cubre qué hacer una vez que el backend ya sabe qué
  organización está operando.
- No define el formato de la tabla de dominio que consuma el resultado (por
  ejemplo, filas de una hoja de cálculo) — eso es enteramente del producto
  derivado.
