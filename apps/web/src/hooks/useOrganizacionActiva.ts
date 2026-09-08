import { useEffect, useState } from 'react'
import { useGetIdentity } from '@refinedev/core'
import { checkOrganizacionActiva, type OrganizacionActiva } from '../lib/superadmin'

type Identity = { id: string; email?: string }

// Resuelve la organización activa del superadmin actual (spec 004, US2) —
// null si no tiene ninguna (nunca entró, o salió). Mismo patrón que
// useIsSuperadmin/usePuedeEscribir: consulta una vez por identidad y cachea
// en estado local, no en cada render.
export function useOrganizacionActiva() {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<Identity>()
  const [checked, setChecked] = useState<{
    userId: string
    organizacionActiva: OrganizacionActiva | null
  } | null>(null)

  useEffect(() => {
    if (!identity?.id) {
      return
    }

    let cancelled = false

    checkOrganizacionActiva(identity.id).then((organizacionActiva) => {
      if (!cancelled) {
        setChecked({ userId: identity.id, organizacionActiva })
      }
    })

    return () => {
      cancelled = true
    }
  }, [identity?.id])

  if (identityLoading) {
    return { organizacionActiva: null, isLoading: true }
  }

  if (!identity?.id) {
    return { organizacionActiva: null, isLoading: false }
  }

  if (checked?.userId !== identity.id) {
    return { organizacionActiva: null, isLoading: true }
  }

  return { organizacionActiva: checked.organizacionActiva, isLoading: false }
}
