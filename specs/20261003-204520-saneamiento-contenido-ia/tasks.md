---

description: "Task list template for feature implementation"
---

# Tasks: Saneamiento de contenido no confiable para IA

**Input**: Design documents from `specs/20261003-204520-saneamiento-contenido-ia/`

## Phase 1: User Story 1 - Marcado automático de contenido no confiable (Priority: P1) 🎯 MVP

### Tests ⚠️

- [ ] T001 [P] [US1] Test "marcarContenidoNoConfiable envuelve el texto con un delimitador que incluye un nonce distinto en cada llamada, mismo texto intacto adentro" en `packages/ia/src/sanitizar.test.ts` (nuevo).
- [ ] T002 [P] [US1] Test "prepararInvocacion con clavesNoConfiables declaradas envuelve esas claves (string) y deja las demás igual" en `packages/ia/src/ejecutar.test.ts`.
- [ ] T003 [P] [US1] Test "prepararInvocacion con una clave no confiable de valor no-string la deja sin modificar" en el mismo archivo (Edge Case, FR-004).
- [ ] T004 [P] [US1] Test "prepararInvocacion sin clavesNoConfiables declaradas: resultado idéntico al comportamiento actual" en el mismo archivo (FR-006).

### Implementation

- [ ] T005 [US1] Agregar `clavesNoConfiables?: readonly string[]` a `ContratoConsumidor` en `packages/ia/src/types.ts`.
- [ ] T006 [US1] Agregar `marcarContenidoNoConfiable` a `packages/ia/src/sanitizar.ts` (depende de T001).
- [ ] T007 [US1] Aplicar el marcado automático en `prepararInvocacion` (`packages/ia/src/ejecutar.ts`), después de `sanitizarDato` (depende de T002-T004, T005, T006).

**Checkpoint**: MVP — un contrato que declara contenido no confiable lo tiene marcado automáticamente, sin acción manual del consumidor.

## Phase 2: User Story 2 - Señal de activación para auditoría (Priority: P2)

### Tests ⚠️

- [ ] T008 [P] [US2] Test "clavesActivadas devuelve solo las claves declaradas presentes como string en la entrada" en `packages/ia/src/sanitizar.test.ts`.
- [ ] T009 [P] [US2] Test "clavesActivadas devuelve vacío si no se declaró ninguna clave o ninguna está presente" en el mismo archivo.

### Implementation

- [ ] T010 [US2] Agregar `clavesActivadas` a `packages/ia/src/sanitizar.ts` (depende de T008-T009).

## Phase 3: Polish

- [ ] T011 [P] Correr `pnpm --filter @platform/ia test`, `pnpm test:ia` (incluye `packages/ia-navegacion`, debe seguir en 17/17 sin tocar su código — FR-006), `pnpm lint`, `pnpm build`.
- [ ] T012 Subir versión de `governed-ai-core` en `template-capabilities.json`/`template-adoption.json` (self-adoption y catálogo, mismo patrón ya establecido).

## Dependencies & Execution Order

- US1 (marcado automático) es el MVP — resuelve el gap real por sí sola.
- US2 (señal de activación) es independiente de US1 una vez que existen `clavesNoConfiables` en el contrato — no depende de que `prepararInvocacion` haya aplicado el marcado, solo del contrato y la entrada.

## Notas de desvío

Ninguna todavía.

## Al cerrar (merge del PR)

Actualizar `docs/roadmap-template.md`: ítem #24 pasa a "Implementado" — cubre exactamente lo que pide el roadmap (delimitadores y marcado explícito de contenido no confiable, instrucción de sistema implícita en el propio delimitador, registro de cuándo se activó la defensa vía `clavesActivadas`). No incluye el patrón "dual LLM" (mitigación más fuerte, fuera de alcance por falta de caso de uso real — ver Assumptions de spec.md).
