import { Authenticated, ErrorComponent, Refine } from '@refinedev/core'
import { RefineSnackbarProvider, ThemedLayout, useNotificationProvider } from '@refinedev/mui'
import { dataProvider as supabaseDataProvider } from '@refinedev/supabase'
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from '@refinedev/react-router'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { authProvider } from './providers/authProvider'
import { accessControlProvider } from './providers/accessControlProvider'
import { supabaseClient } from './lib/supabase'
import { RequiereOrganizacionActiva } from './components/RequiereOrganizacionActiva'
import { LoginPage } from './pages/login'
import { OrganizacionCreate } from './pages/organizaciones/create'
import { OrganizacionList } from './pages/organizaciones/list'
import { ClienteCreate } from './pages/clientes/create'
import { ClienteEdit } from './pages/clientes/edit'
import { ClienteList } from './pages/clientes/list'
import { AnaliticaAdministrar } from './pages/analitica/administrar'
import { AnaliticaList } from './pages/analitica/list'
import { AnaliticaPermisos } from './pages/analitica/permisos'
import { MiembroCreate } from './pages/miembros/create'
import { MiembroList } from './pages/miembros/list'
import { DefinirContrasenaPage } from './pages/acceso/definir-contrasena'
import { SolicitarRecuperacionPage } from './pages/acceso/solicitar-recuperacion'
import { CambiarContrasenaPage } from './pages/cuenta/cambiar-contrasena'
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

// Home de quien ya inició sesión, hasta que exista una pantalla de negocio
// propia (organizaciones/clientes se agregan como recursos en las
// siguientes historias de la spec 003).
function Home() {
  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Automation Platform Template</p>
        <h1>Automatizaciones multi-tenant, coordinadas en un solo producto.</h1>
        <p className="lead">
          Base técnica preparada para desarrollar con Claude Code o Codex usando
          el mismo flujo de especificaciones.
        </p>
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
        <RefineSnackbarProvider>
          <Refine
            dataProvider={supabaseDataProvider(supabaseClient)}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}
            routerProvider={routerProvider}
            notificationProvider={useNotificationProvider}
            resources={[
              {
                name: 'organizaciones',
                list: '/organizaciones',
                create: '/organizaciones/create',
                meta: { label: 'Organizaciones' },
              },
              {
                name: 'clientes',
                list: '/clientes',
                create: '/clientes/create',
                edit: '/clientes/edit/:id',
                meta: { label: 'Clientes' },
              },
              {
                name: 'analitica-administrar',
                list: '/analitica/administrar',
                meta: { label: 'Analítica (administrar)' },
              },
              {
                name: 'analitica',
                list: '/analitica',
                meta: { label: 'Analítica' },
              },
              { name: 'miembros', list: '/miembros', create: '/miembros/create', meta: { label: 'Miembros' } },
              { name: 'cuenta', list: '/cuenta/cambiar-contrasena', meta: { label: 'Mi cuenta' } },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              disableTelemetry: true,
            }}
          >
            <Routes>
              <Route path="/acceso/definir-contrasena" element={<DefinirContrasenaPage />} />
              <Route path="/acceso/solicitar-recuperacion" element={<SolicitarRecuperacionPage />} />
              <Route
                element={
                  <Authenticated key="protegido" fallback={<CatchAllNavigate to="/login" />}>
                    <ThemedLayout>
                      <Outlet />
                    </ThemedLayout>
                  </Authenticated>
                }
              >
                <Route index element={<Home />} />
                <Route path="/organizaciones" element={<OrganizacionList />} />
                <Route path="/organizaciones/create" element={<OrganizacionCreate />} />
                <Route
                  path="/clientes"
                  element={
                    <RequiereOrganizacionActiva>
                      <ClienteList />
                    </RequiereOrganizacionActiva>
                  }
                />
                <Route path="/miembros" element={<RequiereOrganizacionActiva><MiembroList /></RequiereOrganizacionActiva>} />
                <Route path="/miembros/create" element={<RequiereOrganizacionActiva><MiembroCreate /></RequiereOrganizacionActiva>} />
                <Route path="/cuenta/cambiar-contrasena" element={<CambiarContrasenaPage />} />
                <Route
                  path="/clientes/create"
                  element={
                    <RequiereOrganizacionActiva>
                      <ClienteCreate />
                    </RequiereOrganizacionActiva>
                  }
                />
                <Route
                  path="/clientes/edit/:id"
                  element={
                    <RequiereOrganizacionActiva>
                      <ClienteEdit />
                    </RequiereOrganizacionActiva>
                  }
                />
                <Route path="/analitica/administrar" element={<AnaliticaAdministrar />} />
                <Route
                  path="/analitica"
                  element={
                    <RequiereOrganizacionActiva>
                      <AnaliticaList />
                    </RequiereOrganizacionActiva>
                  }
                />
                <Route
                  path="/analitica/permisos"
                  element={
                    <RequiereOrganizacionActiva>
                      <AnaliticaPermisos />
                    </RequiereOrganizacionActiva>
                  }
                />
              </Route>

              <Route
                element={
                  <Authenticated key="publico" fallback={<Outlet />}>
                    <Navigate to="/" replace />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route
                element={
                  <Authenticated key="catch-all">
                    <ThemedLayout>
                      <Outlet />
                    </ThemedLayout>
                  </Authenticated>
                }
              >
                <Route path="*" element={<ErrorComponent />} />
              </Route>
            </Routes>
            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
