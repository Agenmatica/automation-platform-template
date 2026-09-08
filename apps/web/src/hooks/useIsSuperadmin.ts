import { useEffect, useState } from 'react'
import { useGetIdentity } from '@refinedev/core'
import { checkIsSuperadmin } from '../lib/superadmin'

type Identity = { id: string; email?: string }

// Gate de las pantallas superadmin-only (FR-008, FR-010): organizaciones/*
// existe para un solo perfil. La verificación real de negocio sigue siendo
// la Edge Function/RPC (que rechazan a quien no sea superadmin sin
// importar por dónde entre) — esto es solo para no mostrar la pantalla a
// quien no la puede usar.
export function useIsSuperadmin() {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<Identity>()
  const [checked, setChecked] = useState<{ userId: string; isSuperadmin: boolean } | null>(null)

  useEffect(() => {
    if (!identity?.id) {
      return
    }

    let cancelled = false

    checkIsSuperadmin(identity.id).then((isSuperadmin) => {
      if (!cancelled) {
        setChecked({ userId: identity.id, isSuperadmin })
      }
    })

    return () => {
      cancelled = true
    }
  }, [identity?.id])

  if (identityLoading) {
    return { isSuperadmin: null, isLoading: true }
  }

  if (!identity?.id) {
    return { isSuperadmin: false, isLoading: false }
  }

  if (checked?.userId !== identity.id) {
    return { isSuperadmin: null, isLoading: true }
  }

  return { isSuperadmin: checked.isSuperadmin, isLoading: false }
}
