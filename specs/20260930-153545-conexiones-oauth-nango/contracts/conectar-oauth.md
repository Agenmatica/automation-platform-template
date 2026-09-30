# Contrato: conectar una organización a un proveedor OAuth

Interfaz que Refine (u otro cliente autenticado con sesión de Supabase Auth)
usa para que una persona de una organización conecte un proveedor externo.
Todo pasa por RLS + funciones `SECURITY DEFINER` de `data-model.md` — nunca
por un `insert`/`update` directo sobre `conexiones_oauth`.

## 1. Ver qué proveedores están disponibles

`select clave, nombre from integraciones_oauth where habilitada = true`

- **Quién**: cualquier persona autenticada con contexto de organización activo.

## 2. Iniciar (o reanudar) una conexión

`public.iniciar_conexion_oauth(organizacion_id, integracion_id) -> conexiones_oauth`

- **Quién**: administrador de esa organización o superadmin.
- **Qué hace**: crea la fila si no existe (`estado = 'pendiente'`) o devuelve
  la existente sin duplicar (`unique (organizacion_id, integracion_id)`).
- **Devuelve**: la fila completa. El cliente usa `id` como `connectionId` y
  `integraciones_oauth.clave` como `providerConfigKey` para:

  ```ts
  import Nango from '@nangohq/frontend';

  const nango = new Nango({ publicKey: NANGO_PUBLIC_KEY_O_URL });
  const result = await nango.auth(clave, conexionId);
  ```

  (El SDK del frontend habla directo con `nango-server`; ni el navegador ni
  Refine ven ningún secreto de Nango ni del proveedor en este paso.)

- **Falla si**: la integración no está `habilitada`, o quien llama no es
  administrador de esa organización ni superadmin.

## 3. Confirmar el éxito

`public.confirmar_conexion_oauth(conexion_id)`

- **Quién**: administrador de esa organización o superadmin; solo sobre una
  fila de su propia organización (verificado dentro de la función, no
  confiado al cliente).
- **Cuándo llamarla**: únicamente cuando `nango.auth(...)` resolvió con éxito
  (no ante error ni cancelación del usuario en el popup).
- **Qué hace**: pasa el estado a `activa` y registra el evento
  correspondiente (`creada` la primera vez, `reautorizada` si ya existía).

## 4. Ver el estado de las conexiones de mi organización

`select c.id, c.estado, c.updated_at, i.clave, i.nombre from conexiones_oauth c join integraciones_oauth i on i.id = c.integracion_id where c.organizacion_id = :organizacion_id`

- **Quién**: administrador de esa organización o superadmin (RLS lo aplica
  igual aunque se omita el `where` explícito).
- **Estados posibles**: `pendiente` (nunca se confirmó), `activa`,
  `con_error` (el proveedor la revocó o el refresh falló — ver
  `obtener-token-oauth.md`).

## 5. Reautorizar una conexión con error

Repetir los pasos 2 y 3 con el mismo `organizacion_id`/`integracion_id`: el
paso 2 devuelve la fila existente (mismo `id`/`connection_id`), y
`nango.auth(...)` sobrescribe la credencial dentro de Nango para ese
`connection_id` — no se crea una fila nueva ni un `connection_id` distinto.

## Fuera de este contrato (a propósito)

- Cancelar o eliminar una conexión (dejar de ofrecer un proveedor ya
  conectado) — no está en el alcance de la spec; se agrega cuando exista un
  caso de uso real.
- Cualquier llamada directa del navegador a la API HTTP de Nango — el
  navegador solo usa `@nangohq/frontend` contra el flujo de consentimiento,
  nunca `Authorization: Bearer` con el secreto de Nango.
