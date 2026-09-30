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

- [ ] T005 Crear migración aditiva `supabase/migrations/<timestamp>_conexiones_oauth.sql` con las tablas `integraciones_oauth`, `conexiones_oauth` (incluyendo `unique (organizacion_id, integracion_id)` e índice por `organizacion_id`) y `eventos_conexion_oauth`, con su comentario de reversión documentado (Technology Gates).
- [ ] T006 En la misma migración, crear las funciones `SECURITY DEFINER`/`set search_path = ''` de `data-model.md`: `iniciar_conexion_oauth`, `confirmar_conexion_oauth`, `marcar_conexion_oauth_invalida`, `registrar_integracion_oauth`, `actualizar_integracion_oauth`, reutilizando `private.es_administrador_de` y el chequeo de superadmin ya existentes.
- [ ] T007 En la misma migración, habilitar RLS y políticas de `select` por organización (administrador/superadmin) en `conexiones_oauth` y `eventos_conexion_oauth`; `integraciones_oauth` legible por cualquier persona autenticada con contexto de organización activo, sin `insert`/`update` directo para `authenticated` en ninguna de las tres tablas.
- [ ] T008 [P] Crear esqueleto pgTAP en `supabase/tests/database/conexiones_oauth.test.sql` (tablas, columnas, constraints, RLS habilitada).

**Checkpoint**: las tablas y funciones existen; ninguna organización puede leer la fila de otra (pgTAP de aislamiento mínimo pasa).

## Fase 3 — Historia 1: conectar una cuenta externa (P1)

- [ ] T009 [US1] pgTAP: `iniciar_conexion_oauth` crea una fila `pendiente`, es idempotente (no duplica con `unique`), y falla si la integración no está `habilitada` o quien llama no administra esa organización — en `supabase/tests/database/conexiones_oauth.test.sql`.
- [ ] T010 [US1] pgTAP: `confirmar_conexion_oauth` solo actúa sobre conexiones de la propia organización del llamador y registra el evento `creada` — en `supabase/tests/database/conexiones_oauth.test.sql`.
- [ ] T011 [US1] Agregar dependencia `@nangohq/frontend` en `apps/web` e implementar `apps/web/src/providers/nango/` (wrapper mínimo: construir cliente Nango con la URL pública del entorno, exponer una función `conectar(clave, conexionId)`).
- [ ] T012 [US1] Implementar la pantalla/feature `apps/web/src/features/conexiones-oauth/` (Refine): listar integraciones habilitadas, botón "Conectar" que llama `iniciar_conexion_oauth` → `nango.auth(...)` → `confirmar_conexion_oauth`, declarando ubicación/icono en la navegación, estados de carga/vacío/error compartidos y accesibilidad (Principio VI).
- [ ] T013 [US1] Verificar manualmente el flujo completo contra un proveedor real en modo Testing siguiendo `quickstart.md` (pasos 1-5) y registrar la evidencia sanitizada en este archivo.

**Checkpoint**: una organización completa el flujo de conexión de extremo a extremo y ve el estado "activa" en Refine.

## Fase 4 — Historia 2: obtener un token vigente sin manejar refresh (P1)

- [ ] T014 [US2] pgTAP: `marcar_conexion_oauth_invalida` deja `estado = 'con_error'`, registra el evento `invalidada` con motivo, y es invocable por `service_role` además de por administrador/superadmin de esa organización — en `supabase/tests/database/conexiones_oauth.test.sql`.
- [ ] T015 [US2] pgTAP: el `select` de resolución de `conexion_id` por `organizacion_id` + `clave` (Paso 1 de `contracts/obtener-token-oauth.md`) respeta RLS entre organizaciones.
- [ ] T016 [US2] Verificar manualmente el Paso 2 del contrato (`GET {NANGO_SERVER_URL}/connection/:id`) contra la conexión activa creada en la Fase 3, siguiendo `quickstart.md` (paso 8), y registrar la evidencia (sin exponer el token) en este archivo.
- [ ] T017 [US2] Revisar que `contracts/obtener-token-oauth.md` quede consistente con el resultado real del paso anterior (nombres de campos de la respuesta de Nango, forma exacta del error de refresh) y corregir si algo difiere de lo documentado.

**Checkpoint**: un proceso externo de prueba obtiene un `access_token` vigente siguiendo únicamente el contrato documentado, sin leer código de esta spec.

## Fase 5 — Historia 3: ver estado y reautorizar (P2)

- [ ] T018 [US3] pgTAP: reautorizar (repetir `iniciar_conexion_oauth` + `confirmar_conexion_oauth` sobre una conexión `con_error`) no duplica la fila y registra el evento `reautorizada` — en `supabase/tests/database/conexiones_oauth.test.sql`.
- [ ] T019 [US3] Extender la pantalla de la Fase 3 para mostrar el estado de cada conexión (`activa`/`con_error`/`pendiente`) con los patrones compartidos de estado ya existentes en el panel, y ofrecer "Reautorizar" cuando el estado es `con_error`.
- [ ] T020 [US3] Verificar manualmente el escenario de revocación + reautorización de `quickstart.md` (paso 6) y registrar evidencia.

**Checkpoint**: una conexión revocada se refleja como tal en Refine y se puede reautorizar sin duplicarse.

## Fase 6 — Historia 4: registrar un proveedor nuevo sin tocar el producto (P3)

- [ ] T021 [US4] pgTAP: `registrar_integracion_oauth`/`actualizar_integracion_oauth` solo son ejecutables por superadmin; una integración deshabilitada rechaza `iniciar_conexion_oauth` para cualquier organización.
- [ ] T022 [US4] Implementar una pantalla mínima de superadmin (lista + alta + toggle de `habilitada`) reutilizando los patrones de UI ya existentes del panel de funcionalidades (spec 009), sin lógica de negocio de ningún proveedor concreto.
- [ ] T023 [US4] Verificar manualmente que dar de alta una segunda integración de prueba (proveedor distinto de Google) no requiere ningún cambio de esquema ni de la pantalla de la Fase 3.

**Checkpoint**: el mecanismo admite un segundo proveedor sin tocar el esquema ya publicado.

## Fase 7 — Documentación y validación

- [ ] T024 [P] Escribir `docs/adoptar-conexiones-oauth.md`: cómo un producto derivado habilita este mecanismo, cómo registra su primera integración real y dónde vive el secreto de Nango en cada entorno.
- [ ] T025 [P] Actualizar `docs/deployment.md` con la operación de `nango-server` en staging/producción (dominio propio del producto, igual que Kestra/Superset).
- [ ] T026 Ejecutar `pnpm lint`, `pnpm build`, `pnpm infra:config` y `pnpm test` (con `pnpm dev:supabase` corriendo) y registrar el resultado en este archivo.
- [ ] T027 Ejecutar `quickstart.md` completo de punta a punta y documentar evidencia sanitizada (sin tokens, sin credenciales) en este archivo.

## Dependencias

Fase 1 → Fase 2 → Historia 1 → Historia 2 → Historia 3 → Historia 4 → Fase 7.
Historia 1 e Historia 2 forman el circuito mínimo de valor (conectar + usar) y
deben quedar validadas juntas antes de considerar la spec adoptable por un
producto derivado. Historia 3 e Historia 4 mejoran robustez y generalidad,
pero no bloquean una primera adopción real si el tiempo apremia (quedarían
como seguimiento explícito en `docs/roadmap-template.md` al cerrar el PR).
