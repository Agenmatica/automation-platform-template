import type { AccessControlProvider } from '@refinedev/core'
import { checkIsSuperadmin, checkOrganizacionActiva } from '../lib/superadmin'
import { supabaseClient } from '../lib/supabase'
import { RECURSOS_DEPENDIENTES_DE_ORGANIZACION } from '../lib/recursosDependientesDeOrganizacion'

// Gatea dos categorías de recurso:
// - "organizaciones" (spec 003, US2/AC2, FR-008, FR-010): solo superadmin.
// - RECURSOS_DEPENDIENTES_DE_ORGANIZACION (spec 004, FR-001/FR-002): para
//   administrador/miembro no cambia nada (siempre los ven); para
//   superadmin, solo si tiene una organización activa — si no, ni
//   aparecen en el menú, en vez de mostrar una pantalla vacía sin
//   contexto.
// Sin esto, el Sider de @refinedev/mui muestra el ítem de menú a
// cualquier usuario autenticado aunque la pantalla en sí ya esté
// bloqueada — el navegar no debería ni ofrecer la opción.
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource }) => {
    if (resource === 'organizaciones') {
      const { data } = await supabaseClient.auth.getUser()
      if (!data?.user) {
        return { can: false }
      }

      return { can: await checkIsSuperadmin(data.user.id) }
    }

    if ((RECURSOS_DEPENDIENTES_DE_ORGANIZACION as readonly string[]).includes(resource ?? '')) {
      const { data } = await supabaseClient.auth.getUser()
      if (!data?.user) {
        return { can: false }
      }

      const esSuperadmin = await checkIsSuperadmin(data.user.id)
      if (!esSuperadmin) {
        return { can: true }
      }

      const organizacionActiva = await checkOrganizacionActiva(data.user.id)
      return { can: organizacionActiva !== null }
    }

    return { can: true }
  },
}
