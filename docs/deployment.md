# Entornos y despliegue

## Desarrollo

Todo corre en la máquina: Vite/Refine, Supabase CLI, Kestra y Superset. Es el
entorno diario y no genera costo cloud adicional.

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
- `compose.yaml`: Kestra, Superset y workers en el VPS bajo el nombre de proyecto
  `estudio-production`, detrás de HTTPS/reverse proxy y con backups.

No se promueven bases copiando datos. Se promueven código, migraciones y
configuración; las credenciales son distintas en cada entorno.

## Promoción simple

```text
rama de feature → Preview → staging (si hace falta) → main/producción
```

Para cambios sólo visuales se puede omitir el staging completo. Para cambios de
datos, permisos o automatizaciones, staging es obligatorio.
