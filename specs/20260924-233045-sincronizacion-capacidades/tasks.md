# Tasks: Sincronización de capacidades derivadas

## Phase 1: Foundation

- [ ] T001 Definir catálogo base en `template-capabilities.json`.
- [ ] T002 Definir formato de adopción en `template-adoption.json` y su guía en `docs/crear-producto-derivado.md`.
- [ ] T003 Implementar comparación sanitizada y pruebas en `scripts/verificar-adopcion-template.mjs` y `scripts/verificar-adopcion-template.test.mjs`.

**Checkpoint**: catálogo y comparación local verificables.

## Phase 2: Product synchronization

- [ ] T004 [US2] Agregar workflow de comparación por capacidades a `.github/workflows/sync-template.yml`.
- [ ] T005 [US3] Documentar `TEMPLATE_READ_TOKEN` sin versionar secretos en `docs/crear-producto-derivado.md`.
- [ ] T006 [US2] Validar que el workflow no ejecute merge ni compare SHA.

**Checkpoint**: un producto puede detectar capacidades pendientes de forma segura.

## Phase 3: Sauger adoption

- [ ] T007 [US1] Crear manifiesto de adopción en Sauger y registrar capacidades reconciliadas.
- [ ] T008 [US2] Adaptar el workflow de Sauger al verificador del template.
- [ ] T009 [US3] Configurar el secreto de lectura en GitHub y comprobar una ejecución remota sanitizada.

**Checkpoint**: Sauger queda registrado como un producto derivado, sin merge masivo.
