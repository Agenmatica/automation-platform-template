export type OrigenInteraccion = 'aplicacion' | 'worker' | 'kestra'

export type EstadoInteraccion = 'iniciada' | 'preparando' | 'invocando' | 'respuesta_validada' | 'completada' | 'rechazada' | 'fallida_tecnica' | 'revision_humana' | 'cancelada'

export type PerfilModelo = { id: string; proveedorCodigo: string; modeloId: string }

export type ContratoConsumidor = {
  codigo: string
  version: number
  esquemaEntrada: object
  esquemaSalida: object
  datosPermitidos: readonly string[]
  limiteIntentos: number
  limiteSegundos: number
}

export type ResultadoSanitizado = { estado: EstadoInteraccion; intentos: number; resultado?: object; errorSanitizado?: string }
