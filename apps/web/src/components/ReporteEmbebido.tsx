import { useEffect, useRef, useState } from 'react'
import { Alert, Box } from '@mui/material'
import { embedDashboard } from '@superset-ui/embedded-sdk'
import { supabaseClient } from '../lib/supabase'

const MENSAJE_NO_DISPONIBLE = 'Analítica no disponible en este momento.'

type ReporteEmbebidoProps = {
  reporteId: string
}

// Pide el guest token a la Edge Function (contracts/acceso-reporte.md) y
// monta el dashboard con el SDK oficial de Superset. El único fallback
// visible, tanto si la función responde 503 como si el propio SDK falla al
// montar, es el mensaje de no disponibilidad (FR-015) — sin detalle
// técnico, sin reintento automático (Clarifications).
//
// Quien renderiza este componente debe pasarle `key={reporteId}` (ver
// pages/analitica/list.tsx) para que cambiar de reporte remonte una
// instancia nueva en vez de reutilizar el estado de la anterior — así el
// efecto nunca necesita resetear `error` de forma síncrona al arrancar.
export function ReporteEmbebido({ reporteId }: ReporteEmbebidoProps) {
  const mountPointRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function montar() {
      const { data: sesion } = await supabaseClient.auth.getSession()
      const accessToken = sesion.session?.access_token

      if (!accessToken) {
        if (!cancelled) {
          setError(MENSAJE_NO_DISPONIBLE)
        }
        return
      }

      const { data, error: fnError } = await supabaseClient.functions.invoke(
        'emitir-acceso-reporte',
        { body: { reporte_id: reporteId } },
      )

      if (cancelled) {
        return
      }

      if (fnError || !data?.guest_token) {
        setError(MENSAJE_NO_DISPONIBLE)
        return
      }

      if (!mountPointRef.current) {
        return
      }

      try {
        await embedDashboard({
          id: data.dashboard_uuid,
          supersetDomain: data.superset_url,
          mountPoint: mountPointRef.current,
          fetchGuestToken: () => Promise.resolve(data.guest_token),
          dashboardUiConfig: { hideTitle: true },
        })
      } catch {
        if (!cancelled) {
          setError(MENSAJE_NO_DISPONIBLE)
        }
      }
    }

    montar()

    return () => {
      cancelled = true
    }
  }, [reporteId])

  if (error) {
    return <Alert severity="warning">{error}</Alert>
  }

  return <Box ref={mountPointRef} sx={{ width: '100%', minHeight: 600 }} />
}
