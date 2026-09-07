# Estudio Automation Constitution

## Core Principles

### I. Seguridad contable por diseño
Los datos de cada estudio y cliente deben estar aislados. Toda tabla expuesta
debe usar RLS, el navegador sólo puede recibir claves públicas y los secretos
deben permanecer en gestores de variables o archivos locales ignorados por Git.

### II. Especificar antes de implementar
Cada funcionalidad comienza con una spec verificable. Los planes y tareas deben
referenciar requisitos concretos y aclarar permisos, fallos, auditoría y datos.

### III. Automatizaciones idempotentes y auditables
Los workflows y workers deben poder reintentarse sin duplicar efectos. Cada
ejecución importante registra origen, actor, estado, timestamps y error útil.

### IV. Un monorepo, despliegues independientes
El código comparte repositorio y contratos, pero Refine, Supabase, Kestra,
Superset y cada worker conservan configuración y ciclo de despliegue propios.
En desarrollo Docker, cada producto usa su propio proyecto Compose: `estudio-automation-refine-dev`,
`estudio-automation-supabase-dev`, `estudio-automation-kestra-dev` y
`estudio-automation-superset-dev`. No existe un Compose raíz que los fusione.

### V. Simplicidad operativa
Se agrega infraestructura sólo cuando existe un caso de uso. Desarrollo es
local; staging aprovecha previews y recursos gratuitos; los servicios de VPS de
staging se levantan bajo demanda y se apagan al terminar.

## Technology and Quality Gates

El stack base es Refine, Supabase, Kestra, Superset y workers explícitos. Toda
entrega debe compilar, pasar lint, validar Compose y documentar migraciones y
variables nuevas. Los cambios sensibles requieren una prueba del aislamiento.

## Delivery Workflow

Las ramas de funcionalidades nacen de `main`. Los pull requests generan Preview
en Vercel y ejecutan validaciones. `staging` integra pruebas compartidas cuando
se necesitan. Producción se promueve desde una versión verificada y requiere
aprobación manual para migraciones o cambios del VPS.

## Governance

Esta constitución prevalece sobre decisiones ad hoc de los agentes. Una
excepción debe quedar documentada en la spec y su plan. Los cambios de principios
requieren actualizar versión, fecha y artefactos afectados.

**Version**: 1.1.0 | **Ratified**: 2026-09-06 | **Last Amended**: 2026-09-06
