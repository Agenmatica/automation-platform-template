export type Alcance = { dominioPermitido: string }

export type AccionPermitida =
  | { tipo: 'completar_campo'; objetivo: string; valorPermitido?: readonly string[] }
  | { tipo: 'click_en_elemento'; objetivo: string }
  | { tipo: 'esperar_elemento'; objetivo: string; timeoutMs: number }
  | { tipo: 'confirmar_descarga'; objetivo: string }

export type Verificador = (contextoPosterior: unknown) => Promise<boolean>

export type CheckpointReanudacion = { idempotencyKey: string }

export type PasoRecuperable = {
  alcance: Alcance
  accionesPermitidas: readonly AccionPermitida[]
  verificador: Verificador
  checkpoint: CheckpointReanudacion
  contexto: Record<string, unknown>
}

export type MotivoNoRecuperable =
  | 'sin_acciones_permitidas'
  | 'dominio_no_autorizado'
  | 'verificador_rechazado'
  | 'sin_politica_activa'
  | 'presupuesto_agotado'
  | 'error_tecnico'

export type ResultadoInvocacion =
  | { estado: 'recuperado'; checkpoint: CheckpointReanudacion; interaccionId: string; motivo: null }
  | { estado: 'no_recuperable'; checkpoint: null; interaccionId: string; motivo: MotivoNoRecuperable }

export type AdaptadorInvocacionIa = {
  invocarProveedor: (entradaSanitizada: Record<string, unknown>, perfilId: string) => Promise<unknown>
  resolverObjetivo: (objetivo: string) => { dominio: string } | null
  ejecutarAccion: (accion: AccionPermitida) => Promise<void>
}
