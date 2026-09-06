# Instrucciones para Codex

Este repositorio usa GitHub Spec Kit. Antes de implementar una funcionalidad,
revisa `.specify/memory/constitution.md` y los artefactos de la funcionalidad en
`specs/`. No inventes requisitos de negocio: conviértelos primero en una spec.

## Comandos de validación

- `pnpm lint`
- `pnpm build`
- `pnpm infra:config`

## Reglas del proyecto

- Mantén el frontend en `apps/web` y los procesos aislados en `workers/`.
- Toda modificación de base de datos debe ser una migración en `supabase/migrations`.
- Activa RLS en toda tabla expuesta y nunca uses la service-role key en el navegador.
- No guardes secretos en Git; actualiza únicamente los archivos `.env.example`.
- Conserva desarrollo local reproducible y despliegues independientes por producto.
