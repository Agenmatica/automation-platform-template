import type { AccessControlProvider } from '@refinedev/core'
import { checkIsSuperadmin } from '../lib/superadmin'
import { supabaseClient } from '../lib/supabase'

// Solo gatea el recurso "organizaciones" (US2/AC2, FR-008, FR-010): sin
// esto, el Sider de @refinedev/mui muestra el ítem de menú a cualquier
// usuario autenticado aunque la pantalla en sí ya esté bloqueada
// (useIsSuperadmin) — el navegar no debería ni ofrecer la opción. Gap
// encontrado por /speckit-converge.
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource }) => {
    if (resource !== 'organizaciones') {
      return { can: true }
    }

    const { data } = await supabaseClient.auth.getUser()
    if (!data?.user) {
      return { can: false }
    }

    return { can: await checkIsSuperadmin(data.user.id) }
  },
}
