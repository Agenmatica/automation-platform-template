import { describe, it, vi } from 'vitest'

// La pantalla se implementa en US1. Estos mocks establecen el límite del
// cliente: Auth y Storage se aíslan desde el comienzo, sin service-role.
vi.mock('../../lib/supabase', () => ({
  supabaseClient: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}))

describe('Perfil personal', () => {
  it.todo('carga y actualiza únicamente nombre y apellido del titular')
  it.todo('valida el correo y la contraseña actual antes de solicitar un cambio')
  it.todo('gestiona una foto propia y conserva la anterior ante un error')
  it.todo('muestra los datos de cuenta y los avisos de seguridad propios')
})
