import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const createSignedUrl = vi.hoisted(() => vi.fn())
const storageFrom = vi.hoisted(() => vi.fn(() => ({ createSignedUrl })))

vi.mock('@refinedev/core', () => ({
  useTable: () => ({ tableQuery: { data: { data: [{ user_id: 'member-a', rol_id: 'miembro', created_at: '2026-01-01T00:00:00Z' }] } } }),
}))
vi.mock('@refinedev/mui', () => ({ List: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }))
vi.mock('../../hooks/usePuedeGestionarMembresias', () => ({ usePuedeGestionarMembresias: () => ({ puedeEscribir: false, isLoading: false }) }))
vi.mock('../../lib/supabase', () => ({ supabaseClient: { storage: { from: storageFrom } } }))

import { MiembroList } from './list'

describe('MiembroList', () => {
  it('obtiene la foto del integrante desde Storage y nunca consulta perfiles ajenos', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.test/member-a' } })
    render(<MiembroList />)

    await waitFor(() => expect(createSignedUrl).toHaveBeenCalledWith('member-a/avatar', 60))
    expect(storageFrom).toHaveBeenCalledWith('fotos-perfil')
    expect(screen.getByAltText('Foto de member-a')).toHaveAttribute('src', 'https://storage.test/member-a')
  })

  it('muestra una representación neutra cuando Storage no autoriza o no encuentra foto', async () => {
    createSignedUrl.mockResolvedValue({ data: null })
    render(<MiembroList />)

    await waitFor(() => expect(createSignedUrl).toHaveBeenCalled())
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
