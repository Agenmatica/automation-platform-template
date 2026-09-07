# Entornos y despliegue

## Desarrollo

Todo corre en la máquina, separado por producto: Refine, Supabase CLI, Kestra
y Superset. Es el entorno diario y no genera costo cloud adicional.

```powershell
pnpm dev:refine
pnpm dev:supabase
pnpm dev:kestra
pnpm dev:superset
```

## Staging económico

- Cada pull request obtiene un Vercel Preview.
- La rama `staging` apunta a un proyecto Supabase Free separado de producción.
- Kestra, Superset y workers usan un segundo proyecto Compose en el mismo VPS,
  sólo cuando hay que probar una integración completa.
- Al terminar la prueba se ejecuta `docker compose -p estudio-staging down`.

Staging valida migraciones, permisos, workflows y conexión entre componentes
sin tocar datos reales. Puede mantenerse en costo cero adicional mientras no se
supere el plan gratuito de Vercel/Supabase ni sea necesario ampliar el VPS.

## Producción

- `apps/web`: proyecto Vercel de producción.
- `supabase/`: proyecto Supabase Cloud de producción mediante migraciones.
- `infra/kestra/compose.yaml`: Kestra en el VPS, detrás de HTTPS/reverse proxy.
- `infra/superset/compose.yaml`: Superset en el VPS, detrás de HTTPS/reverse proxy.
- `infra/playwright/compose.yaml`: servidor de Playwright en el VPS, sólo
  accesible para Kestra (no pasa por el reverse proxy, no es público).
- Los workers se agregan como su propio Compose cuando exista un caso concreto.

No se promueven bases copiando datos. Se promueven código, migraciones y
configuración; las credenciales son distintas en cada entorno.

## CI

`.github/workflows/validate.yml` corre en un runner self-hosted (no en
`ubuntu-latest`), para no depender de la cuota de minutos de GitHub Actions.
Hoy ese runner vive en la PC de desarrollo (`estudio-automation-pc-nico`,
levantado con `.\run.cmd` desde `C:\Users\Nico\actions-runner\estudio-automation`,
sin instalar como servicio de Windows por falta de permisos de Administrador
en esta sesión — solo escucha mientras esa PC/proceso estén activos). Cuando
haya un VPS, conviene migrarlo ahí como servicio real (`.\config.cmd ...
--runasservice`, corrido desde una consola con permisos de Administrador) para
que quede escuchando 24/7.

## Promoción simple

```text
rama de feature → Preview → staging (si hace falta) → main/producción
```

Para cambios sólo visuales se puede omitir el staging completo. Para cambios de
datos, permisos o automatizaciones, staging es obligatorio.

En el VPS, `./scripts/deploy-vps.sh staging` o `production` despliega Kestra y
Superset como proyectos Docker separados (`estudio-<entorno>-kestra` y
`estudio-<entorno>-superset`).
