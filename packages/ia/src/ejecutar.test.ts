import { describe, expect, it } from 'vitest'
import { perfilParaFalloTecnico, prepararInvocacion, validarPoliticaActiva, type ContratoConsumidor, type PoliticaActiva } from './index.js'

const contrato: ContratoConsumidor = { codigo: 'fixture', version: 1, esquemaEntrada: {}, esquemaSalida: {}, datosPermitidos: ['texto'], limiteIntentos: 2, limiteSegundos: 90 }
const politica: PoliticaActiva = { id: 'politica', contratoId: 'contrato', perfilPrincipalId: 'principal', perfilFallbackId: 'fallback-otro-proveedor', limiteIntentos: 2, limiteSegundos: 90, estado: 'aprobada' }

describe('ejecución gobernada', () => {
  it('valida política activa y prepara sólo los datos permitidos', () => {
    expect(prepararInvocacion(contrato, politica, { texto: 'permitido', token: 'no' }, 0, new Date())).toEqual({ texto: 'permitido' })
  })
  it('acepta fallback del mismo u otro proveedor únicamente ante fallo técnico previo', () => {
    expect(perfilParaFalloTecnico(politica, 'tecnico')).toBe('fallback-otro-proveedor')
    expect(perfilParaFalloTecnico(politica, 'timeout')).toBe('fallback-otro-proveedor')
    expect(perfilParaFalloTecnico(politica, 'contrato')).toBeNull()
    expect(perfilParaFalloTecnico(politica, 'verificador')).toBeNull()
  })
  it('rechaza límites fuera de la política global', () => {
    expect(() => validarPoliticaActiva({ ...politica, limiteIntentos: 3 })).toThrow('LIMITE_INTENTOS_IA_INVALIDO')
    expect(() => validarPoliticaActiva({ ...politica, limiteSegundos: 91 })).toThrow('LIMITE_TIEMPO_IA_INVALIDO')
  })
})
