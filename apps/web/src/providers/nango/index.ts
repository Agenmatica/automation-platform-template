import Nango from '@nangohq/frontend'

// Self-hosted: `host`, nunca `publicKey` (eso es de Nango Cloud). Sin
// VITE_NANGO_PUBLIC_SERVER_URL (falta el .env local) igual se construye el
// cliente, mismo criterio que src/lib/supabase.ts — la llamada real
// simplemente falla con un error de red, no un crash al importar el módulo.
const nangoHost = import.meta.env.VITE_NANGO_PUBLIC_SERVER_URL || 'http://localhost:3003'

const nango = new Nango({ host: nangoHost })

export type ResultadoConexionOAuth =
  | { exito: true }
  | { exito: false; motivo: string }

// Contrato: specs/20260930-153545-conexiones-oauth-nango/contracts/conectar-oauth.md #2.
// Abre el popup de consentimiento del proveedor; ni el navegador ni este
// wrapper ven nunca un token ni un secreto de Nango o del proveedor.
export async function conectarOAuth(clave: string, conexionId: string): Promise<ResultadoConexionOAuth> {
  try {
    await nango.auth(clave, conexionId)
    return { exito: true }
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'No se pudo completar la conexión.'
    return { exito: false, motivo }
  }
}
