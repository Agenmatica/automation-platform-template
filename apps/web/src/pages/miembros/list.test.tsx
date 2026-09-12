import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const createSignedUrl = vi.hoisted(() => vi.fn())
const storageFrom = vi.hoisted(() => vi.fn(() => ({ createSignedUrl })))
const rpc = vi.hoisted(() => vi.fn())

vi.mock('@refinedev/mui', () => ({ List: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }))
vi.mock('../../hooks/usePuedeGestionarMembresias', () => ({ usePuedeGestionarMembresias: () => ({ puedeEscribir: false, isLoading: false }) }))
vi.mock('../../lib/supabase', () => ({ supabaseClient: { storage: { from: storageFrom }, rpc } }))

import { MiembroList } from './list'

describe('MiembroList', () => {
  it('obtiene la foto del integrante desde Storage y nunca consulta perfiles ajenos', async () => {
    rpc.mockResolvedValue({ data: [{ user_id: 'member-a', rol_id: 'miembro', created_at: '2026-01-01T00:00:00Z', nombre: 'Mia', apellido: 'Miembro' }], error: null })
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.test/member-a' } })
    render(<MiembroList />)

    await waitFor(() => expect(createSignedUrl).toHaveBeenCalledWith('member-a/avatar', 60))
    expect(rpc).toHaveBeenCalledWith('listar_miembros_organizacion')
    expect(storageFrom).toHaveBeenCalledWith('fotos-perfil')
    expect(screen.getByAltText('Foto de member-a')).toHaveAttribute('src', 'https://storage.test/member-a')
  })

  it('muestra una representación neutra cuando Storage no autoriza o no encuentra foto', async () => {
    rpc.mockResolvedValue({ data: [{ user_id: 'member-a', rol_id: 'miembro', created_at: '2026-01-01T00:00:00Z', nombre: 'Mia', apellido: 'Miembro' }], error: null })
    createSignedUrl.mockResolvedValue({ data: null })
    render(<MiembroList />)

    await waitFor(() => expect(createSignedUrl).toHaveBeenCalled())
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('muestra apellido y nombre en columnas separadas, nunca el user_id crudo', async () => {
    rpc.mockResolvedValue({ data: [{ user_id: 'member-a', rol_id: 'miembro', created_at: '2026-01-01T00:00:00Z', nombre: 'Mia', apellido: 'Miembro' }], error: null })
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.test/member-a' } })
    render(<MiembroList />)

    await waitFor(() => expect(screen.getByText('Miembro')).toBeInTheDocument())
    expect(screen.getByText('Mia')).toBeInTheDocument()
    expect(screen.queryByText('member-a')).not.toBeInTheDocument()
  })

  it('muestra un texto explícito por columna cuando el perfil de la persona no está cargado', async () => {
    rpc.mockResolvedValue({ data: [{ user_id: 'member-b', rol_id: 'miembro', created_at: '2026-01-01T00:00:00Z', nombre: null, apellido: null }], error: null })
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.test/member-b' } })
    render(<MiembroList />)

    await waitFor(() => expect(screen.getByText('Sin apellido completado')).toBeInTheDocument())
    expect(screen.getByText('Sin nombre completado')).toBeInTheDocument()
    expect(screen.queryByText('member-b')).not.toBeInTheDocument()
  })
})
