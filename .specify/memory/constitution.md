<!--
Sync Impact Report
- Version change: 1.3.0 → 1.4.0 (MINOR: formaliza vía Delivery Workflow un
  flujo de PR obligatorio por spec, con cierre por merge commit reversible y
  migraciones con camino de vuelta atrás; ninguna regla existente se elimina
  ni se vuelve incompatible)
- Modified principles: ninguno (cambios en Delivery Workflow y en Technology
  and Quality Gates, no en Core Principles)
- Added sections: ninguna (se extienden secciones existentes)
- Removed sections: ninguna
- Follow-up TODOs: ninguno
-->

# Automation Platform Template Constitution

## Core Principles

### I. Aislamiento multi-tenant por diseño
Los datos de cada organización y sus clientes deben estar aislados. Toda
tabla expuesta debe usar RLS, el navegador sólo puede recibir claves
públicas y los secretos deben permanecer en gestores de variables o
archivos locales ignorados por Git.

### II. Especificar antes de implementar
Cada funcionalidad comienza con una spec verificable. Los planes y tareas deben
referenciar requisitos concretos y aclarar permisos, fallos, auditoría y datos.

### III. Automatizaciones idempotentes y auditables
Los workflows y workers deben poder reintentarse sin duplicar efectos. Cada
ejecución importante registra origen, actor, estado, timestamps y error útil.

### IV. Un monorepo, despliegues independientes
El código comparte repositorio y contratos, pero Refine, Supabase, Kestra,
Superset y cada worker conservan configuración y ciclo de despliegue propios.
En desarrollo Docker, cada producto usa su propio proyecto Compose:
`automation-platform-template-refine-dev`,
`automation-platform-template-supabase-dev`,
`automation-platform-template-kestra-dev`,
`automation-platform-template-superset-dev`,
`automation-platform-template-playwright-dev` y
`automation-platform-template-runner-dev`. No existe un Compose raíz que los
fusione.

### V. Simplicidad operativa
Se agrega infraestructura sólo cuando existe un caso de uso. Desarrollo es
local; staging aprovecha previews y recursos gratuitos; los servicios de VPS de
staging se levantan bajo demanda y se apagan al terminar.

## Technology and Quality Gates

El stack base es Refine, Supabase, Kestra, Superset y workers explícitos. Toda
entrega debe compilar, pasar lint, validar Compose, pasar los tests (`pnpm test`)
y documentar migraciones y variables nuevas. Los cambios sensibles requieren
una prueba del aislamiento (pgTAP contra RLS, no solo revisión manual). Las
migraciones de Supabase son aditivas o llevan su camino de reversión explícito
documentado en la spec — no se destruye una columna o tabla en el mismo PR que
la crea.

## Delivery Workflow

Las ramas de funcionalidades nacen de `main`. Toda spec nueva abre su Pull
Request contra `main` al crear la rama, no al terminar el trabajo — así los
pull requests generan Preview en Vercel y ejecutan validaciones durante todo
el desarrollo, no solo al final. Con un único agente operando el repo, el PR
no cumple función de revisión por pares: es el gate de CI/Preview y el punto
de reversión de la spec.

El cierre de una spec es el merge de ese PR a `main` — con merge commit
(`--no-ff`), nunca squash ni rebase, para que deshacer la spec completa sea
un único `git revert -m 1 <hash>` sin reconstruir commits. La rama no se
borra al mergear; queda como referencia hasta confirmar que el cierre fue
estable en el entorno donde importa (staging o producción, según el alcance).

`staging` integra pruebas compartidas cuando se necesitan. Producción se
promueve desde una versión verificada y requiere aprobación manual para
migraciones o cambios del VPS.

## Governance

Esta constitución prevalece sobre decisiones ad hoc de los agentes. Una
excepción debe quedar documentada en la spec y su plan. Los cambios de principios
requieren actualizar versión, fecha y artefactos afectados.

**Version**: 1.4.0 | **Ratified**: 2026-09-06 | **Last Amended**: 2026-09-08
