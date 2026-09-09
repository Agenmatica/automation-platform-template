import { useState } from 'react'
import { useTable } from '@refinedev/core'
import { List } from '@refinedev/mui'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { usePuedeGestionarMembresias } from '../../hooks/usePuedeGestionarMembresias'
import { supabaseClient } from '../../lib/supabase'

type Miembro = { user_id: string; rol_id: string; created_at: string }
type CambioPendiente = { miembro: Miembro; nuevoRol: string }

export function MiembroList() {
  const { tableQuery } = useTable<Miembro>({ resource: 'usuarios_organizacion' })
  const { puedeEscribir, isLoading: checkingPermiso } = usePuedeGestionarMembresias()
  const [rolesPendientes, setRolesPendientes] = useState<Record<string, string>>({})
  const [cambioPendiente, setCambioPendiente] = useState<CambioPendiente | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const miembros = tableQuery.data?.data ?? []

  const confirmarCambio = async () => {
    if (!cambioPendiente) return

    setGuardando(true)
    setError(null)
    const { error: rpcError } = await supabaseClient.rpc('cambiar_rol_miembro', {
      p_target_user_id: cambioPendiente.miembro.user_id,
      p_nuevo_rol: cambioPendiente.nuevoRol,
    })

    if (rpcError) {
      setError(rpcError.message)
      setGuardando(false)
      return
    }

    setRolesPendientes((actuales) => {
      const siguientes = { ...actuales }
      delete siguientes[cambioPendiente.miembro.user_id]
      return siguientes
    })
    setCambioPendiente(null)
    setGuardando(false)
    await tableQuery.refetch()
  }

  return (
    <List title="Miembros">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Usuario</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Incorporado</TableCell>
              {puedeEscribir && <TableCell>Acciones</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {miembros.map((miembro) => {
              const nuevoRol = rolesPendientes[miembro.user_id] ?? miembro.rol_id
              return (
                <TableRow key={miembro.user_id}>
                  <TableCell>{miembro.user_id}</TableCell>
                  <TableCell>
                    {puedeEscribir ? (
                      <TextField
                        select
                        size="small"
                        aria-label={`Rol de ${miembro.user_id}`}
                        value={nuevoRol}
                        onChange={(event) => setRolesPendientes((actuales) => ({
                          ...actuales,
                          [miembro.user_id]: event.target.value,
                        }))}
                      >
                        <MenuItem value="miembro">Miembro</MenuItem>
                        <MenuItem value="administrador">Administrador</MenuItem>
                      </TextField>
                    ) : miembro.rol_id}
                  </TableCell>
                  <TableCell>{new Date(miembro.created_at).toLocaleString()}</TableCell>
                  {puedeEscribir && (
                    <TableCell>
                      <Button
                        size="small"
                        disabled={checkingPermiso || nuevoRol === miembro.rol_id}
                        onClick={() => setCambioPendiente({ miembro, nuevoRol })}
                      >
                        Cambiar rol
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={Boolean(cambioPendiente)} onClose={() => !guardando && setCambioPendiente(null)}>
        <DialogTitle>Confirmar cambio de rol</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`¿Cambiar el rol de esta persona a ${cambioPendiente?.nuevoRol ?? ''}?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCambioPendiente(null)} disabled={guardando}>Cancelar</Button>
          <Button onClick={confirmarCambio} variant="contained" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </List>
  )
}
