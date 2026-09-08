# Instrucciones para Claude Code

Este repositorio usa GitHub Spec Kit. Antes de implementar una funcionalidad,
revisa `.specify/memory/constitution.md` y los artefactos de la funcionalidad en
`specs/`. No inventes requisitos de negocio: conviértelos primero en una spec.

## Comandos de validación

- `pnpm lint`
- `pnpm build`
- `pnpm infra:config`
- `pnpm test` (requiere `pnpm dev:supabase` corriendo para los tests de base de datos)

## Reglas del proyecto

- Mantén el frontend en `apps/web` y los procesos aislados en `workers/`.
- Toda modificación de base de datos debe ser una migración en `supabase/migrations`.
- Activa RLS en toda tabla expuesta y nunca uses la service-role key en el navegador.
- No guardes secretos en Git; actualiza únicamente los archivos `.env.example`.
- Conserva desarrollo local reproducible y despliegues independientes por producto.
- Nunca uses un Compose raíz: cada producto tiene su archivo en `infra/<producto>/compose.yaml`.
- Toda spec debe declarar su alcance de entrega: `refine`, `supabase`, `kestra`, `superset` y/o `workers`.
- Para desarrollo Docker usa los comandos `dev:<producto>`; para Refine fuera de Docker usa `dev:refine:host`.
- Los commits siempre llevan título claro y en castellano; lo mismo para nombres de rama y slugs de specs de Spec Kit.
- Habilitar una capacidad o herramienta sin un caso de uso de negocio todavía (una extensión de Postgres, una imagen Docker) no necesita spec — la funcionalidad real que la use, sí.
- Lo que se entrega es código versionado en git. Evitá herramientas cuya licencia restrinja el uso comercial de lo que se opera como propio (por eso Kestra —Apache 2.0— en vez de n8n —Sustainable Use License—). Los dashboards de Superset se exportan a YAML y se commitean, nunca quedan solo en la UI.
- El CI corre en runners self-hosted (`infra/runner/`), no en `ubuntu-latest` — no lo cambies sin motivo, evita gasto de minutos de GitHub Actions.
- Toda spec nueva abre su Pull Request contra `main` al crear la rama, no al terminar — el PR no es revisión por pares (un solo agente opera el repo), es el gate de CI/Preview y el punto de reversión. El cierre es el merge de ese PR con merge commit (`--no-ff`), nunca squash ni rebase, para poder deshacer la spec completa con un único `git revert -m 1`; la rama no se borra al mergear hasta confirmar que el cierre quedó estable.
- Las migraciones de Supabase son aditivas o llevan su camino de reversión explícito documentado en la spec — no se destruye una columna o tabla en el mismo PR que la crea.
- `/speckit-implement` en specs con varias fases o historias de usuario se invoca fase por fase (o historia por historia), usando el filtro de tareas del propio comando, con `/clear` entre una fase y la siguiente — no la spec completa en una sola corrida. `tasks.md` ya trae un "Checkpoint" al final de cada fase para cortar ahí.
- No encadenes `/speckit-analyze` ni `/speckit-converge` de forma rutinaria después de cada implement: releen todos los artefactos completos en cada corrida. Solo cuando haya una sospecha concreta de gap, no como paso automático.
- Las notas de desvío que se agregan a `tasks.md` (lo que se apartó del plan) van cortas, con referencia al commit (`ver commit <hash>`) en vez de repetir el párrafo entero — esa razón ya vive en el mensaje de commit y no hace falta cargarla dos veces.
