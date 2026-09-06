# Arquitectura

```text
Usuario → Refine/Vercel → Supabase Cloud
                          ↑        ↓
                    workers ← Kestra/VPS
                          ↓
                     Superset/VPS
```

El navegador autentica contra Supabase y opera sólo con permisos RLS. Kestra
coordina trabajos de larga duración y llama workers concretos. Superset consulta
vistas de lectura preparadas para analítica; no es la interfaz transaccional.

## Estructura del monorepo

```text
apps/web/          Refine y configuración Vercel
supabase/          configuración, migraciones, seed y funciones
infra/             configuración de servicios del VPS
workers/           procesos aislados futuros
specs/             especificaciones por funcionalidad
.specify/          reglas y plantillas de Spec Kit
```

Compartir repositorio no significa desplegar todo junto. Un cambio sólo activa
el pipeline correspondiente a las rutas que modifica.
