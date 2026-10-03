import {
  type PoliticaActiva,
  type ContratoConsumidor,
  validarPoliticaActiva,
  validarPresupuesto,
  sanitizarDato,
  iniciarInteraccion,
  iniciarInvocacion,
  registrarFallo,
  completarInteraccion,
} from '@platform/ia'
import type { AccionPermitida, AdaptadorInvocacionIa, MotivoNoRecuperable, PasoRecuperable, ResultadoInvocacion } from './tipos.js'

function accionPermitida(propuesta: unknown, permitidas: readonly AccionPermitida[]): AccionPermitida | null {
  if (!propuesta || typeof propuesta !== 'object') return null
  const candidata = propuesta as Partial<AccionPermitida>
  const coincide = permitidas.find((accion) => accion.tipo === candidata.tipo && accion.objetivo === candidata.objetivo)
  return coincide ?? null
}

function noRecuperable(interaccionId: string, motivo: MotivoNoRecuperable): ResultadoInvocacion {
  return { estado: 'no_recuperable', checkpoint: null, interaccionId, motivo }
}

export async function intentarRecuperarPaso(
  paso: PasoRecuperable,
  politica: PoliticaActiva,
  contratoConsumidor: ContratoConsumidor,
  adaptadorIa: AdaptadorInvocacionIa,
): Promise<ResultadoInvocacion> {
  const interaccionId = crypto.randomUUID()
  const iniciadoEn = new Date()

  if (paso.accionesPermitidas.length === 0) return noRecuperable(interaccionId, 'sin_acciones_permitidas')

  try {
    validarPoliticaActiva(politica)
  } catch {
    return noRecuperable(interaccionId, 'sin_politica_activa')
  }

  // Handshake de dos pasos del núcleo: iniciada -> preparando -> invocando
  // (perfil principal, intentos = 1). Ver packages/ia/src/interacciones.ts.
  let interaccion = iniciarInteraccion()
  interaccion = iniciarInvocacion(interaccion, politica)
  interaccion = iniciarInvocacion(interaccion, politica)

  const entradaSanitizada = sanitizarDato(paso.contexto, contratoConsumidor.datosPermitidos) as Record<string, unknown>

  let propuesta: unknown
  for (;;) {
    try {
      validarPresupuesto(interaccion.intentos, politica.limiteIntentos, iniciadoEn, politica.limiteSegundos)
    } catch {
      return noRecuperable(interaccionId, 'presupuesto_agotado')
    }

    const perfilActual = interaccion.perfilEfectivoId ?? politica.perfilPrincipalId
    try {
      propuesta = await adaptadorIa.invocarProveedor(entradaSanitizada, perfilActual)
      break
    } catch {
      interaccion = registrarFallo(interaccion, politica, 'tecnico')
      if (interaccion.estado === 'invocando') continue // fallback técnico concedido, reintentar
      return noRecuperable(interaccionId, 'error_tecnico') // revision_humana, sin más fallback
    }
  }

  const accion = accionPermitida(propuesta, paso.accionesPermitidas)
  if (!accion) {
    registrarFallo(interaccion, politica, 'contrato')
    return noRecuperable(interaccionId, 'sin_acciones_permitidas')
  }

  const objetivoResuelto = adaptadorIa.resolverObjetivo(accion.objetivo)
  if (!objetivoResuelto || objetivoResuelto.dominio !== paso.alcance.dominioPermitido) {
    registrarFallo(interaccion, politica, 'contrato')
    return noRecuperable(interaccionId, 'dominio_no_autorizado')
  }

  await adaptadorIa.ejecutarAccion(accion)

  let verificado: boolean
  try {
    verificado = await paso.verificador(accion)
  } catch {
    verificado = false
  }

  if (!verificado) {
    registrarFallo(interaccion, politica, 'verificador')
    return noRecuperable(interaccionId, 'verificador_rechazado')
  }

  completarInteraccion(interaccion)
  return { estado: 'recuperado', checkpoint: paso.checkpoint, interaccionId, motivo: null }
}
