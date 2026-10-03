import { Button, Stack } from '@mui/material'
import type { EstadoInteraccion } from '@platform/ia'
import { useState } from 'react'
import { EstadoError } from '../estados/EstadosPagina'
import { supabaseClient } from '../../lib/supabase'

const ESTADOS_RESOLUBLES: EstadoInteraccion[] = ['revision_humana', 'esperando_aprobacion']

export function AccionesResolucionInteraccionIA({
  interaccionId,
  estado,
  onResuelto,
}: {
  interaccionId: string
  estado: EstadoInteraccion
  onResuelto: () => void
}) {
  const [resolviendo, setResolviendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!ESTADOS_RESOLUBLES.includes(estado)) return null

  const resolver = async (estadoFinal: 'completada' | 'rechazada' | 'cancelada') => {
    setResolviendo(true)
    setError(null)
    const { error: rpcError } = await supabaseClient.rpc('resolver_revision_ia', {
      p_interaccion_id: interaccionId,
      p_estado_final: estadoFinal,
      p_detalle_sanitizado: { resuelto_desde: 'refine' },
    })
    if (rpcError) setError(rpcError.message)
    else onResuelto()
    setResolviendo(false)
  }

  return (
    <Stack spacing={1}>
      {error && <EstadoError titulo="No pudimos resolver esta interacción." descripcion={error} />}
      <Stack direction="row" spacing={1}>
        <Button disabled={resolviendo} onClick={() => void resolver('completada')}>Completar</Button>
        <Button color="warning" disabled={resolviendo} onClick={() => void resolver('rechazada')}>Rechazar</Button>
        <Button color="error" disabled={resolviendo} onClick={() => void resolver('cancelada')}>Cancelar</Button>
      </Stack>
    </Stack>
  )
}
