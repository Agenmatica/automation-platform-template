---

description: "Tareas: runners locales que no saturan la red ni la memoria"
---

# Tasks: Runners locales que no saturan la red ni la memoria

**Input**: `specs/20260925-221701-optimizar-runners-locales/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: no hay tests automatizados nuevos (es configuración Compose); la
validación es `pnpm infra:config`, los checks del catálogo y dos corridas
reales del CI del PR.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Registrar la línea base: log de `pnpm install` (reused/downloaded, duración) de la primera corrida de Validate del PR con los runners viejos y pico de memoria por réplica en `specs/20260925-221701-optimizar-runners-locales/research.md` (R5)

**Checkpoint**: línea base registrada.

---

## Phase 2: User Story 1 - Una dependencia se descarga una sola vez por máquina (P1) 🎯 MVP

**Goal**: todas las réplicas (y otros productos) usan un único store persistente.

**Independent Test**: dos corridas del CI con el mismo lockfile; la segunda muestra `downloaded 0`.

- [ ] T002 [US1] Declarar el volumen `${RUNNER_PNPM_STORE_VOLUME:-platform-runner-pnpm-store}` montado en `/pnpm-store` y `pnpm_config_store_dir=/pnpm-store` en `infra/runner/compose.yaml`, con comentario sobre por qué gana a `PNPM_HOME` y por qué es seguro compartirlo
- [ ] T003 [P] [US1] Agregar `RUNNER_PNPM_STORE_VOLUME` a `.env.example` junto a `GH_RUNNER_PAT`
- [ ] T004 [P] [US1] Documentar el store compartido (ubicación, seguridad concurrente, límites: volumen local, `prune` solo sin jobs; tamaño y limpieza) en `docs/deployment.md` y actualizar `docs/ci-self-hosted-storage.md`

**Checkpoint**: `pnpm infra:config` pasa; US1 lista para validar en T013.

---

## Phase 3: User Story 2 - Réplicas configurables (P2)

**Goal**: `RUNNER_REPLICAS` con default 3.

**Independent Test**: `RUNNER_REPLICAS=1 docker compose -f infra/runner/compose.yaml config` muestra `replicas: 1`; sin variable, 3.

- [ ] T005 [US2] Interpolar `deploy.replicas: ${RUNNER_REPLICAS:-3}` en `infra/runner/compose.yaml`
- [ ] T006 [P] [US2] Agregar `RUNNER_REPLICAS` a `.env.example` y documentar en `docs/deployment.md` cuándo bajarla (agentes activos, memoria, red), el efecto (jobs en cola, en serie) y el uso de `0`
- [ ] T007 [P] [US2] Pasar `--env-file .env` también en `dev:down:runner` de `package.json`

**Checkpoint**: interpolación verificada con 0, 1, sin valor y valor inválido.

---

## Phase 4: User Story 3 - Contener red y memoria por runner (P3)

**Goal**: tope de memoria medido y descargas limitadas con reintentos.

**Independent Test**: `docker inspect` muestra el tope; `env` del contenedor muestra `pnpm_config_network_concurrency` y `pnpm_config_fetch_retries`; el CI completo pasa.

- [ ] T008 [US3] Fijar el default de `RUNNER_MEMORY_LIMIT` a partir de la medición de T001 (pico + ~50 %, redondeado a GiB) en `infra/runner/compose.yaml` (`deploy.resources.limits.memory`) y completar la tabla de R5 en `research.md`
- [ ] T009 [US3] Agregar `pnpm_config_network_concurrency: ${RUNNER_PNPM_NETWORK_CONCURRENCY:-16}` y `pnpm_config_fetch_retries: 5` al entorno en `infra/runner/compose.yaml`
- [ ] T010 [P] [US3] Agregar `RUNNER_MEMORY_LIMIT` y `RUNNER_PNPM_NETWORK_CONCURRENCY` a `.env.example` y documentar topes y concurrencia en `docs/deployment.md`

**Checkpoint**: `pnpm infra:config` pasa.

---

## Phase 5: User Story 4 - Adopción en productos derivados (P3)

**Goal**: capacidad versionada con guía de adopción.

**Independent Test**: `pnpm template:capabilities:check` y `pnpm test:template:adoption` pasan; la guía cubre verificación de runners ocupados y reversión.

- [ ] T011 [US4] Publicar `local-ci-runners` 1.0.0 (ruta `infra/runner/compose.yaml`) en `template-capabilities.json` y declararla `adopted` en `template-adoption.json`
- [ ] T012 [P] [US4] Escribir `docs/adoptar-runners-locales.md` (qué cambia, merge del compose conservando `name`/`RUNNER_REPO`/`RUNNER_NAME` del producto, verificación de `busy` con `gh api`, recreación, validación y reversión) y enlazarla desde `docs/adoptar-capacidades-template.md` y `docs/crear-producto-derivado.md`

**Checkpoint**: catálogo válido.

---

## Phase 6: Validación real y cierre de rama

- [ ] T013 Verificar con `gh api repos/Agenmatica/automation-platform-template/actions/runners` que ningún runner del template esté `busy`, recrear solo los del template con `pnpm dev:runner` y comprobar entorno, tope y volumen (quickstart §2–3)
- [ ] T014 Correr el CI del PR dos veces (push + `gh run rerun`) y registrar en este archivo reused/downloaded, duración del install y tamaño del store de ambas corridas (SC-001, SC-002, SC-005)
- [ ] T015 Correr `pnpm infra:config`, `pnpm docs:check`, `pnpm template:capabilities:check --base origin/main` y `pnpm test:template:adoption`

## Dependencies

- T001 antes de T008 (el default sale de la medición).
- T002, T005, T008, T009 tocan el mismo archivo: en serie.
- T013 después de todas las fases de implementación; T014 después de T013.
- US1, US2 y US3 son independientes entre sí salvo por el archivo compartido; US4 depende de que exista el compose final.

## Parallel Example

```text
T003, T004 (US1) en paralelo con T006, T007 (US2) y T010 (US3): archivos distintos.
```

## Implementation Strategy

MVP = US1 (store compartido): elimina las descargas repetidas, que son la
causa de los CI caídos. US2/US3 agregan palancas de operación; US4 publica.
Como todo converge en un único `compose.yaml`, los runners se recrean una sola
vez (T013) con todos los cambios, para cortar jobs lo menos posible.
