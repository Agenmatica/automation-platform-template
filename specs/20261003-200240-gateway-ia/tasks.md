---

description: "Task list template for feature implementation"
---

# Tasks: Invocación real de proveedor en la capacidad de IA gobernada

**Input**: Design documents from `specs/20261003-200240-gateway-ia/`

## Phase 1: User Story 1 - Invocar sin reimplementar el cliente HTTP por proveedor (Priority: P1) 🎯 MVP

### Tests ⚠️

- [ ] T001 [P] [US1] Test "endpointInvocacion produce la URL correcta para openai/openai-compatible/anthropic/gemini, y lanza PROVEEDOR_IA_SIN_ENDPOINT_INVOCACION para baidu" en `packages/ia/src/proveedores/catalogo.test.ts` (nuevo).
- [ ] T002 [P] [US1] Test "invocarProveedorIa arma método POST, URL y headers correctos por adaptador (anthropic: x-api-key+anthropic-version; gemini: x-goog-api-key, modelo en el path; resto: Authorization Bearer)" en `packages/ia/src/proveedores/index.test.ts` (nuevo).
- [ ] T003 [P] [US1] Test "respuesta no exitosa lanza INVOCACION_PROVEEDOR_IA_FALLO_<status>" en el mismo archivo.
- [ ] T004 [P] [US1] Test "respuesta exitosa devuelve el json() crudo sin transformar" en el mismo archivo.

### Implementation

- [ ] T005 [US1] Agregar `endpointInvocacion(adaptador, modeloId)` a `packages/ia/src/proveedores/catalogo.ts` (depende de T001 para TDD).
- [ ] T006 [US1] Agregar `invocarProveedorIa` a `packages/ia/src/proveedores/index.ts`, reutilizando `encabezados()` (exportada o reutilizada internamente) y `endpointInvocacion` (depende de T002-T004, T005).
- [ ] T007 [US1] Exportar `invocarProveedorIa` y `endpointInvocacion` desde `packages/ia/src/index.ts`.

**Checkpoint**: MVP — un consumidor nuevo puede invocar un proveedor real sin reimplementar headers/URL.

## Phase 2: User Story 2 - Una sola fuente de verdad para headers (Priority: P2)

- [ ] T008 [P] [US2] Confirmar por inspección (no requiere código nuevo) que `invocarProveedorIa` y `descubrirModelos` llaman a la misma función `encabezados()`, sin una segunda copia — si T006 reutilizó la función existente, esta tarea es una verificación, no una implementación.

## Phase 3: Polish

- [ ] T009 [P] Correr `pnpm --filter @platform/ia test`, `pnpm test:ia` (incluye `packages/ia-navegacion`, debe seguir en 17/17 sin tocar su código — FR-005), `pnpm lint`, `pnpm build`.
- [ ] T010 Subir versión de `governed-ai-core` en `template-capabilities.json`/`template-adoption.json`.

## Dependencies & Execution Order

- US1 es la única historia con implementación real; US2 es una verificación derivada de cómo se implementó US1 (si T006 reutiliza `encabezados()` en vez de copiarla, US2 ya está satisfecha).

## Notas de desvío

Ninguna todavía.

## Al cerrar (merge del PR)

Actualizar `docs/roadmap-template.md`: ítem #9 pasa a "Parcialmente resuelto por composición" — la gobernanza (auth/límites/política) ya estaba centralizada antes de esta spec; con esta spec, además, ningún consumidor reimplementa su propio cliente HTTP por proveedor. No llega a "Resuelto por composición, sin código nuevo" como el #19 porque esta spec sí agrega código nuevo (la pieza de invocación que faltaba).
