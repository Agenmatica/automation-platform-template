import { Alert, Button, Stack, Typography } from '@mui/material'
import { List } from '@refinedev/mui'
import { useCallback, useEffect, useState } from 'react'
import { useIsSuperadmin } from '../../hooks/useIsSuperadmin'
import { supabaseClient } from '../../lib/supabase'

type Interaccion = { id: string; consumidor_codigo: string; origen: string; estado: string; intentos: number; iniciada_en: string; finalizada_en: string | null; error_sanitizado: string | null }

export function IaInteracciones() {
  const { isSuperadmin, isLoading } = useIsSuperadmin(); const [interacciones, setInteracciones] = useState<Interaccion[]>([]); const [error, setError] = useState<string | null>(null); const [resolviendo, setResolviendo] = useState<string | null>(null)
  const cargar = useCallback(async () => { const { data, error: consultaError } = await supabaseClient.from('ia_interacciones').select('id,consumidor_codigo,origen,estado,intentos,iniciada_en,finalizada_en,error_sanitizado').order('iniciada_en', { ascending: false }); if (consultaError) setError(consultaError.message); else setInteracciones((data ?? []) as Interaccion[]) }, [])
  useEffect(() => { if (isSuperadmin) void cargar() }, [cargar, isSuperadmin])
  const resolver = async (id: string, estado: 'completada' | 'rechazada' | 'cancelada') => { setResolviendo(id); setError(null); const { error: rpcError } = await supabaseClient.rpc('resolver_revision_ia', { p_interaccion_id: id, p_estado_final: estado, p_detalle_sanitizado: { resuelto_desde: 'refine' } }); if (rpcError) setError(rpcError.message); else await cargar(); setResolviendo(null) }
  if (isLoading) return null
  if (!isSuperadmin) return <Alert severity="error" sx={{ m: 2 }}>Esta pantalla es solo para el superadmin de la plataforma.</Alert>
  return <List title="Interacciones de IA"><Stack spacing={2}><Alert severity="info">El historial contiene sólo estados, contadores, errores y evidencia sanitizados. Las revisiones humanas se resuelven exclusivamente aquí.</Alert>{error && <Alert severity="error">{error}</Alert>}{interacciones.map((interaccion) => <Stack key={interaccion.id} spacing={0.5} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}><Typography>{`${interaccion.consumidor_codigo} · ${interaccion.origen} · ${interaccion.estado} · intento ${interaccion.intentos}`}</Typography><Typography variant="body2">{new Date(interaccion.iniciada_en).toLocaleString()}</Typography>{interaccion.error_sanitizado && <Typography color="error">{interaccion.error_sanitizado}</Typography>}{interaccion.estado === 'revision_humana' && <Stack direction="row" spacing={1}><Button disabled={resolviendo === interaccion.id} onClick={() => void resolver(interaccion.id, 'completada')}>Completar</Button><Button color="warning" disabled={resolviendo === interaccion.id} onClick={() => void resolver(interaccion.id, 'rechazada')}>Rechazar</Button><Button color="error" disabled={resolviendo === interaccion.id} onClick={() => void resolver(interaccion.id, 'cancelada')}>Cancelar</Button></Stack>}</Stack>)}</Stack></List>
}
