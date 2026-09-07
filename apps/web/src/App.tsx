import { Refine } from '@refinedev/core'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { BrowserRouter } from 'react-router'
import './App.css'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#136f63' },
    background: { default: '#f4f7f6' },
  },
  typography: { fontFamily: 'Inter, system-ui, sans-serif' },
})

const services = [
  ['Refine', 'Interfaz operativa', 'local :3100 · Vercel'],
  ['Supabase', 'Datos y autenticación', 'local :8100 · Cloud'],
  ['Kestra', 'Automatizaciones', 'local :8082 · VPS'],
  ['Superset', 'Reportes y métricas', 'local :8088 · VPS'],
]

function Landing() {
  const supabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Automation Platform Template</p>
        <h1>Automatizaciones multi-tenant, coordinadas en un solo producto.</h1>
        <p className="lead">
          Base técnica preparada para desarrollar con Claude Code o Codex usando
          el mismo flujo de especificaciones.
        </p>
        <span className={supabaseConfigured ? 'badge ready' : 'badge'}>
          Supabase {supabaseConfigured ? 'configurado' : 'pendiente de credenciales'}
        </span>
      </header>

      <section className="grid" aria-label="Servicios del producto">
        {services.map(([name, purpose, destination]) => (
          <article className="card" key={name}>
            <h2>{name}</h2>
            <p>{purpose}</p>
            <small>{destination}</small>
          </article>
        ))}
      </section>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Refine>
          <Landing />
        </Refine>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
