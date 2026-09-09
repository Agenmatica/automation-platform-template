import { useTable } from '@refinedev/core'
import { List } from '@refinedev/mui'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'

type Miembro = { user_id: string; rol_id: string; created_at: string }
export function MiembroList() {
  const { tableQuery } = useTable<Miembro>({ resource: 'usuarios_organizacion' })
  const miembros = tableQuery.data?.data ?? []
  return <List title="Miembros"><TableContainer><Table><TableHead><TableRow><TableCell>Usuario</TableCell><TableCell>Rol</TableCell><TableCell>Incorporado</TableCell></TableRow></TableHead><TableBody>{miembros.map((miembro) => <TableRow key={miembro.user_id}><TableCell>{miembro.user_id}</TableCell><TableCell>{miembro.rol_id}</TableCell><TableCell>{new Date(miembro.created_at).toLocaleString()}</TableCell></TableRow>)}</TableBody></Table></TableContainer></List>
}
