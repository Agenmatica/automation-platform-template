# Tareas: Conexiones OAuth de plataforma vía Nango

**Entrada**: artefactos de `specs/20260930-153545-conexiones-oauth-nango/`.
**Pruebas**: pgTAP obligatorio para tablas, RLS y funciones `SECURITY DEFINER`; `pnpm infra:config` para el Compose nuevo; verificación manual end-to-end contra un proveedor real en modo Testing (no automatizable en CI sin credenciales de proveedor).

## Fase 1 — Infraestructura de Nango

- [X] T001 Crear `infra/nango/compose.yaml` con `nango-db` (`postgres:16.0-alpine`), `nango-redis` (`redis:7.2.4`) y `nango-server` (`nangohq/nango-server:hosted`, pineado por tag/digest), puertos configurables por variable de entorno (mismo patrón que la spec 015) y nombre de proyecto Compose siguiendo la convención del repo.
- [X] T002 [P] Sumar al `.env.example` raíz (convención ya existente: Compose lee `.env` desde la carpeta del propio compose.yaml, así que se copia a `infra/nango/.env`) las variables `NANGO_PORT`, `NANGO_ENCRYPTION_KEY`, `NANGO_DB_PASSWORD`, `NANGO_DASHBOARD_USERNAME`, `NANGO_DASHBOARD_PASSWORD`, `NANGO_SERVER_URL`, `NANGO_PUBLIC_SERVER_URL`, `NANGO_SECRET_KEY_DEV` — todas con defaults locales de ejemplo, nunca secretos reales; y agregar `NANGO_PORT` a la tabla de puertos de la spec 015.
- [X] T003 [P] Agregar `dev:nango`, `dev:down:nango` e `infra:config:nango` a `package.json` (y sumar `infra:config:nango` al agregado `infra:config`).
- [X] T004 [P] Documentar el servicio en `infra/nango/README.md` (arranque local, dashboard, cómo registrar una integración de prueba) y sumar la fila de Nango a la tabla de servicios de `README.md` raíz.

**Checkpoint**: `pnpm dev:nango` levanta los 3 servicios y `pnpm infra:config` valida el Compose nuevo; el dashboard de Nango es alcanzable en local.

## Fase 2 — Fundaciones de esquema (Supabase)

- [X] T005 Crear migración aditiva `supabase/migrations/20260930160000_conexiones_oauth.sql` con las tablas `integraciones_oauth`, `conexiones_oauth` (incluyendo `unique (organizacion_id, integracion_id)` e índice por `organizacion_id`) y `eventos_conexion_oauth`, con su comentario de reversión documentado (Technology Gates).
- [X] T006 En la misma migración, crear las funciones `SECURITY DEFINER`/`set search_path = ''` de `data-model.md`: `iniciar_conexion_oauth`, `confirmar_conexion_oauth`, `marcar_conexion_oauth_invalida`, `registrar_integracion_oauth`, `actualizar_integracion_oauth`, reutilizando `private.es_administrador_de` y el chequeo de superadmin ya existentes.
- [X] T007 En la misma migración, habilitar RLS y políticas de `select` por organización (administrador/superadmin) en `conexiones_oauth` y `eventos_conexion_oauth`; `integraciones_oauth` legible por cualquier persona autenticada con contexto de organización activo, sin `insert`/`update` directo para `authenticated` en ninguna de las tres tablas.
- [X] T008 [P] Crear esqueleto pgTAP en `supabase/tests/database/conexiones_oauth.test.sql` (tablas, columnas, constraints, RLS habilitada).

**Checkpoint**: las tablas y funciones existen; ninguna organización puede leer la fila de otra (pgTAP de aislamiento mínimo pasa).

## Fase 3 — Historia 1: conectar una cuenta externa (P1)

- [X] T009 [US1] pgTAP: `iniciar_conexion_oauth` crea una fila `pendiente`, es idempotente (no duplica con `unique`), y falla si la integración no está `habilitada` o quien llama no administra esa organización — en `supabase/tests/database/conexiones_oauth.test.sql`.
- [X] T010 [US1] pgTAP: `confirmar_conexion_oauth` solo actúa sobre conexiones de la propia organización del llamador y registra el evento `creada` — en `supabase/tests/database/conexiones_oauth.test.sql`.
- [X] T011 [US1] Agregar dependencia `@nangohq/frontend` en `apps/web` e implementar `apps/web/src/providers/nango/` (wrapper mínimo: construir cliente Nango con la URL pública del entorno, exponer una función `conectarOAuth(clave, conexionId)`).
- [X] T012 [US1] Implementar la pantalla `apps/web/src/pages/conexiones-oauth/list.tsx` (Refine): listar integraciones habilitadas, botón "Conectar" que llama `iniciar_conexion_oauth` → `nango.auth(...)` → `confirmar_conexion_oauth`, declarando ubicación/icono en la navegación (`destinosPanel.ts`, sección Configuración) y reutilizando los patrones compartidos de carga/vacío/error/adaptable (Principio VI).
- [ ] T013 [US1] Verificar manualmente el flujo completo contra un proveedor real en modo Testing siguiendo `quickstart.md` (pasos 1-5) y registrar la evidencia sanitizada en este archivo. Preparado y verificado hasta el paso previo al clic humano: Nango local levantado, integración `google` creada vía API (`POST /integrations`, client id/secret de `agenmatica-integraciones`) y registrada en Supabase (`registrar_integracion_oauth`); falta el clic de consentimiento real (requiere login interactivo como `njones@eraconsultores.com`, no automatizable desde este agente — Claude in Chrome de esta sesión está pareado a un navegador remoto, no a esta máquina).

**Checkpoint**: una organización completa el flujo de conexión de extremo a extremo y ve el estado "activa" en Refine.

## Fase 4 — Historia 2: obtener un token vigente sin manejar refresh (P1)

- [X] T014 [US2] pgTAP: `marcar_conexion_oauth_invalida` deja `estado = 'con_error'`, registra el evento `invalidada` con motivo, y es invocable únicamente por `service_role` (desvío respecto de `data-model.md`, que mencionaba también admin/superadmin: sin GRANT a `authenticated` a propósito, mismo criterio que `private.marcar_conexion_credencial_invalida` de spec 013 — ver comentario de la función en la migración) — en `supabase/tests/database/conexiones_oauth.test.sql`.
- [X] T015 [US2] pgTAP: el `select` de resolución de `conexion_id` por `organizacion_id` + `clave` (Paso 1 de `contracts/obtener-token-oauth.md`) respeta RLS entre organizaciones.
- [ ] T016 [US2] Verificar manualmente el Paso 2 del contrato (`GET {NANGO_SERVER_URL}/connection/:id`) contra la conexión activa creada en la Fase 3, siguiendo `quickstart.md` (paso 8), y registrar la evidencia (sin exponer el token) en este archivo.
- [ ] T017 [US2] Revisar que `contracts/obtener-token-oauth.md` quede consistente con el resultado real del paso anterior (nombres de campos de la respuesta de Nango, forma exacta del error de refresh) y corregir si algo difiere de lo documentado.

**Checkpoint**: un proceso externo de prueba obtiene un `access_token` vigente siguiendo únicamente el contrato documentado, sin leer código de esta spec.

## Fase 5 — Historia 3: ver estado y reautorizar (P2)

- [X] T018 [US3] pgTAP: reautorizar (repetir `iniciar_conexion_oauth` + `confirmar_conexion_oauth` sobre una conexión `con_error`) no duplica la fila y registra el evento `reautorizada` — en `supabase/tests/database/conexiones_oauth.test.sql`.
- [X] T019 [US3] Extender la pantalla de la Fase 3 para mostrar el estado de cada conexión (`activa`/`con_error`/`pendiente`) con los patrones compartidos de estado ya existentes en el panel, y ofrecer "Reautorizar" cuando el estado es `con_error`.
- [ ] T020 [US3] Verificar manualmente el escenario de revocación + reautorización de `quickstart.md` (paso 6) y registrar evidencia.

**Checkpoint**: una conexión revocada se refleja como tal en Refine y se puede reautorizar sin duplicarse.

## Fase 6 — Historia 4: registrar un proveedor nuevo sin tocar el producto (P3)

- [X] T021 [US4] pgTAP: `registrar_integracion_oauth`/`actualizar_integracion_oauth` solo son ejecutables por superadmin; una integración deshabilitada rechaza `iniciar_conexion_oauth` para cualquier organización.
- [X] T022 [US4] Implementar una pantalla mínima de superadmin (`apps/web/src/pages/integraciones-oauth/administrar.tsx`: lista + alta + toggle de `habilitada`) reutilizando los patrones de UI ya existentes del panel de funcionalidades (spec 009), sin lógica de negocio de ningún proveedor concreto.
- [ ] T023 [US4] Verificar manualmente que dar de alta una segunda integración de prueba (proveedor distinto de Google) no requiere ningún cambio de esquema ni de la pantalla de la Fase 3.

**Checkpoint**: el mecanismo admite un segundo proveedor sin tocar el esquema ya publicado.

## Fase 6.1 — Resolución para flows de Kestra (desvío, ver commit `20260930165825`)

Gap real reportado por el agente de `exportar-planilla-contable` (primer
consumidor en paralelo): un flow de Kestra corre como `kestra_orquestacion`
vía JDBC directo, sin `select` sobre `conexiones_oauth`/`integraciones_oauth`.

- [X] `private.datos_despacho_conexion_oauth(organizacion_id, clave)` en
  `supabase/migrations/20260930165825_datos_despacho_conexion_oauth.sql`,
  mismo criterio que `private.datos_despacho_conexion` (spec 013). pgTAP:
  grants (`kestra_orquestacion` sí, `authenticated` no), resolución correcta
  y `P0002` sin conexión activa / integración inexistente.
- [X] Documentado como variante del Paso 1 en `contracts/obtener-token-oauth.md`.

## Fase 7 — Documentación y validación

- [X] T024 [P] Escribir `docs/adoptar-conexiones-oauth.md`: cómo un producto derivado habilita este mecanismo, cómo registra su primera integración real y dónde vive el secreto de Nango en cada entorno.
- [X] T025 [P] Actualizar `docs/deployment.md` con la operación de `nango-server` en staging/producción (dominio propio del producto, igual que Kestra/Superset).
- [X] T026 Ejecutar `pnpm lint`, `pnpm build`, `pnpm infra:config` y `pnpm test` (con `pnpm dev:supabase` corriendo) y registrar el resultado en este archivo. **2026-09-30**: `lint` OK (solo warnings preexistentes ajenos a esta spec), `build` OK, `infra:config` OK (incluye `infra/nango`), `pnpm test:web` 103/103, pgTAP de esta spec 41/41 verde (`conexiones_oauth.test.sql`, incluye `datos_despacho_conexion_oauth`). CI real de PR #65 (`application`/`database`/`infrastructure`/`verificar`, stack de Supabase aislado por CI) en verde. Nota operativa: `pnpm test:db` corrido a mano en este worktree mostró fallas ajenas a esta spec (`sistemas_externos`/FK en `conexiones`) porque el Postgres local de desarrollo (`automation-platform-template-supabase-de...`) es compartido entre todos los worktrees del repo — otra sesión resetó esa base mientras yo trabajaba, algo que no afecta a CI (base aislada por spec `isolated-ci-database`) ni a esta migración (aditiva): se re-aplicó a mano sobre la base compartida sin tocar el trabajo de la otra sesión.
- [ ] T027 Ejecutar `quickstart.md` completo de punta a punta y documentar evidencia sanitizada (sin tokens, sin credenciales) en este archivo. **2026-09-30, avance**: pasos 1-4 verificados (Nango self-hosted levantado con `pnpm dev:nango`; integración `google` creada en Nango vía su API con credenciales de un proyecto GCP de prueba dedicado a esta verificación — `agenmatica-integraciones`, app OAuth en modo Testing con un usuario de prueba agregado; `registrar_integracion_oauth('google','Google')` corrido como superadmin; `apps/web` corriendo en `http://localhost:3105` con `VITE_NANGO_PUBLIC_SERVER_URL` apuntando a Nango local). Paso 5 (clic real de consentimiento) requiere login interactivo de una persona con la cuenta de prueba de Google — no ejecutable por este agente (política de seguridad: no ingresa contraseñas de cuentas reales de terceros) ni por el navegador remoto conectado a esta sesión (no alcanza `localhost` de esta máquina). Pendiente de que una persona complete ese único paso.

## Dependencias

Fase 1 → Fase 2 → Historia 1 → Historia 2 → Historia 3 → Historia 4 → Fase 7.
Historia 1 e Historia 2 forman el circuito mínimo de valor (conectar + usar) y
deben quedar validadas juntas antes de considerar la spec adoptable por un
producto derivado. Historia 3 e Historia 4 mejoran robustez y generalidad,
pero no bloquean una primera adopción real si el tiempo apremia (quedarían
como seguimiento explícito en `docs/roadmap-template.md` al cerrar el PR).
