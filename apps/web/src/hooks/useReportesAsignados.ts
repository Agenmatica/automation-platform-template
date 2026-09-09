import { useEffect, useState } from 'react'
import { useGetIdentity } from '@refinedev/core'
import { supabaseClient } from '../lib/supabase'

type Identity = { id: string; email?: string }

export type ReporteAsignado = { id: string; nombre: string }

// Reportes visibles para el usuario actual (US2). No filtra nada acá — la
// RLS de `reportes` (private.puede_ver_reporte / is_superadmin) ya deja
// pasar solo lo que la organización activa y el rol de quien consulta
// pueden ver (FR-007/FR-009). Mismo patrón que useOrganizacionActiva.
export function useReportesAsignados() {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<Identity>()
  const [checked, setChecked] = useState<{
    userId: string
    reportes: ReporteAsignado[]
  } | null>(null)

  useEffect(() => {
    if (!identity?.id) {
      return
    }

    let cancelled = false

    supabaseClient
      .from('reportes')
      .select('id, nombre')
      .then(({ data }) => {
        if (!cancelled) {
          setChecked({ userId: identity.id, reportes: data ?? [] })
        }
      })

    return () => {
      cancelled = true
    }
  }, [identity?.id])

  if (identityLoading) {
    return { reportes: [], isLoading: true }
  }

  if (!identity?.id) {
    return { reportes: [], isLoading: false }
  }

  if (checked?.userId !== identity.id) {
    return { reportes: [], isLoading: true }
  }

  return { reportes: checked.reportes, isLoading: false }
}
