import Nango from '@nangohq/frontend'
import { supabaseClient } from '../../lib/supabase'

// Self-hosted: `host`, nunca `publicKey` (eso es de Nango Cloud). Sin
// VITE_NANGO_PUBLIC_SERVER_URL (falta el .env local) igual se construye la
// URL, mismo criterio que src/lib/supabase.ts — la llamada real simplemente
// falla con un error de red, no un crash al importar el módulo.
const nangoHost = import.meta.env.VITE_NANGO_PUBLIC_SERVER_URL || 'http://localhost:3003'

export type ResultadoConexionOAuth =
  | { exito: true }
  | { exito: false; motivo: string }

// Contrato: specs/20260930-153545-conexiones-oauth-nango/contracts/conectar-oauth.md #2.
// El SDK de frontend de Nango (0.71.x) exige un Connect Session Token de
// corta duración para self-host — host+publicKey solo ya no alcanza. Ese
// token se genera server-to-server con NANGO_SECRET_KEY_* (nunca en el
// navegador) vía la Edge Function iniciar-sesion-oauth; acá solo se
// consume. Ni el navegador ni este wrapper ven nunca un token del
// proveedor ni el secreto de Nango.
export async function conectarOAuth(clave: string, conexionId: string): Promise<ResultadoConexionOAuth> {
  const { data, error: fnError } = await supabaseClient.functions.invoke<{ token: string }>(
    'iniciar-sesion-oauth',
    { body: { conexion_id: conexionId } },
  )

  if (fnError || !data?.token) {
    return { exito: false, motivo: 'No se pudo iniciar la sesión de conexión.' }
  }

  const nango = new Nango({ host: nangoHost, connectSessionToken: data.token })

  try {
    await nango.auth(clave, conexionId)
    return { exito: true }
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'No se pudo completar la conexión.'
    return { exito: false, motivo }
  }
}
