# Implementation Plan: Capacidad de IA gobernada para navegación

**Branch**: `016-capacidad-ia-gobernada` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Crear una capacidad común para cualquier worker con navegación: configuración global segura, políticas aprobadas, contrato declarativo, sanitización, límites, auditoría y eventos sanitizados. Los productos consumidores agregan sus pasos y verificadores; no duplican la plataforma.

## Technical Context

**Language/Version**: TypeScript/Node.js y SQL PostgreSQL/Supabase.

**Primary Dependencies**: Refine, Supabase/Vault/RLS, Playwright Core, Kestra y workers Node.

**Storage**: configuración, políticas e intervenciones multi-tenant; claves solo en Vault; evidencia sanitizada con retención de 90 días.

**Testing**: Vitest, pgTAP, validación de configuración y un worker fixture que adopte el contrato.

**Constraints**: propuesta declarativa; mismo contexto de navegador; cero retención/sin entrenamiento; contexto estructural sin secretos ni contenido de reportes; dos intentos/90 segundos.

## Constitution Check

| Gate | Resultado | Diseño |
|---|---|---|
| Aislamiento multi-tenant | Pasa | RLS, RPC de mínimo privilegio y Vault. |
| Idempotencia y auditoría | Pasa | Intervenciones append-only y verificación antes de retomar. |
| Despliegues independientes | Pasa | Cambios separados en Refine, Supabase, Kestra y workers. |
| Simplicidad operativa | Pasa | El modelo no controla el navegador; propone acciones del catálogo. |

## Project Structure

```text
apps/web/src/pages/ia/
supabase/{migrations,tests/database}/
workers/ia-fallback/
infra/kestra/
specs/016-capacidad-ia-gobernada/
```

## Design Deliverables

La siguiente fase define el modelo de datos, contrato worker/eventos y guía de validación. Los adaptadores o recorridos específicos se implementan en specs de productos consumidores.
