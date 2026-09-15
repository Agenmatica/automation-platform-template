import { useEffect, useState } from 'react'
import { useGetIdentity } from '@refinedev/core'
import { supabaseClient } from '../lib/supabase'

type Identity = { id: string; email?: string }

// Resuelve la organización sobre la que trabaja la pantalla: la membresía
// propia tiene prioridad y, para un superadmin, se usa la organización activa.
// Es el mismo orden que private.organizacion_id() y evita que un superadmin
// vea o modifique todas las filas que su RLS le permite administrar.
export function useOrganizacionDeTrabajo() {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<Identity>()
  const [checked, setChecked] = useState<{ userId: string; organizacionId: string | null } | null>(null)

  useEffect(() => {
    if (!identity?.id) return
    let cancelled = false
    Promise.all([
      supabaseClient.from('usuarios_organizacion').select('organizacion_id').eq('user_id', identity.id).maybeSingle(),
      supabaseClient.from('superadmin_organizacion_activa').select('organizacion_id').eq('user_id', identity.id).maybeSingle(),
    ]).then(([membresia, organizacionActiva]) => {
      if (!cancelled) setChecked({ userId: identity.id, organizacionId: membresia.data?.organizacion_id ?? organizacionActiva.data?.organizacion_id ?? null })
    })
    return () => { cancelled = true }
  }, [identity?.id])

  if (identityLoading || (identity?.id && checked?.userId !== identity.id)) return { organizacionId: null, isLoading: true }
  return { organizacionId: checked?.organizacionId ?? null, isLoading: false }
}
