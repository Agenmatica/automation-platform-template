import { useEffect, useState } from 'react'
import { EditButton, List } from '@refinedev/mui'
import { Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { usePuedeEscribir } from '../../hooks/usePuedeEscribir'
import { useOrganizacionDeTrabajo } from '../../hooks/useOrganizacionDeTrabajo'
import { supabaseClient } from '../../lib/supabase'

type Conexion = { id: string; sistema_externo: string; estado: 'activa' | 'error' | 'credencial_invalida'; created_at: string }

// Solo selecciona metadatos permitidos por el contrato; ni la credencial ni su
// identificador de Vault participan de esta consulta o de la UI.
export function ConexionList() {
  const { puedeEscribir, isLoading: checkingPermiso } = usePuedeEscribir()
  const { organizacionId, isLoading: checkingOrganizacion } = useOrganizacionDeTrabajo()
  const [conexiones, setConexiones] = useState<Conexion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizacionId) return
    let cancelled = false
    supabaseClient.from('conexiones').select('id, sistema_externo, estado, created_at').eq('organizacion_id', organizacionId).order('created_at', { ascending: false }).then(({ data, error: queryError }) => {
      if (cancelled) return
      if (queryError) setError(queryError.message)
      else setConexiones((data ?? []) as Conexion[])
    })
    return () => { cancelled = true }
  }, [organizacionId])

  if (checkingPermiso || checkingOrganizacion) return null
  if (!puedeEscribir || !organizacionId) return <Alert severity="error" sx={{ m: 2 }}>Solo un administrador con una organización activa puede gestionar conexiones.</Alert>

  return <List title="Conexiones" headerButtons={puedeEscribir ? undefined : null}>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {conexiones.length === 0 && !error && <Typography color="text.secondary">Todavía no hay conexiones configuradas para esta organización.</Typography>}
    <TableContainer><Table><TableHead><TableRow><TableCell>Sistema externo</TableCell><TableCell>Estado</TableCell><TableCell>Alta</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>
      {conexiones.map((conexion) => <TableRow key={conexion.id}><TableCell>{conexion.sistema_externo}</TableCell><TableCell>{conexion.estado}</TableCell><TableCell>{new Date(conexion.created_at).toLocaleString()}</TableCell><TableCell align="right"><EditButton hideText recordItemId={conexion.id} /></TableCell></TableRow>)}
    </TableBody></Table></TableContainer>
  </List>
}
