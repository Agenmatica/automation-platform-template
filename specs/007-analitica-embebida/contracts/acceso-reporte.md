# Contract: Edge Function `emitir-acceso-reporte`

**Quién la llama**: Refine, desde `ReporteEmbebido.tsx`, para cualquier
persona autenticada que abre un reporte de la sección Analítica.

## Request

```http
POST /functions/v1/emitir-acceso-reporte
Authorization: Bearer <JWT del usuario>
Content-Type: application/json

{ "reporte_id": "<uuid>" }
```

## Autorización (FR-010)

La función NO usa la service-role para decidir si quien llama puede ver el
reporte. En su lugar:

1. Valida el JWT del header `Authorization` (mismo patrón que
   `crear-organizacion`: `admin.auth.getUser(jwt)` con un cliente
   service-role solo para esa validación, no para leer datos de negocio).
2. Arma un segundo cliente de Supabase autenticado **como ese usuario**
   (su JWT, no la service-role) y hace:
   ```ts
   const { data } = await asUser
     .from('reportes_organizaciones_roles')
     .select('organizacion_id')
     .eq('reporte_id', reporte_id)
     .limit(1)
   ```
3. Si `data` viene vacío → `403` — la propia RLS de la tabla ya filtró por
   organización activa y rol (research.md #6); esta función no repite esa
   lógica.
4. Si viene una fila, `organizacion_id` de esa fila es la que se usa para
   la cláusula `rls` del guest token — nunca un valor que mande el cliente
   en el body.

## Comportamiento (autorizado)

1. Busca `reportes.superset_dashboard_uuid` para `reporte_id` (con el
   mismo cliente `asUser` — la policy de `reportes` ya lo permite si llegó
   hasta acá).
2. `POST {SUPERSET_URL}/api/v1/security/login` con las credenciales de la
   cuenta de servicio (`SUPERSET_GUEST_TOKEN_USERNAME/PASSWORD`,
   secretos de la función, research.md #3) → `access_token`.
3. `POST {SUPERSET_URL}/api/v1/security/guest_token/` con ese
   `access_token`, pidiendo:
   ```json
   {
     "resources": [{ "type": "dashboard", "id": "<superset_dashboard_uuid>" }],
     "rls": [{ "clause": "organizacion_id = '<organizacion_id>'" }],
     "user": { "username": "guest" }
   }
   ```
4. Devuelve el `guest_token` recibido, junto con `SUPERSET_URL` y el
   `superset_dashboard_uuid`, para que el frontend monte el SDK.

## Response

**200** (autorizado y Superset respondió):
```json
{ "guest_token": "...", "superset_url": "...", "dashboard_uuid": "..." }
```

**403** (no autorizado — organización/rol sin acceso a ese reporte, o
`reporte_id` inexistente): sin cuerpo con información del reporte, solo
`{ "error": "No autorizado" }` — no revela si el reporte existe (FR-007,
Acceptance Scenario 4 de la spec: "sin revelar ningún dato del reporte").

**503** (Superset no respondió a alguno de los dos `POST`, o se agotó el
timeout — FR-015): `{ "error": "analitica_no_disponible" }`. El frontend
mapea este código puntual al mensaje específico de no disponibilidad; no
se reintenta automáticamente (Clarifications).

## Permisos

Sin `grant` de PostgREST — es una Edge Function, se invoca por HTTP, no
por `supabase.rpc(...)`. El `Authorization` header con el JWT del usuario
es lo único que la autoriza; sin la service-role, esta función no puede
leer ni escribir nada que la RLS del usuario no le deje ver.
