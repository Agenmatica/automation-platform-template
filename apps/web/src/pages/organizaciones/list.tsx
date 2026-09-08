import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTable } from '@refinedev/core'
import { List } from '@refinedev/mui'
import {
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { useIsSuperadmin } from '../../hooks/useIsSuperadmin'
import { supabaseClient } from '../../lib/supabase'

type Organizacion = {
  id: string
  nombre: string
  created_at: string
}

// Pantalla superadmin-only (FR-008): listado de organizaciones + botón
// "Crear organización" (lo agrega <List> solo si canCreate, ver App.tsx) +
// "Ingresar" por fila (US4, contrato: contracts/entrar-a-organizacion.md).
export function OrganizacionList() {
  const navigate = useNavigate()
  const { isSuperadmin, isLoading: checkingSuperadmin } = useIsSuperadmin()
  const { tableQuery } = useTable<Organizacion>({ resource: 'organizaciones' })
  const [entrandoA, setEntrandoA] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const handleIngresar = async (organizacionId: string) => {
    setEntrandoA(organizacionId)
    setError(null)

    const { error: rpcError } = await supabaseClient.rpc('entrar_a_organizacion', {
      org_id: organizacionId,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEntrandoA(null)
      return
    }

    navigate('/clientes')
  }

  return (
    <List title="Organizaciones">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Creada</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {organizaciones.map((organizacion) => (
              <TableRow key={organizacion.id}>
                <TableCell>{organizacion.nombre}</TableCell>
                <TableCell>{new Date(organizacion.created_at).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={entrandoA === organizacion.id}
                    onClick={() => handleIngresar(organizacion.id)}
                  >
                    {entrandoA === organizacion.id ? 'Ingresando…' : 'Ingresar'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </List>
  )
}
