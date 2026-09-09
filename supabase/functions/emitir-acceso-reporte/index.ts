// Contrato: specs/007-analitica-embebida/contracts/acceso-reporte.md
//
// Emite un guest token de Superset con la organización de quien llama
// forzada en la cláusula `rls` (FR-010). La autorización NO se reescribe
// acá: se arma un cliente autenticado como el propio usuario (nunca la
// service-role) y se deja que la RLS de `reportes_organizaciones_roles`
// decida si aparece alguna fila — research.md #6.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no soportado, usar POST.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Solo para validar el JWT (mismo patrón que crear-organizacion) — nunca
  // se usa este cliente para leer datos de negocio.
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) {
    return jsonResponse({ error: 'No autorizado' }, 403)
  }

  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt)
  if (callerError || !callerData?.user) {
    return jsonResponse({ error: 'No autorizado' }, 403)
  }

  let body: { reporte_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo inválido: se esperaba JSON.' }, 400)
  }

  const reporteId = body.reporte_id
  if (!reporteId) {
    return jsonResponse({ error: 'Falta "reporte_id".' }, 400)
  }

  // Cliente autenticado como el propio usuario que llama — la RLS de
  // reportes_organizaciones_roles (organización activa + rol) decide si
  // hay algo que ver, sin duplicar esa regla acá (research.md #6).
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const { data: filasAutorizacion } = await asUser
    .from('reportes_organizaciones_roles')
    .select('organizacion_id')
    .eq('reporte_id', reporteId)
    .limit(1)

  const organizacionId = filasAutorizacion?.[0]?.organizacion_id
  if (!organizacionId) {
    // Ni siquiera se revela si el reporte existe (FR-007).
    return jsonResponse({ error: 'No autorizado' }, 403)
  }

  const { data: reporte } = await asUser
    .from('reportes')
    .select('superset_dashboard_uuid')
    .eq('id', reporteId)
    .maybeSingle()

  if (!reporte) {
    return jsonResponse({ error: 'No autorizado' }, 403)
  }

  const supersetUrl = Deno.env.get('SUPERSET_URL')!
  const username = Deno.env.get('SUPERSET_GUEST_TOKEN_USERNAME')!
  const password = Deno.env.get('SUPERSET_GUEST_TOKEN_PASSWORD')!

  try {
    const loginRes = await fetch(`${supersetUrl}/api/v1/security/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        provider: 'db',
        refresh: false,
      }),
    })

    if (!loginRes.ok) {
      return jsonResponse({ error: 'analitica_no_disponible' }, 503)
    }

    const { access_token: accessToken } = await loginRes.json()

    const guestTokenRes = await fetch(`${supersetUrl}/api/v1/security/guest_token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        resources: [{ type: 'dashboard', id: reporte.superset_dashboard_uuid }],
        rls: [{ clause: `organizacion_id = '${organizacionId}'` }],
        user: { username: 'guest' },
      }),
    })

    if (!guestTokenRes.ok) {
      return jsonResponse({ error: 'analitica_no_disponible' }, 503)
    }

    const { token: guestToken } = await guestTokenRes.json()

    return jsonResponse(
      {
        guest_token: guestToken,
        superset_url: supersetUrl,
        dashboard_uuid: reporte.superset_dashboard_uuid,
      },
      200,
    )
  } catch {
    // Superset caído, timeout, o cualquier fallo de red — FR-015: mensaje
    // puntual de no disponibilidad, sin reintento automático.
    return jsonResponse({ error: 'analitica_no_disponible' }, 503)
  }
})
