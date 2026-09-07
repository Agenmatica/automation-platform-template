# Automation Platform Template

Base reutilizable para productos de automatización multi-tenant. Es un
monorepo: frontend, infraestructura, migraciones y workers evolucionan
juntos, con una sola historia Git y despliegues independientes. Cada
producto real (por ejemplo, uno para un vertical específico) parte de esta
base y agrega su propio dominio encima.

## Stack

- Refine + React en `apps/web`
- Supabase para Postgres, Auth y Storage
- Kestra para orquestación
- Apache Superset para analítica
- Workers en `workers/` cuando aparezcan casos concretos
- GitHub Spec Kit para pasar de requerimiento a implementación

## Desarrollo local

Requisitos: Node 24+, pnpm 11+, Docker Desktop y Supabase CLI (se instala con
las dependencias del repositorio).

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm install
pnpm dev:supabase
pnpm dev:refine
pnpm dev:kestra
pnpm dev:superset
```

Cada comando levanta sólo un producto Docker y queda agrupado de forma
independiente en Docker Desktop. Para detener uno, ejecuta
`pnpm dev:down:<producto>`. Refine también puede ejecutarse sin Docker con
`pnpm dev:refine:host`.

| Servicio | URL |
|---|---|
| Refine | http://localhost:3100 |
| Supabase API | http://127.0.0.1:8100 |
| Supabase Studio | http://127.0.0.1:3101 |
| Kestra | http://127.0.0.1:8082 |
| Superset | http://127.0.0.1:8088 |

## Flujo de una funcionalidad

1. Crear la especificación con `/speckit-specify`.
2. Resolver ambigüedades importantes con `/speckit-clarify`.
3. Diseñar la solución con `/speckit-plan`.
4. Generar el trabajo con `/speckit-tasks`.
5. Implementar con `/speckit-implement`.
6. Declarar en la spec qué productos toca (`refine`, `supabase`, `kestra`,
   `superset`, `workers`) y ejecutar sus validaciones.
7. Ejecutar `pnpm lint`, `pnpm build` y `pnpm infra:config` antes de integrar.

Los comandos están disponibles tanto en Claude Code (`.claude/skills`) como en
Codex (`.agents/skills`). Consulta `docs/architecture.md` y
`docs/deployment.md` para el diseño completo.
