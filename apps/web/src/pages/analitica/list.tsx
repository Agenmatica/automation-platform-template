import { useState } from 'react'
import { Box, List as MuiList, ListItemButton, ListItemText, Paper, Stack, Typography } from '@mui/material'
import { List } from '@refinedev/mui'
import { useReportesAsignados } from '../../hooks/useReportesAsignados'
import { ReporteEmbebido } from '../../components/ReporteEmbebido'

// US2: reportes visibles para el usuario actual, embebidos al seleccionar
// uno. La lista misma ya viene filtrada por RLS (useReportesAsignados) —
// acá solo se resuelve la UX de "sin reportes configurados" (FR-011).
export function AnaliticaList() {
  const { reportes, isLoading } = useReportesAsignados()
  const [reporteSeleccionado, setReporteSeleccionado] = useState<string | null>(null)

  if (isLoading) {
    return null
  }

  if (reportes.length === 0) {
    return (
      <List title="Analítica">
        <Typography color="text.secondary">
          Todavía no tenés reportes configurados para tu organización.
        </Typography>
      </List>
    )
  }

  return (
    <List title="Analítica">
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ minWidth: 240 }}>
          <MuiList>
            {reportes.map((reporte) => (
              <ListItemButton
                key={reporte.id}
                selected={reporte.id === reporteSeleccionado}
                onClick={() => setReporteSeleccionado(reporte.id)}
              >
                <ListItemText primary={reporte.nombre} />
              </ListItemButton>
            ))}
          </MuiList>
        </Paper>
        <Box flexGrow={1}>
          {reporteSeleccionado ? (
            <ReporteEmbebido key={reporteSeleccionado} reporteId={reporteSeleccionado} />
          ) : (
            <Typography color="text.secondary">Elegí un reporte para verlo.</Typography>
          )}
        </Box>
      </Stack>
    </List>
  )
}
