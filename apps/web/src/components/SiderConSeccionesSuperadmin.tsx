import { isValidElement } from 'react'
import { Box, Divider, Typography } from '@mui/material'
import { ThemedSider } from '@refinedev/mui'
import { useIsSuperadmin } from '../hooks/useIsSuperadmin'
import { useOrganizacionActiva } from '../hooks/useOrganizacionActiva'

const RECURSOS_EXCLUSIVOS_SUPERADMIN = new Set([
  'organizaciones',
  'analitica-administrar',
  'features-administrar',
  'servidores',
  'ia',
])
const RECURSOS_DE_ORGANIZACION = new Set(['clientes', 'miembros', 'analitica', 'conexiones', 'ejecuciones'])

function recursoDeItem(item: React.ReactNode) {
  if (!isValidElement(item)) {
    return null
  }

  const props = item.props as { resource?: unknown }
  return typeof props.resource === 'string' ? props.resource : null
}

function SeparadorDeSeccion({ etiqueta, collapsed }: { etiqueta: string; collapsed: boolean }) {
  return (
    <Box component="li" sx={{ listStyle: 'none', px: collapsed ? 1 : 2, pt: 2, pb: 0.5 }}>
      {!collapsed && (
        <Typography
          color="text.secondary"
          variant="overline"
          sx={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.5, px: 1 }}
        >
          {etiqueta}
        </Typography>
      )}
      <Divider />
    </Box>
  )
}

// Para quien opera como superadmin, separa la administración global de las
// pantallas que actúan sobre la organización elegida. El Sider base conserva
// CanAccess: los ítems que no correspondan nunca se renderizan.
export function SiderConSeccionesSuperadmin() {
  const { isSuperadmin, isLoading: cargandoSuperadmin } = useIsSuperadmin()
  const { organizacionActiva, isLoading: cargandoOrganizacion } = useOrganizacionActiva()

  return (
    <ThemedSider
      render={({ items, logout, collapsed }) => {
        if (cargandoSuperadmin || isSuperadmin !== true) {
          return <>{items}{logout}</>
        }

        const exclusivos = items.filter((item) => RECURSOS_EXCLUSIVOS_SUPERADMIN.has(recursoDeItem(item) ?? ''))
        const organizacion = items.filter((item) => RECURSOS_DE_ORGANIZACION.has(recursoDeItem(item) ?? ''))
        const personales = items.filter((item) => {
          const recurso = recursoDeItem(item)
          return !RECURSOS_EXCLUSIVOS_SUPERADMIN.has(recurso ?? '') && !RECURSOS_DE_ORGANIZACION.has(recurso ?? '')
        })

        return (
          <>
            <SeparadorDeSeccion etiqueta="Plataforma" collapsed={collapsed} />
            {exclusivos}
            {!cargandoOrganizacion && organizacionActiva && (
              <>
                <SeparadorDeSeccion etiqueta="Organización activa" collapsed={collapsed} />
                {organizacion}
              </>
            )}
            {personales}
            {logout}
          </>
        )
      }}
    />
  )
}
