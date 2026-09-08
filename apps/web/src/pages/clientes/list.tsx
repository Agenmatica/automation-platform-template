import { useTable } from '@refinedev/core'
import { EditButton, List } from '@refinedev/mui'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { usePuedeEscribir } from '../../hooks/usePuedeEscribir'

type Cliente = {
  id: string
  nombre: string
  created_at: string
}

// Visible para administrador y miembro por igual (US3): la diferencia es
// que el miembro no ve acciones de crear/editar. RLS aplica el mismo
// límite del lado del servidor aunque alguien llegue a /clientes/edit/:id
// directamente (FR-011).
export function ClienteList() {
  const { puedeEscribir } = usePuedeEscribir()
  const { tableQuery } = useTable<Cliente>({ resource: 'clientes' })
  const clientes = tableQuery.data?.data ?? []

  return (
    <List title="Clientes" headerButtons={puedeEscribir ? undefined : null}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Creado</TableCell>
              {puedeEscribir && <TableCell align="right">Acciones</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {clientes.map((cliente) => (
              <TableRow key={cliente.id}>
                <TableCell>{cliente.nombre}</TableCell>
                <TableCell>{new Date(cliente.created_at).toLocaleString()}</TableCell>
                {puedeEscribir && (
                  <TableCell align="right">
                    <EditButton hideText recordItemId={cliente.id} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </List>
  )
}
