import type { ContratoConsumidor } from './types.js'
import { validarPoliticaActiva, type PoliticaActiva } from './politicas.js'
import { sanitizarDato } from './sanitizar.js'
import { validarPresupuesto } from './validarContrato.js'

export function prepararInvocacion(
  contrato: ContratoConsumidor,
  politica: PoliticaActiva,
  entrada: unknown,
  intentos: number,
  iniciadoEn: Date,
): Record<string, unknown> {
  validarPoliticaActiva(politica)
  validarPresupuesto(intentos, politica.limiteIntentos, iniciadoEn, politica.limiteSegundos)
  const sanitizada = sanitizarDato(entrada, contrato.datosPermitidos)
  if (!sanitizada || typeof sanitizada !== 'object' || Array.isArray(sanitizada)) throw new Error('ENTRADA_IA_INVALIDA')
  return sanitizada as Record<string, unknown>
}

export function perfilParaFalloTecnico(politica: PoliticaActiva, tipoFallo: 'tecnico' | 'timeout' | 'respuesta_invalida' | 'contrato' | 'verificador'): string | null {
  validarPoliticaActiva(politica)
  if (tipoFallo === 'contrato' || tipoFallo === 'verificador') return null
  return politica.perfilFallbackId ?? null
}
