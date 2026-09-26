# Cómo usar las skills del proyecto

Esta página explica qué skill cargar según la tarea y dónde se versiona. Las skills aportan instrucciones especializadas; [AGENTS.md](../AGENTS.md) y [CLAUDE.md](../CLAUDE.md) siguen siendo las reglas obligatorias del repositorio.

## Elegir una skill

Cargá una skill solo cuando su descripción coincida con el trabajo. No cargues el catálogo completo ni uses una skill para ampliar el alcance de una tarea.

| Necesidad | Skills |
| --- | --- |
| Nueva funcionalidad | `speckit-specify`, `speckit-plan`, `speckit-tasks`, `speckit-implement` |
| Idea o bug | `speckit-assess-*` o `speckit-bug-*` |
| Pantallas, experiencia de usuario (UX) y accesibilidad | `refine-frontend`, `mui-refine`, `frontend-design`, `web-design-guidelines`, `accessibility-*` |
| Datos y Supabase | `supabase`, `supabase-postgres-best-practices` |
| Workers, Kestra o Superset | `kestra-orquestacion`, `superset-analitica` |
| Pruebas | `pruebas-plataforma`; `playwright-best-practices` para pruebas end-to-end (E2E), inestabilidad o integración continua (CI) de Playwright |
| Revisión y seguridad | `revision-pr` (enruta a la skill de seguridad específica del cambio) |
| Decisiones transversales o investigación amplia | `arquitectura-plataforma`, `eficiencia-contexto` |

Consultá el enrutamiento completo y sus límites en [AGENTS.md](../AGENTS.md).

## Disponibilidad por agente

Codex y OpenCode detectan las skills en `.agents/skills`. Claude Code usa las copias equivalentes de `.claude/skills`. OpenCode también recibe los comandos nativos de GitHub Spec Kit en `.opencode/commands`.

Las extensiones oficiales `assess` y `bug` viven en `.specify/extensions`. Codex las consume mediante wrappers en `.agents/skills`; Claude Code y OpenCode reciben sus integraciones generadas.

## Revisión de PR

`revision-pr` es propia (no está en `skills-lock.json`): revisa spec, reglas del proyecto y evidencia de funcionamiento, y enruta a las skills de seguridad según el diff. Reemplaza el uso por defecto de `code-review`, que es externa y se conserva sin editar para que `npx skills update` no pise cambios locales.

Cada producto derivado puede sumar sus propias reglas en `docs/revision-reglas-producto.md`; el template no trae ese archivo, así que no choca con `git merge upstream/main`. Los hallazgos rechazados con motivo válido se anotan como excepciones aprendidas: los de plataforma en la skill, los del producto en su archivo.

## Actualizar una skill externa

Las fuentes externas y sus hashes están fijados en [`skills-lock.json`](../skills-lock.json). Para una actualización deliberada, ejecutá lo siguiente y revisá el diff antes de conservarlo:

```powershell
npx skills update -p -y
```

Comprobá que las copias de `.agents/skills` y `.claude/skills` sigan presentes. No actualices skills durante una tarea de producto sin evaluar el cambio.

## Controles de seguridad locales

Las skills de seguridad incluyen escáneres Python sin dependencias.

```powershell
python .agents/skills/skill-security/scripts/scan.py .agents/skills --format json
python .agents/skills/crypto-secrets/scripts/scan.py . --format markdown
python .agents/skills/infra-security/scripts/scan.py infra --format markdown
```

`ci-cd-security` no incluye ejecutable. Su revisión de workflows es estática y guiada por su `SKILL.md`.

Estos controles aportan evidencia estática. No sustituyen las validaciones del producto ni autorizan exponer secretos.
