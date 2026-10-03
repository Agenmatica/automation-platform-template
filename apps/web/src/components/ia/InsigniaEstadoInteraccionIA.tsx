import { Chip } from '@mui/material'
import type { EstadoInteraccion } from '@platform/ia'

const CATEGORIA_POR_ESTADO: Record<EstadoInteraccion, { color: 'info' | 'success' | 'warning' | 'error'; etiqueta: string }> = {
  iniciada: { color: 'info', etiqueta: 'En curso' },
  preparando: { color: 'info', etiqueta: 'En curso' },
  invocando: { color: 'info', etiqueta: 'En curso' },
  respuesta_validada: { color: 'info', etiqueta: 'En curso' },
  completada: { color: 'success', etiqueta: 'Completada' },
  esperando_aprobacion: { color: 'warning', etiqueta: 'Espera aprobación' },
  revision_humana: { color: 'warning', etiqueta: 'Revisión humana' },
  rechazada: { color: 'error', etiqueta: 'Rechazada' },
  fallida_tecnica: { color: 'error', etiqueta: 'Falla técnica' },
  cancelada: { color: 'error', etiqueta: 'Cancelada' },
}

export function InsigniaEstadoInteraccionIA({ estado }: { estado: EstadoInteraccion }) {
  const { color, etiqueta } = CATEGORIA_POR_ESTADO[estado]
  return <Chip size="small" color={color} label={etiqueta} />
}
