import { useEffect, useState } from 'react'
import { useGetIdentity } from '@refinedev/core'
import { supabaseClient } from '../lib/supabase'

type Identity = { id: string; email?: string }

// Espejo, del lado del cliente y solo para gatear la UI, de
// private.puede_escribir(): administrador de su organización, o
// superadmin con una organización activa (US3, FR-011). La autorización
// real la sigue haciendo RLS — esto solo evita mostrar controles que el
// servidor de todas formas va a rechazar.
export function usePuedeEscribir() {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<Identity>()
  const [checked, setChecked] = useState<{ userId: string; puedeEscribir: boolean } | null>(null)

  useEffect(() => {
    if (!identity?.id) {
      return
    }

    let cancelled = false

    Promise.all([
      supabaseClient
        .from('usuarios_organizacion')
        .select('rol_id')
        .eq('user_id', identity.id)
        .maybeSingle(),
      supabaseClient
        .from('superadmin_organizacion_activa')
        .select('user_id')
        .eq('user_id', identity.id)
        .maybeSingle(),
    ]).then(([membresia, organizacionActiva]) => {
      if (cancelled) {
        return
      }

      const esAdministrador = membresia.data?.rol_id === 'administrador'
      const esSuperadminConOrganizacionActiva = Boolean(organizacionActiva.data)

      setChecked({
        userId: identity.id,
        puedeEscribir: esAdministrador || esSuperadminConOrganizacionActiva,
      })
    })

    return () => {
      cancelled = true
    }
  }, [identity?.id])

  if (identityLoading) {
    return { puedeEscribir: null, isLoading: true }
  }

  if (!identity?.id) {
    return { puedeEscribir: false, isLoading: false }
  }

  if (checked?.userId !== identity.id) {
    return { puedeEscribir: null, isLoading: true }
  }

  return { puedeEscribir: checked.puedeEscribir, isLoading: false }
}
