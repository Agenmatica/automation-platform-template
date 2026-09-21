export function validarPresupuesto(intentos: number, limiteIntentos: number, iniciadoEn: Date, limiteSegundos: number): void {
  if (intentos >= limiteIntentos) throw new Error('LIMITE_INTENTOS_IA')
  if (Date.now() - iniciadoEn.getTime() >= limiteSegundos * 1000) throw new Error('LIMITE_TIEMPO_IA')
}

export function validarSalida(valor: unknown): asserts valor is Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('RESPUESTA_IA_INVALIDA')
}
