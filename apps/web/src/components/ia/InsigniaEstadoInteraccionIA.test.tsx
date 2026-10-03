import { render, screen } from '@testing-library/react'
import type { EstadoInteraccion } from '@platform/ia'
import { describe, expect, it } from 'vitest'
import { ESTADOS_NECESITAN_ACCION_HUMANA } from './estadosNecesitanAccionHumana'
import { InsigniaEstadoInteraccionIA } from './InsigniaEstadoInteraccionIA'

const CASOS: Array<[EstadoInteraccion, string]> = [
  ['iniciada', 'En curso'],
  ['preparando', 'En curso'],
  ['invocando', 'En curso'],
  ['respuesta_validada', 'En curso'],
  ['completada', 'Completada'],
  ['esperando_aprobacion', 'Espera aprobación'],
  ['revision_humana', 'Revisión humana'],
  ['rechazada', 'Rechazada'],
  ['fallida_tecnica', 'Falla técnica'],
  ['cancelada', 'Cancelada'],
]

describe('InsigniaEstadoInteraccionIA', () => {
  it.each(CASOS)('muestra una etiqueta para el estado %s', (estado, etiquetaEsperada) => {
    render(<InsigniaEstadoInteraccionIA estado={estado} />)

    expect(screen.getByText(etiquetaEsperada)).toBeInTheDocument()
  })

  it('distingue esperando_aprobacion de completada y de un estado terminal sin éxito', () => {
    const { rerender } = render(<InsigniaEstadoInteraccionIA estado="esperando_aprobacion" />)
    const colorEspera = screen.getByText('Espera aprobación').closest('.MuiChip-root')?.className

    rerender(<InsigniaEstadoInteraccionIA estado="completada" />)
    const colorExito = screen.getByText('Completada').closest('.MuiChip-root')?.className

    rerender(<InsigniaEstadoInteraccionIA estado="rechazada" />)
    const colorError = screen.getByText('Rechazada').closest('.MuiChip-root')?.className

    expect(colorEspera).not.toBe(colorExito)
    expect(colorEspera).not.toBe(colorError)
    expect(colorExito).not.toBe(colorError)
  })

  it.each(['iniciada', 'preparando', 'invocando', 'respuesta_validada'] as EstadoInteraccion[])(
    'usa un indicador de progreso (no un color estático) para el estado en curso %s',
    (estado) => {
      render(<InsigniaEstadoInteraccionIA estado={estado} />)

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    },
  )

  it('no muestra un indicador de progreso para un estado terminal', () => {
    render(<InsigniaEstadoInteraccionIA estado="completada" />)

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it.each(ESTADOS_NECESITAN_ACCION_HUMANA)(
    'usa el mismo color de advertencia que AccionesResolucionInteraccionIA sabe resolver: %s',
    (estado) => {
      const { container } = render(<InsigniaEstadoInteraccionIA estado={estado} />)

      expect(container.querySelector('.MuiChip-colorWarning')).toBeInTheDocument()
    },
  )
})
