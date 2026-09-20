# Feature Specification: Capacidad de IA gobernada para navegación

**Feature Branch**: `016-capacidad-ia-gobernada`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Una capacidad reutilizable permite que cualquier worker con navegación recupere un paso fallido en la misma sesión, bajo políticas estrictas y auditables."

**Delivery scope**: refine | supabase | kestra | workers

## Alcance

Esta entrega aporta el mecanismo común para workers que navegan servicios externos. Un worker adopta el mecanismo declarando sus pasos recuperables, acciones permitidas y verificadores locales; no duplica proveedores, secretos, sanitización, límites ni auditoría. Los recorridos de negocio, como un reporte de un proveedor concreto, pertenecen a las specs del producto consumidor.

Los proveedores y modelos se administran globalmente; los modelos se descubren para cada clave y no quedan fijados en la interfaz. Solo se habilitan proveedores que garanticen cero retención del contexto y ningún uso para entrenamiento. Las capturas están deshabilitadas por defecto.

## Clarifications

### Session 2026-09-20

- Q: ¿Quién puede configurar proveedores, claves y políticas? → A: Solo superadmin configura proveedores y claves; el administrador habilita una política aprobada para su organización.
- Q: ¿Qué se envía al proveedor? → A: Solo contexto estructural sanitizado, sin valores contables.
- Q: ¿Cuál es el límite por intervención? → A: Dos intentos y 90 segundos.
- Q: ¿Cuánto se conservan trazas y evidencias sanitizadas? → A: 90 días.
- Q: ¿Qué requisito de retención tiene un proveedor habilitado? → A: Cero retención y sin uso para entrenamiento.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recuperar un paso de navegación autorizado (Priority: P1)

Cuando un worker no puede completar un paso recuperable, continúa la misma sesión autenticada y solicita una propuesta limitada al paso pendiente. Si la propuesta pasa la política y su verificador local, el worker retoma desde un punto seguro.

**Why this priority**: permite absorber cambios menores de interfaces externas sin convertir cada worker en un agente con control amplio.

**Independent Test**: se simula un paso recuperable en un worker de prueba y se confirma que el mecanismo conserva la sesión, ejecuta solo una acción autorizada y devuelve el control al checkpoint definido.

**Acceptance Scenarios**:

1. **Given** un worker con una sesión autenticada y un paso recuperable declarado, **When** falla su camino normal, **Then** el mecanismo puede proponer y ejecutar exclusivamente la acción permitida en esa misma sesión.
2. **Given** una propuesta que alcanza el resultado verificable, **When** el worker retoma, **Then** no repite efectos externos ya confirmados.

---

### User Story 2 - Gobernar proveedores y habilitaciones (Priority: P1)

El superadmin configura proveedores, claves y políticas aprobadas. El administrador de una organización habilita una política ya aprobada para su organización o conexión, sin acceder a claves ni modificar la política.

**Why this priority**: las sesiones externas y las claves de IA requieren un límite de permisos independiente del poder de cada organización.

**Independent Test**: se comprueba que superadmin administra el catálogo y que un administrador solo habilita una política aplicable a su propia organización.

**Acceptance Scenarios**:

1. **Given** una política aprobada, **When** el administrador de una organización la habilita, **Then** esa habilitación no expone ni modifica proveedor, modelo ni clave.
2. **Given** una persona sin privilegios suficientes, **When** intenta leer una clave o cambiar una política global, **Then** el sistema la rechaza y registra la decisión.

---

### User Story 3 - Auditar y detener una intervención (Priority: P2)

Quien opera la plataforma puede distinguir una corrida normal, recuperada o derivada a revisión humana y diagnosticarla con evidencia sanitizada, sin secretos ni contenido sensible.

**Why this priority**: la recuperación solo es segura si una intervención agotada o incierta deja trazabilidad útil y no se transforma en una dependencia silenciosa.

**Independent Test**: se ejecutan una intervención permitida, una rechazada y una agotada; el historial muestra decisión, paso, intentos y resultado según los permisos de la organización.

**Acceptance Scenarios**:

1. **Given** una intervención que excede dos intentos o 90 segundos, **When** alcanza el límite, **Then** se detiene y pasa a revisión humana en menos de dos minutos.
2. **Given** una acción fuera del catálogo, **When** se evalúa, **Then** se rechaza antes de producir efecto externo y queda auditada.

### Edge Cases

- Si la sesión deja de ser válida, el mecanismo no reautentica ni entrega credenciales al proveedor; devuelve el control al manejo de sesión del worker.
- Si la pantalla cambia de dominio, pide autenticación adicional, presenta un desafío de seguridad o no permite verificar el resultado, el mecanismo no avanza.
- Si el proveedor no está disponible o su respuesta no coincide con el contrato, la intervención conserva el error original y finaliza de forma controlada.
- Si dos corridas intentan usar la misma conexión, se respetan los bloqueos de concurrencia existentes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE poder ser adoptado por cualquier worker que navegue, mediante pasos recuperables, políticas de acción y verificadores locales declarados por ese worker.
- **FR-002**: El mecanismo DEBE operar exclusivamente en la misma sesión y contexto de navegador de la corrida que originó la falla; no DEBE abrir otra sesión ni reautenticar.
- **FR-003**: Cada intervención DEBE limitarse a una acción autorizada, un origen permitido y un resultado verificable definidos por la política activa.
- **FR-004**: El mecanismo DEBE permitir navegar, seleccionar contexto ya autorizado, completar filtros y solicitar o localizar descargas; DEBE excluir creación, modificación o eliminación de datos, credenciales, permisos, configuraciones, pagos y presentaciones ante terceros.
- **FR-005**: El proveedor DEBE recibir únicamente contexto estructural sanitizado: URL permitida, roles/nombres de controles, estados y texto técnico. NO DEBE recibir HTML, valores contables, contenido del reporte, capturas, cookies, tokens ni estado de sesión.
- **FR-006**: La propuesta del proveedor DEBE ser declarativa y validarse contra catálogo, esquema de parámetros, origen, límite y verificador antes de ejecutar una acción local.
- **FR-007**: Cada intervención DEBE limitarse a dos intentos y 90 segundos; al agotarse DEBE derivar la ejecución a revisión humana.
- **FR-008**: Solo el superadmin DEBE administrar proveedores, claves, modelos y políticas globales; el administrador de organización solo DEBE habilitar una política aprobada para su alcance autorizado.
- **FR-009**: Las claves de proveedor DEBEN mantenerse en Vault y solo estar disponibles para el worker autorizado; Kestra y el navegador no DEBEN recibirlas.
- **FR-010**: El sistema DEBE registrar intervención, decisión, paso, intentos, timestamps, resultado y evidencia sanitizada; el detalle y evidencia DEBEN eliminarse a los 90 días, preservando agregados no sensibles.
- **FR-011**: La visibilidad de configuración e intervenciones DEBE respetar RLS y aislamiento multi-tenant; superadmin ve el alcance global y administradores solo su organización.
- **FR-012**: Kestra DEBE recibir exclusivamente eventos JSON sanitizados, sin claves, sesiones, payload de proveedor ni contenido de reportes.

### Key Entities

- **Proveedor de IA**: configuración global y clave segura de un proveedor apto para cero retención.
- **Modelo descubierto**: modelo disponible para una clave de proveedor, con sus capacidades sanitizadas.
- **Política de acción**: versión aprobada de acciones, parámetros, orígenes, contexto y verificadores permitidos para un worker/recorrido.
- **Habilitación organizacional**: permiso de una organización o conexión para usar una política aprobada.
- **Intervención de navegación**: intento acotado asociado a una ejecución, con decisión, límites, resultado y evidencia sanitizada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las propuestas fuera de una política activa se rechaza antes de producir un efecto en el sistema externo.
- **SC-002**: El 100% de las intervenciones registra paso, decisión, intentos, resultado y timestamps sin secretos ni contenido del reporte.
- **SC-003**: El 100% de las intervenciones agotadas o inciertas se deriva a revisión humana en menos de dos minutos.
- **SC-004**: Un worker nuevo puede adoptar la capacidad declarando política y verificadores, sin implementar transporte de claves, sanitización, límites ni auditoría propios.
- **SC-005**: Las pruebas de permisos confirman que un administrador no puede acceder a configuraciones, intervenciones o evidencias de otra organización.

## Assumptions

- Cada worker ya dispone de un mecanismo de sesión y un lock de concurrencia para su conexión.
- La adopción por un producto requiere una spec propia solo si agrega una acción de negocio o un recorrido fuera de su catálogo aprobado.
- Un proveedor no verificable en cero retención y sin entrenamiento queda inhabilitado.
- La primera implementación de producto proveerá los recorridos E2E, pero no forma parte de esta spec del template.
