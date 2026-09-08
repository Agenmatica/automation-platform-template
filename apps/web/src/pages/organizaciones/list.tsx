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

type Organizacion = {
  id: string
  nombre: string
  created_at: string
}

// Pantalla superadmin-only (FR-008): listado de organizaciones + botón
// "Crear organización" (lo agrega <List> solo si canCreate, ver App.tsx).
// La acción "Ingresar" por fila se suma en la Historia 4 (US4).
export function OrganizacionList() {
  const { isSuperadmin, isLoading: checkingSuperadmin } = useIsSuperadmin()
  const { tableQuery } = useTable<Organizacion>({ resource: 'organizaciones' })

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

  const organizaciones = tableQuery.data?.data ?? []

  return (
    <List title="Organizaciones">
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Creada</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {organizaciones.map((organizacion) => (
              <TableRow key={organizacion.id}>
                <TableCell>{organizacion.nombre}</TableCell>
                <TableCell>{new Date(organizacion.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </List>
  )
}
