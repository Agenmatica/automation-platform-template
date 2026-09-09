import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useReportesAsignados } from '../../hooks/useReportesAsignados'
import { AnaliticaList } from './list'

// `List` de @refinedev/mui espera vivir dentro de un árbol <Refine> completo
// (breadcrumb, recursos, router) — acá no se está probando ese componente,
// así que se reemplaza por un contenedor simple y se aísla la lógica
// propia de esta pantalla (FR-011: estado vacío sin reportes asignados).
vi.mock('@refinedev/mui', () => ({
  List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../hooks/useReportesAsignados', () => ({
  useReportesAsignados: vi.fn(),
}))

describe('AnaliticaList', () => {
  it('muestra el mensaje de "sin reportes configurados" cuando la lista viene vacía', () => {
    vi.mocked(useReportesAsignados).mockReturnValue({ reportes: [], isLoading: false })

    render(<AnaliticaList />)

    expect(
      screen.getByText('Todavía no tenés reportes configurados para tu organización.'),
    ).toBeInTheDocument()
  })

  it('ofrece los reportes asignados como opciones del dropdown', () => {
    vi.mocked(useReportesAsignados).mockReturnValue({
      reportes: [{ id: 'r1', nombre: 'Ventas mensuales' }],
      isLoading: false,
    })

    render(<AnaliticaList />)

    // MUI Select renderiza las opciones en un Menu que solo existe en el
    // DOM una vez abierto — mismo patrón que el resto del repo para
    // interactuar con este componente en tests.
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Reporte' }))

    expect(within(screen.getByRole('listbox')).getByText('Ventas mensuales')).toBeInTheDocument()
  })
})
