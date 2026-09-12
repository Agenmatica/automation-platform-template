import { useCallback, useEffect, useState } from 'react'
import { List } from '@refinedev/mui'
import {
  Alert,
  Avatar,
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

type Miembro = {
  user_id: string
  rol_id: string
  created_at: string
  nombre: string | null
  apellido: string | null
}
type CambioPendiente = { miembro: Miembro; nuevoRol: string }

function FotoMiembro({ userId }: { userId: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let activa = true
    // La ruta se deriva de la membresía autorizada; nunca se consulta perfiles_usuario.
    void supabaseClient.storage.from('fotos-perfil').createSignedUrl(`${userId}/avatar`, 60)
      .then(({ data }) => { if (activa) setUrl(data?.signedUrl ?? null) })
    return () => { activa = false }
  }, [userId])

  return <Avatar src={url ?? undefined} alt={`Foto de ${userId}`}>?</Avatar>
}

export function MiembroList() {
  const { puedeEscribir, isLoading: checkingPermiso } = usePuedeGestionarMembresias()
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [rolesPendientes, setRolesPendientes] = useState<Record<string, string>>({})
  const [cambioPendiente, setCambioPendiente] = useState<CambioPendiente | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [removiendo, setRemoviendo] = useState<string | null>(null)

  const cargarMiembros = useCallback(async () => {
    const { data, error: rpcError } = await supabaseClient.rpc('listar_miembros_organizacion')

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setMiembros(data ?? [])
  }, [])

  useEffect(() => {
    void cargarMiembros()
  }, [cargarMiembros])

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
    await cargarMiembros()
  }

  const removerMiembro = async (miembro: Miembro) => {
    if (!window.confirm('¿Remover a esta persona de la organización?')) return

    setRemoviendo(miembro.user_id)
    setError(null)
    const { error: rpcError } = await supabaseClient.rpc('remover_miembro', {
      p_target_user_id: miembro.user_id,
    })

    if (rpcError) {
      setError(rpcError.message)
      setRemoviendo(null)
      return
    }

    setRemoviendo(null)
    await cargarMiembros()
  }

  return (
    <List title="Miembros">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Foto</TableCell>
              <TableCell>Apellido</TableCell>
              <TableCell>Nombre</TableCell>
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
                  <TableCell><FotoMiembro userId={miembro.user_id} /></TableCell>
                  <TableCell>{miembro.apellido ?? 'Sin apellido completado'}</TableCell>
                  <TableCell>{miembro.nombre ?? 'Sin nombre completado'}</TableCell>
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
                      <Button
                        color="error"
                        size="small"
                        disabled={checkingPermiso || removiendo === miembro.user_id}
                        onClick={() => removerMiembro(miembro)}
                      >
                        {removiendo === miembro.user_id ? 'Removiendo…' : 'Remover'}
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
