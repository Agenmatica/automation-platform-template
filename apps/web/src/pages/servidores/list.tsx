import { useEffect, useState } from 'react'
import { useTable } from '@refinedev/core'
import { List } from '@refinedev/mui'
import {
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { useIsSuperadmin } from '../../hooks/useIsSuperadmin'
import { supabaseClient } from '../../lib/supabase'

type ServidorOrganizacion = {
  id: string
  organizacion_id: string
  host: string
  puerto_ssh: number
  usuario_ssh: string
  created_at: string
}

// Pantalla superadmin-only (US5, FR-014): listado de servidores de
// organización ya aprovisionados (host, organización, fecha de alta) +
// botón "Crear servidor" (lo agrega <List> solo si canCreate, ver App.tsx).
// Nunca muestra credencial_ssh_vault_id/credencial_db_vault_id — ni
// siquiera llegan acá: el GRANT de columna de la migración ya las excluye
// (R4, data-model.md).
export function ServidorList() {
  const { isSuperadmin, isLoading: checkingSuperadmin } = useIsSuperadmin()
  const { tableQuery } = useTable<ServidorOrganizacion>({ resource: 'servidores_organizacion' })
  const [nombresOrganizacion, setNombresOrganizacion] = useState<Record<string, string>>({})

  useEffect(() => {
    // El superadmin ya ve todas las organizaciones (RLS de spec 003) — esta
    // consulta aparte solo arma el mapa id → nombre para la columna
    // "Organización" de la tabla de abajo.
    let activa = true
    supabaseClient
      .from('organizaciones')
      .select('id, nombre')
      .then(({ data }) => {
        if (!activa || !data) return
        setNombresOrganizacion(Object.fromEntries(data.map((o) => [o.id, o.nombre])))
      })
    return () => {
      activa = false
    }
  }, [])

  if (checkingSuperadmin) {
    return null
  }

  if (!isSuperadmin) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Esta pantalla es solo para el superadmin de la plataforma.
      </Alert>
    )
  }

  const servidores = tableQuery.data?.data ?? []

  return (
    <List title="Servidores de organización">
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Organización</TableCell>
              <TableCell>Host</TableCell>
              <TableCell>Puerto SSH</TableCell>
              <TableCell>Usuario SSH</TableCell>
              <TableCell>Alta</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {servidores.map((servidor) => (
              <TableRow key={servidor.id}>
                <TableCell>{nombresOrganizacion[servidor.organizacion_id] ?? servidor.organizacion_id}</TableCell>
                <TableCell>{servidor.host}</TableCell>
                <TableCell>{servidor.puerto_ssh}</TableCell>
                <TableCell>{servidor.usuario_ssh}</TableCell>
                <TableCell>{new Date(servidor.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </List>
  )
}
