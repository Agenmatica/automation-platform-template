import type { EstadoInteraccion } from './types.js'
import type { PoliticaActiva } from './politicas.js'
import { perfilParaFalloTecnico } from './ejecutar.js'

export type EventoInteraccion = { secuencia: number; estado: EstadoInteraccion; detalle: Record<string, unknown> }
export type InteraccionEnCurso = { estado: EstadoInteraccion; intentos: number; perfilEfectivoId: string | null; eventos: EventoInteraccion[] }

export function iniciarInteraccion(): InteraccionEnCurso { return { estado: 'iniciada', intentos: 0, perfilEfectivoId: null, eventos: [] } }

function transicionar(interaccion: InteraccionEnCurso, estado: EstadoInteraccion, detalle: Record<string, unknown> = {}): InteraccionEnCurso {
  return { ...interaccion, estado, eventos: [...interaccion.eventos, { secuencia: interaccion.eventos.length + 1, estado, detalle }] }
}

export function iniciarInvocacion(interaccion: InteraccionEnCurso, politica: PoliticaActiva): InteraccionEnCurso {
  if (interaccion.estado === 'iniciada') return transicionar(interaccion, 'preparando')
  if (interaccion.estado !== 'preparando') throw new Error('TRANSICION_IA_INVALIDA')
  return { ...transicionar(interaccion, 'invocando'), intentos: interaccion.intentos + 1, perfilEfectivoId: politica.perfilPrincipalId }
}

export function registrarFallo(interaccion: InteraccionEnCurso, politica: PoliticaActiva, fallo: 'tecnico' | 'timeout' | 'respuesta_invalida' | 'contrato' | 'verificador'): InteraccionEnCurso {
  if (interaccion.estado !== 'invocando') throw new Error('TRANSICION_IA_INVALIDA')
  const fallback = interaccion.intentos < politica.limiteIntentos ? perfilParaFalloTecnico(politica, fallo) : null
  if (fallback) return { ...transicionar(interaccion, 'invocando', { fallo, fallback: true }), intentos: interaccion.intentos + 1, perfilEfectivoId: fallback }
  if (fallo === 'contrato' || fallo === 'verificador') return transicionar(interaccion, 'rechazada', { fallo })
  return transicionar(interaccion, 'revision_humana', { fallo })
}

export function completarInteraccion(interaccion: InteraccionEnCurso): InteraccionEnCurso {
  if (interaccion.estado !== 'invocando') throw new Error('TRANSICION_IA_INVALIDA')
  return transicionar(transicionar(interaccion, 'respuesta_validada'), 'completada')
}
