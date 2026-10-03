---

description: "Task list template for feature implementation"
---

# Tasks: UI de IA y corrección de esperando_aprobacion en la base

**Input**: Design documents from `specs/20261003-182325-ui-ia-aprobacion-pendiente/`

## Phase 1: User Story 1 - Corregir la base (Priority: P1) 🎯 MVP

### Tests ⚠️

- [ ] T001 [P] [US1] pgTAP "respuesta_validada -> esperando_aprobacion es una transición válida" en `supabase/tests/database/capacidad_ia_gobernada.test.sql`.
- [ ] T002 [P] [US1] pgTAP "esperando_aprobacion -> completada y -> rechazada son transiciones válidas" en el mismo archivo.
- [ ] T003 [P] [US1] pgTAP "las transiciones existentes (incluida revision_humana) siguen pasando sin cambios" — correr la suite completa, no solo los casos nuevos (quickstart, SC-001).

### Implementation

- [ ] T004 [US1] Migración nueva en `supabase/migrations/`: agregar `esperando_aprobacion` al check de `ia_interacciones.estado` y las dos ramas nuevas a `private.registrar_evento_interaccion_ia` (depende de ningún task previo; es la base).

**Checkpoint**: MVP — el estado es alcanzable y resoluble en la base.

## Phase 2: User Story 2 - Insignia de estado reutilizable (Priority: P2)

### Tests ⚠️

- [ ] T005 [P] [US2] Test "los 10 valores de EstadoInteraccion producen una de las 4 categorías documentadas, sin caso por defecto silencioso" en `apps/web/src/components/ia/InsigniaEstadoInteraccionIA.test.tsx` (quickstart; SC-003).

### Implementation

- [ ] T006 [US2] Crear `InsigniaEstadoInteraccionIA` en `apps/web/src/components/ia/InsigniaEstadoInteraccionIA.tsx` (depende de T005 para TDD, no de T001-T004).

## Phase 3: User Story 3 - Acciones de resolución reutilizables (Priority: P2)

### Tests ⚠️

- [ ] T007 [P] [US3] Test "se muestran las mismas tres acciones para revision_humana y esperando_aprobacion" en `apps/web/src/components/ia/AccionesResolucionInteraccionIA.test.tsx`.
- [ ] T008 [P] [US3] Test "no se muestra nada para cualquier otro estado" en el mismo archivo.

### Implementation

- [ ] T009 [US3] Crear `AccionesResolucionInteraccionIA` en `apps/web/src/components/ia/AccionesResolucionInteraccionIA.tsx`, llamando `resolver_revision_ia` (depende de T007/T008).
- [ ] T010 [US3] Refactorizar `apps/web/src/pages/ia/interacciones.tsx`: usar `InsigniaEstadoInteraccionIA`/`AccionesResolucionInteraccionIA`, adoptar `EstadoCargaPagina` (en vez de `return null`) y `EstadoVacio` (cuando `interacciones.length === 0`) — FR-006, SC-004 (depende de T006, T009).

## Phase 4: Polish

- [ ] T011 [P] Confirmar visualmente (`pnpm dev:refine`, quickstart) que `/ia/interacciones` sigue funcionando igual para el superadmin.
- [ ] T012 Correr `pnpm dev:supabase` + `pnpm test:db`, `pnpm --filter @platform/web test`, `pnpm lint`, `pnpm build`, `pnpm infra:config`, `pnpm docs:check`.
- [ ] T013 Subir versión de `operable-refine-panel` en `template-capabilities.json`/`template-adoption.json` (los componentes nuevos son parte de esa capacidad, no de `governed-ai-core` — son UI de panel, no núcleo de IA).

## Dependencies & Execution Order

- US1 (Phase 1) es independiente de US2/US3 — toca únicamente la base, no el frontend. Puede validarse y cerrarse sola.
- US2 y US3 son independientes entre sí; ambas alimentan T010 (el refactor de la pantalla), que depende de las dos.

## Notas de desvío

Ninguna todavía.

## Al cerrar (merge del PR)

Actualizar `docs/roadmap-template.md`: ítem #20 queda parcialmente implementado (insignia de estado y acciones de resolución reutilizables); progreso/fuentes de una generación en curso (más allá del indicador de "en curso" de la insignia) quedan pendientes para cuando exista un consumidor que efectivamente muestre streaming o fuentes.
