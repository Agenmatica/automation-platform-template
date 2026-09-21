import { describe, expect, it } from 'vitest'
import { completarInteraccion, iniciarInteraccion, iniciarInvocacion, registrarFallo, type PoliticaActiva } from './index.js'

const politica: PoliticaActiva = { id: 'p', contratoId: 'c', perfilPrincipalId: 'principal', perfilFallbackId: 'fallback', limiteIntentos: 2, limiteSegundos: 90, estado: 'aprobada' }
describe('interacciones IA', () => {
  it('usa fallback una vez frente a timeout y conserva el presupuesto total', () => {
    const invocando = iniciarInvocacion(iniciarInvocacion(iniciarInteraccion(), politica), politica)
    const conFallback = registrarFallo(invocando, politica, 'timeout')
    expect(conFallback).toMatchObject({ estado: 'invocando', intentos: 2, perfilEfectivoId: 'fallback' })
    expect(registrarFallo(conFallback, politica, 'tecnico').estado).toBe('revision_humana')
  })
  it('no usa fallback después de rechazo de contrato o verificador', () => {
    const invocando = iniciarInvocacion(iniciarInvocacion(iniciarInteraccion(), politica), politica)
    expect(registrarFallo(invocando, politica, 'contrato').estado).toBe('rechazada')
    expect(registrarFallo(invocando, politica, 'verificador').estado).toBe('rechazada')
  })
  it('registra la secuencia validada antes de completar', () => {
    const completada = completarInteraccion(iniciarInvocacion(iniciarInvocacion(iniciarInteraccion(), politica), politica))
    expect(completada.eventos.map((evento) => evento.estado)).toEqual(['preparando', 'invocando', 'respuesta_validada', 'completada'])
  })
})
