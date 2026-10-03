import { describe, expect, it, vi } from 'vitest'
import type { ContratoConsumidor } from '@platform/ia'
import type { PoliticaActiva } from '@platform/ia'
import { intentarRecuperarPaso } from './intentarRecuperarPaso.js'
import type { AccionPermitida, AdaptadorInvocacionIa, PasoRecuperable } from './tipos.js'

const DOMINIO = 'ejemplo.test'

function contratoFixture(): ContratoConsumidor {
  return {
    codigo: 'fallback-navegacion-fixture',
    version: 1,
    esquemaEntrada: {},
    esquemaSalida: {},
    datosPermitidos: ['pagina', 'bloqueo'],
    limiteIntentos: 2,
    limiteSegundos: 90,
  }
}

function politicaFixture(overrides: Partial<PoliticaActiva> = {}): PoliticaActiva {
  return {
    id: 'politica-fixture',
    contratoId: 'contrato-fixture',
    perfilPrincipalId: 'perfil-principal',
    perfilFallbackId: null,
    limiteIntentos: 2,
    limiteSegundos: 90,
    estado: 'aprobada',
    ...overrides,
  }
}

const accionClick: AccionPermitida = { tipo: 'click_en_elemento', objetivo: 'boton_confirmar' }

function pasoFixture(overrides: Partial<PasoRecuperable> = {}): PasoRecuperable {
  return {
    alcance: { dominioPermitido: DOMINIO },
    accionesPermitidas: [accionClick],
    verificador: vi.fn(async () => true),
    checkpoint: { idempotencyKey: 'checkpoint-fixture' },
    contexto: { pagina: 'reporte', bloqueo: 'filtro' },
    ...overrides,
  }
}

function adaptadorFixture(overrides: Partial<AdaptadorInvocacionIa> = {}): AdaptadorInvocacionIa {
  return {
    invocarProveedor: vi.fn(async () => accionClick),
    resolverObjetivo: vi.fn(() => ({ dominio: DOMINIO })),
    ejecutarAccion: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('intentarRecuperarPaso — User Story 1: recuperación exitosa', () => {
  it('ejecuta exactamente una acción del vocabulario declarado y devuelve estado recuperado', async () => {
    const paso = pasoFixture()
    const adaptador = adaptadorFixture()

    const resultado = await intentarRecuperarPaso(paso, politicaFixture(), contratoFixture(), adaptador)

    expect(resultado.estado).toBe('recuperado')
    expect(adaptador.ejecutarAccion).toHaveBeenCalledTimes(1)
    expect(adaptador.ejecutarAccion).toHaveBeenCalledWith(accionClick)
  })
})

describe('intentarRecuperarPaso — User Story 2: checkpoint y no duplicación', () => {
  it('devuelve el checkpoint declarado idéntico, solo en éxito', async () => {
    const checkpoint = { idempotencyKey: 'checkpoint-unico' }
    const paso = pasoFixture({ checkpoint })

    const resultado = await intentarRecuperarPaso(paso, politicaFixture(), contratoFixture(), adaptadorFixture())

    expect(resultado.estado).toBe('recuperado')
    if (resultado.estado === 'recuperado') expect(resultado.checkpoint).toBe(checkpoint)
  })

  it('en un resultado no_recuperable, checkpoint es null', async () => {
    const paso = pasoFixture()
    const politicaInactiva = politicaFixture({ estado: 'aprobada' as const, id: '' })

    const resultado = await intentarRecuperarPaso(paso, politicaInactiva, contratoFixture(), adaptadorFixture())

    expect(resultado.estado).toBe('no_recuperable')
    expect(resultado.checkpoint).toBeNull()
  })

  it('nunca llama a ejecutarAccion más de una vez por invocación', async () => {
    const paso = pasoFixture({ verificador: vi.fn(async () => false) })
    const adaptador = adaptadorFixture()

    await intentarRecuperarPaso(paso, politicaFixture(), contratoFixture(), adaptador)

    expect(adaptador.ejecutarAccion).toHaveBeenCalledTimes(1)
  })
})

describe('intentarRecuperarPaso — User Story 3: casos no recuperables', () => {
  it('rechaza sin ejecutar cuando la acción propuesta no pertenece al vocabulario declarado', async () => {
    const paso = pasoFixture()
    const adaptador = adaptadorFixture({
      invocarProveedor: vi.fn(async () => ({ tipo: 'click_en_elemento', objetivo: 'boton_no_declarado' })),
    })

    const resultado = await intentarRecuperarPaso(paso, politicaFixture(), contratoFixture(), adaptador)

    expect(resultado).toMatchObject({ estado: 'no_recuperable', motivo: 'sin_acciones_permitidas', checkpoint: null })
    expect(adaptador.ejecutarAccion).not.toHaveBeenCalled()
  })

  it('rechaza sin ejecutar cuando el objetivo resuelve a un dominio distinto del declarado', async () => {
    const paso = pasoFixture()
    const adaptador = adaptadorFixture({ resolverObjetivo: vi.fn(() => ({ dominio: 'otro-dominio.test' })) })

    const resultado = await intentarRecuperarPaso(paso, politicaFixture(), contratoFixture(), adaptador)

    expect(resultado).toMatchObject({ estado: 'no_recuperable', motivo: 'dominio_no_autorizado', checkpoint: null })
    expect(adaptador.ejecutarAccion).not.toHaveBeenCalled()
  })

  it('un verificador que resuelve false termina de inmediato sin segunda llamada a ejecutarAccion', async () => {
    const paso = pasoFixture({ verificador: vi.fn(async () => false) })
    const adaptador = adaptadorFixture()

    const resultado = await intentarRecuperarPaso(paso, politicaFixture(), contratoFixture(), adaptador)

    expect(resultado).toMatchObject({ estado: 'no_recuperable', motivo: 'verificador_rechazado', checkpoint: null })
    expect(adaptador.ejecutarAccion).toHaveBeenCalledTimes(1)
  })

  it('un verificador que lanza se trata igual que uno que resuelve false', async () => {
    const paso = pasoFixture({ verificador: vi.fn(async () => { throw new Error('boom') }) })

    const resultado = await intentarRecuperarPaso(paso, politicaFixture(), contratoFixture(), adaptadorFixture())

    expect(resultado).toMatchObject({ estado: 'no_recuperable', motivo: 'verificador_rechazado' })
  })

  it('una política inactiva devuelve sin_politica_activa sin invocar al proveedor', async () => {
    const paso = pasoFixture()
    const adaptador = adaptadorFixture()
    const politicaInactiva = politicaFixture({ id: '' })

    const resultado = await intentarRecuperarPaso(paso, politicaInactiva, contratoFixture(), adaptador)

    expect(resultado).toMatchObject({ estado: 'no_recuperable', motivo: 'sin_politica_activa' })
    expect(adaptador.invocarProveedor).not.toHaveBeenCalled()
  })

  it('un presupuesto de intentos agotado devuelve presupuesto_agotado', async () => {
    const paso = pasoFixture()
    const adaptador = adaptadorFixture()
    // iniciarInvocacion ya deja intentos=1 al abrir la invocación; con
    // limiteIntentos=1, validarPresupuesto(1, 1, ...) lanza LIMITE_INTENTOS_IA
    // de inmediato, antes de invocar al proveedor.
    const politicaSinIntentos = politicaFixture({ limiteIntentos: 1 })

    const resultado = await intentarRecuperarPaso(paso, politicaSinIntentos, contratoFixture(), adaptador)

    expect(resultado).toMatchObject({ estado: 'no_recuperable', motivo: 'presupuesto_agotado' })
    expect(adaptador.invocarProveedor).not.toHaveBeenCalled()
  })

  it('no expone ni recibe ningún contador de intentos propio distinto al de la política', () => {
    expect(intentarRecuperarPaso.length).toBe(4)
  })

  it('un error técnico del proveedor devuelve error_tecnico sin ejecutar ninguna acción', async () => {
    const paso = pasoFixture()
    const adaptador = adaptadorFixture({ invocarProveedor: vi.fn(async () => { throw new Error('timeout') }) })

    const resultado = await intentarRecuperarPaso(paso, politicaFixture(), contratoFixture(), adaptador)

    expect(resultado).toMatchObject({ estado: 'no_recuperable', motivo: 'error_tecnico' })
    expect(adaptador.ejecutarAccion).not.toHaveBeenCalled()
  })

  it('un paso sin acciones permitidas se detiene sin invocar al proveedor', async () => {
    const paso = pasoFixture({ accionesPermitidas: [] })
    const adaptador = adaptadorFixture()

    const resultado = await intentarRecuperarPaso(paso, politicaFixture(), contratoFixture(), adaptador)

    expect(resultado).toMatchObject({ estado: 'no_recuperable', motivo: 'sin_acciones_permitidas' })
    expect(adaptador.invocarProveedor).not.toHaveBeenCalled()
  })
})
