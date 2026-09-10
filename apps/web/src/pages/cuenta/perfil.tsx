import { type FormEvent, useEffect, useState } from 'react'
import { Alert, Avatar, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import { Link as RouterLink, Navigate } from 'react-router'
import { profileRedirectUrl, supabaseClient, verifyCurrentPassword } from '../../lib/supabase'

type Perfil = { nombre: string | null; apellido: string | null; foto_path: string | null }
type Membresia = { rol_id: string; organizaciones: { nombre: string } | null }
type EventoSeguridad = { id: number; tipo: 'inicio_sesion' | 'contrasena_modificada' | 'correo_modificado'; created_at: string }
type EstadoSesion = 'verificando' | 'lista' | 'ausente'
const FOTO_MAX_BYTES = 2 * 1024 * 1024
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']

function esContrasenaActualIncorrecta(error: { code?: string; message?: string }) {
  return error.code === 'invalid_credentials' || /current password|contrasena actual|incorrect/i.test(error.message ?? '')
}

function esCorreoNoDisponible(error: { code?: string; message?: string }) {
  return error.code === 'email_exists' || /already registered|already been registered|email.*exist/i.test(error.message ?? '')
}

function esCorreoValido(correo: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
}

export function PerfilPage() {
  const [estadoSesion, setEstadoSesion] = useState<EstadoSesion>('verificando')
  const [userId, setUserId] = useState<string | null>(null)
  const [correoActual, setCorreoActual] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [contrasenaActual, setContrasenaActual] = useState('')
  const [correoNuevo, setCorreoNuevo] = useState('')
  const [solicitandoCorreo, setSolicitandoCorreo] = useState(false)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [tieneFoto, setTieneFoto] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [cuenta, setCuenta] = useState<{ creadoEn: string | null; rol: string | null; organizacion: string | null }>({ creadoEn: null, rol: null, organizacion: null })
  const [eventosSeguridad, setEventosSeguridad] = useState<EventoSeguridad[]>([])

  useEffect(() => {
    let activa = true
    void supabaseClient.auth.getUser().then(async ({ data, error: errorUsuario }) => {
      const usuario = data.user
      if (!activa) return
      if (errorUsuario || !usuario) {
        setEstadoSesion('ausente')
        return
      }
      setUserId(usuario.id)
      setCorreoActual(usuario.email ?? null)
      setCuenta((actual) => ({ ...actual, creadoEn: usuario.created_at ?? null }))
      const [{ data: membresia }, { data: perfil, error: errorPerfil }, { data: eventos, error: errorEventos }] = await Promise.all([
        supabaseClient
          .from('usuarios_organizacion')
          .select('rol_id, organizaciones(nombre)')
          .eq('user_id', usuario.id)
          .maybeSingle<Membresia>(),
        supabaseClient
          .from('perfiles_usuario')
          .select('nombre, apellido, foto_path')
          .eq('user_id', usuario.id)
          .maybeSingle<Perfil>(),
        supabaseClient
          .from('eventos_seguridad_usuario')
          .select('id, tipo, created_at')
          .eq('user_id', usuario.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(20),
      ])
      if (!activa) return
      if (membresia) setCuenta((actual) => ({ ...actual, rol: membresia.rol_id, organizacion: membresia.organizaciones?.nombre ?? null }))
      if (errorPerfil) setError('No pudimos cargar tus datos personales. Intenta nuevamente.')
      else if (perfil) {
        setNombre(perfil.nombre ?? '')
        setApellido(perfil.apellido ?? '')
        setTieneFoto(Boolean(perfil.foto_path))
        if (perfil.foto_path) {
          const { data } = await supabaseClient.storage.from('fotos-perfil').createSignedUrl(perfil.foto_path, 60)
          if (activa) setFotoUrl(data?.signedUrl ?? null)
        }
      }
      if (errorEventos) setError('No pudimos cargar tus avisos de seguridad. Intenta nuevamente.')
      else setEventosSeguridad(eventos ?? [])
      setEstadoSesion('lista')
    })
    return () => { activa = false }
  }, [])

  const cargarFoto = async (archivo: File | undefined) => {
    if (!archivo || !userId) return
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setError('La foto debe ser JPG, PNG o WebP.')
      return
    }
    if (archivo.size > FOTO_MAX_BYTES) {
      setError('La foto no puede superar 2 MiB.')
      return
    }
    setSubiendoFoto(true)
    setError(null)
    setMensaje(null)
    const path = `${userId}/avatar`
    // Si ya hay una foto, se respalda antes de sobrescribirla para poder
    // restaurarla si el upsert de perfil falla después de la carga.
    const respaldo = tieneFoto ? (await supabaseClient.storage.from('fotos-perfil').download(path)).data : null
    const { error: errorCarga } = await supabaseClient.storage.from('fotos-perfil').upload(path, archivo, { upsert: true, contentType: archivo.type })
    if (errorCarga) {
      setError('No pudimos cargar tu foto. Intenta nuevamente.')
    } else {
      const { error: errorPerfil } = await supabaseClient.from('perfiles_usuario').upsert({ user_id: userId, foto_path: path }, { onConflict: 'user_id' })
      if (errorPerfil) {
        if (respaldo) await supabaseClient.storage.from('fotos-perfil').upload(path, respaldo, { upsert: true, contentType: respaldo.type })
        else await supabaseClient.storage.from('fotos-perfil').remove([path])
        setError('No pudimos actualizar tu perfil; conservamos tu foto anterior.')
      } else {
        const { data } = await supabaseClient.storage.from('fotos-perfil').createSignedUrl(path, 60)
        setFotoUrl(data?.signedUrl ?? null)
        setTieneFoto(true)
        setMensaje('Tu foto de perfil fue actualizada.')
      }
    }
    setSubiendoFoto(false)
  }

  const eliminarFoto = async () => {
    if (!userId) return
    setSubiendoFoto(true)
    setError(null)
    setMensaje(null)
    const path = `${userId}/avatar`
    // Se respalda el objeto antes de borrarlo para poder restaurarlo si el
    // upsert de perfil falla después de la eliminación.
    const { data: respaldo, error: errorRespaldo } = await supabaseClient.storage.from('fotos-perfil').download(path)
    if (errorRespaldo) {
      setError('No pudimos eliminar tu foto. Intenta nuevamente.')
      setSubiendoFoto(false)
      return
    }
    const { error: errorEliminacion } = await supabaseClient.storage.from('fotos-perfil').remove([path])
    if (errorEliminacion) setError('No pudimos eliminar tu foto. Intenta nuevamente.')
    else {
      const { error: errorPerfil } = await supabaseClient.from('perfiles_usuario').upsert({ user_id: userId, foto_path: null }, { onConflict: 'user_id' })
      if (errorPerfil) {
        await supabaseClient.storage.from('fotos-perfil').upload(path, respaldo, { upsert: true, contentType: respaldo.type })
        setError('No pudimos actualizar tu perfil; conservamos tu foto anterior.')
      } else {
        setFotoUrl(null)
        setTieneFoto(false)
        setMensaje('Tu foto de perfil fue eliminada.')
      }
    }
    setSubiendoFoto(false)
  }

  const guardarPerfil = async (event: FormEvent) => {
    event.preventDefault()
    const nombreLimpio = nombre.trim()
    const apellidoLimpio = apellido.trim()
    if (!nombreLimpio || !apellidoLimpio) {
      setMensaje(null)
      setError('Nombre y apellido son obligatorios.')
      return
    }
    if (!userId) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    const { error: errorGuardado } = await supabaseClient
      .from('perfiles_usuario')
      .upsert({ user_id: userId, nombre: nombreLimpio, apellido: apellidoLimpio }, { onConflict: 'user_id' })
    if (errorGuardado) setError('No pudimos guardar tus datos personales. Intenta nuevamente.')
    else {
      setNombre(nombreLimpio)
      setApellido(apellidoLimpio)
      setMensaje('Tus datos personales fueron guardados.')
    }
    setGuardando(false)
  }

  const solicitarCambioCorreo = async (event: FormEvent) => {
    event.preventDefault()
    const correoLimpio = correoNuevo.trim().toLowerCase()
    setError(null)
    setMensaje(null)
    if (!correoActual || !contrasenaActual) {
      setError('Ingresa tu contrasena actual para solicitar el cambio de correo.')
      return
    }
    if (!esCorreoValido(correoLimpio)) {
      setError('Ingresa un correo electronico valido.')
      return
    }
    if (correoLimpio === correoActual.toLowerCase()) {
      setError('El correo nuevo debe ser distinto del actual.')
      return
    }

    setSolicitandoCorreo(true)
    const { error: errorVerificacion } = await verifyCurrentPassword(correoActual, contrasenaActual)
    if (errorVerificacion) {
      setError(
        esContrasenaActualIncorrecta(errorVerificacion)
          ? 'La contrasena actual no coincide.'
          : 'No pudimos verificar la contrasena actual. Intenta nuevamente.',
      )
      setSolicitandoCorreo(false)
      return
    }

    const { error: errorActualizacion } = await supabaseClient.auth.updateUser(
      { email: correoLimpio },
      { emailRedirectTo: profileRedirectUrl(window.location.origin) },
    )
    if (errorActualizacion) {
      setError(
        esCorreoNoDisponible(errorActualizacion)
          ? 'No se puede usar ese correo electronico. Elige otro e intenta nuevamente.'
          : 'No pudimos solicitar el cambio de correo. Intenta nuevamente.',
      )
      setSolicitandoCorreo(false)
      return
    }

    setContrasenaActual('')
    setCorreoNuevo('')
    setMensaje(`Enviamos una confirmacion a ${correoLimpio}. Tu correo actual seguira vigente hasta confirmarla.`)
    setSolicitandoCorreo(false)
  }

  if (estadoSesion === 'verificando') return <CircularProgress aria-label="Verificando sesion" sx={{ m: 4 }} />
  if (estadoSesion === 'ausente') return <Navigate to="/login" replace />
  return (
    <Box component="main" sx={{ maxWidth: 560, mx: 'auto', mt: 4, px: 2 }}>
      <Stack component="form" spacing={2} onSubmit={guardarPerfil} noValidate>
        <Typography component="h1" variant="h4">Mi perfil</Typography>
        <Typography color="text.secondary">Actualiza los datos con los que te identificamos.</Typography>
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        {mensaje && <Alert severity="success" role="status">{mensaje}</Alert>}
        <TextField label="Nombre" value={nombre} onChange={(event) => setNombre(event.target.value)} autoComplete="given-name" required fullWidth />
        <TextField label="Apellido" value={apellido} onChange={(event) => setApellido(event.target.value)} autoComplete="family-name" required fullWidth />
        <Button type="submit" variant="contained" disabled={guardando} aria-busy={guardando}>{guardando ? 'Guardando...' : 'Guardar datos personales'}</Button>
      </Stack>
      <Stack spacing={2} sx={{ mt: 5 }}>
        <Typography component="h2" variant="h5">Foto de perfil</Typography>
        <Avatar src={fotoUrl ?? undefined} alt="Tu foto de perfil" sx={{ width: 80, height: 80 }}>?</Avatar>
        <Button component="label" variant="outlined" disabled={subiendoFoto} aria-busy={subiendoFoto}>
          {subiendoFoto ? 'Actualizando foto...' : 'Cargar o reemplazar foto'}
          <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void cargarFoto(event.target.files?.[0])} />
        </Button>
        {tieneFoto && <Button color="error" onClick={() => void eliminarFoto()} disabled={subiendoFoto} aria-busy={subiendoFoto}>Quitar foto</Button>}
        <Typography variant="caption" color="text.secondary">JPG, PNG o WebP de hasta 2 MiB.</Typography>
      </Stack>
      <Stack spacing={1} sx={{ mt: 5 }}>
        <Typography component="h2" variant="h5">Datos de cuenta</Typography>
        <Typography>Correo: {correoActual ?? 'No disponible'}</Typography>
        <Typography>Fecha de creación: {cuenta.creadoEn ? new Date(cuenta.creadoEn).toLocaleDateString() : 'No disponible'}</Typography>
        <Typography>Organización: {cuenta.organizacion ?? 'Sin organización activa'}</Typography>
        <Typography>Rol: {cuenta.rol ?? 'Sin rol asignado'}</Typography>
      </Stack>
      <Stack spacing={1} sx={{ mt: 5 }}>
        <Typography component="h2" variant="h5">Contraseña</Typography>
        <Typography color="text.secondary">Gestiona tu contraseña desde el flujo seguro de tu cuenta.</Typography>
        <Button component={RouterLink} to="/cuenta/cambiar-contrasena" variant="outlined">
          Cambiar contraseña
        </Button>
      </Stack>
      <Stack spacing={1} sx={{ mt: 5 }}>
        <Typography component="h2" variant="h5">Últimas acciones de seguridad</Typography>
        {eventosSeguridad.length === 0 ? (
          <Typography color="text.secondary">Todavía no registramos acciones de seguridad para tu cuenta.</Typography>
        ) : eventosSeguridad.map((evento) => (
          <Typography key={evento.id}>
            {evento.tipo.replaceAll('_', ' ')}: {new Date(evento.created_at).toLocaleString()}
          </Typography>
        ))}
      </Stack>
      <Stack component="form" spacing={2} onSubmit={solicitarCambioCorreo} noValidate sx={{ mt: 5 }}>
        <Typography component="h2" variant="h5">Cambiar correo electronico</Typography>
        <Typography color="text.secondary">Confirmaremos el cambio solo en la nueva direccion. Tu correo actual seguira vigente hasta entonces.</Typography>
        <TextField
          label="Contrasena actual para cambiar el correo"
          type="password"
          value={contrasenaActual}
          onChange={(event) => setContrasenaActual(event.target.value)}
          autoComplete="current-password"
          required
          fullWidth
        />
        <TextField
          label="Correo electronico nuevo"
          type="email"
          value={correoNuevo}
          onChange={(event) => setCorreoNuevo(event.target.value)}
          autoComplete="email"
          required
          fullWidth
        />
        <Button type="submit" variant="outlined" disabled={solicitandoCorreo} aria-busy={solicitandoCorreo}>
          {solicitandoCorreo ? 'Solicitando...' : 'Solicitar cambio de correo'}
        </Button>
      </Stack>
    </Box>
  )
}
