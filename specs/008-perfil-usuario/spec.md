# Feature Specification: Gestión del perfil personal

**Feature Branch**: `008-perfil-usuario`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Gestión del perfil del usuario activo: actualizar nombre, apellido y correo electrónico propio, con cambio de contraseña disponible desde el perfil."

**Delivery scope**: refine | supabase

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar y actualizar datos personales (Priority: P1)

Como persona autenticada, puedo abrir una pantalla independiente de perfil y corregir mi nombre y apellido, para que la aplicación me identifique con datos personales actualizados.

**Why this priority**: Es la información básica de identidad visible y debe poder mantenerse sin intervención de un administrador.

**Independent Test**: Iniciar sesión, abrir el perfil, reemplazar nombre y apellido por valores válidos, guardar, volver a entrar al perfil y comprobar que se conservan los nuevos datos.

**Acceptance Scenarios**:

1. **Given** una persona autenticada, **When** abre desde la pantalla general la pantalla independiente de su perfil, **Then** ve su nombre, apellido, correo electrónico actual y una opción para cambiar su contraseña.
2. **Given** una persona autenticada, **When** guarda un nombre y apellido válidos, **Then** solo sus propios datos personales se actualizan y se confirma el resultado.
3. **Given** una persona autenticada que deja vacío el nombre o el apellido, **When** intenta guardar, **Then** ve una indicación clara y no se actualizan sus datos.
4. **Given** una persona no autenticada, **When** intenta abrir un perfil por cualquier ruta, **Then** es dirigida al acceso y no se exponen datos personales.
5. **Given** una persona autenticada, **When** visualiza la pantalla general, **Then** encuentra una opción identificable para abrir su perfil personal.

---

### User Story 2 - Identificar la sesión activa en la pantalla general (Priority: P1)

Como persona autenticada, puedo ver en la pantalla general con qué cuenta estoy conectada, para confirmar la identidad con la que realizo las acciones de la aplicación.

**Why this priority**: Evita que una persona opere sin advertir que inició sesión con una cuenta distinta de la esperada y hace visible el acceso al perfil personal.

**Independent Test**: Iniciar sesión con una cuenta conocida, abrir la pantalla general y comprobar que se muestra “Logueado como” junto con la identidad de esa cuenta y un acceso al perfil.

**Acceptance Scenarios**:

1. **Given** una persona autenticada, **When** abre la pantalla general, **Then** ve el texto “Logueado como” junto con su nombre y apellido, o su correo electrónico cuando no haya nombre y apellido disponibles.
2. **Given** una persona autenticada, **When** selecciona el indicador o acceso de su identidad en la pantalla general, **Then** llega a su pantalla de perfil personal.
3. **Given** una persona cierra sesión o la sesión deja de ser válida, **When** la aplicación muestra el acceso, **Then** el indicador de identidad deja de mostrarse y no conserva datos de la cuenta anterior.

---

### User Story 3 - Cambiar el correo de acceso (Priority: P2)

Como persona autenticada, puedo solicitar el cambio de mi propio correo electrónico y confirmarlo desde el correo nuevo, para mantener vigente la dirección con la que accedo y recibo comunicaciones de seguridad.

**Why this priority**: El correo es un dato de identidad y un medio de recuperación; modificarlo sin verificaciones podría permitir perder el control de la cuenta.

**Independent Test**: Iniciar sesión, confirmar la contraseña actual, solicitar una dirección nueva disponible, completar la confirmación recibida en esa dirección y verificar que el acceso posterior usa el correo nuevo.

**Acceptance Scenarios**:

1. **Given** una persona autenticada que confirma su contraseña actual, **When** solicita una dirección de correo válida y disponible, **Then** recibe en la nueva dirección un enlace de confirmación y el correo de acceso anterior permanece vigente hasta completarlo.
2. **Given** una persona que abre dentro de la vigencia un enlace de confirmación enviado a la dirección nueva, **When** completa la confirmación, **Then** su correo de acceso cambia a la nueva dirección y recibe un aviso de seguridad en la dirección anterior.
3. **Given** una solicitud de cambio de correo sin contraseña actual válida, **When** la persona la confirma, **Then** el cambio se rechaza y no se envía una confirmación.
4. **Given** una dirección ya asociada a otra cuenta, una dirección inválida o un enlace inválido, vencido o usado, **When** se intenta solicitar o confirmar el cambio, **Then** el correo de acceso no cambia y se muestra un mensaje claro sin exponer datos de otras cuentas.

---

### User Story 4 - Administrar contraseña desde el perfil (Priority: P3)

Como persona autenticada, puedo acceder desde mi perfil al cambio de mi contraseña, para mantener mis credenciales desde un único lugar personal.

**Why this priority**: Completa la administración de identidad personal, reutilizando el flujo seguro de contraseña ya definido para la cuenta.

**Independent Test**: Desde el perfil, abrir el cambio de contraseña, confirmar la contraseña actual, definir una nueva válida y verificar que el flujo cumple los criterios de la especificación de autogestión de contraseña.

**Acceptance Scenarios**:

1. **Given** una persona autenticada, **When** selecciona cambiar su contraseña desde su perfil, **Then** accede al flujo de cambio de contraseña definido para su propia cuenta.
2. **Given** una persona que completa correctamente el cambio iniciado desde su perfil, **When** vuelve a iniciar sesión, **Then** la contraseña nueva funciona y se aplican las protecciones de sesión y avisos definidas para ese flujo.

### Edge Cases

- Guardar datos personales y cambiar el correo son operaciones independientes: un fallo en una no revierte un cambio ya confirmado de la otra.
- Solicitar como correo nuevo la misma dirección que ya está vigente no genera un enlace ni altera la cuenta.
- Mientras el cambio de correo está pendiente, el inicio de sesión, la recuperación de contraseña y las comunicaciones de seguridad continúan usando el correo anterior.
- Un enlace de confirmación de correo vencido, usado o manipulado no cambia ninguna dirección; la persona puede iniciar una nueva solicitud tras validar nuevamente su contraseña.
- Una persona solo puede consultar o actualizar su propio perfil, aun cuando tenga rol de administrador de organización o superadministrador.
- La aplicación no expone contraseñas, enlaces de confirmación ni direcciones de correo de otras personas en mensajes, registros operativos ni auditorías.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE ofrecer a toda persona autenticada una pantalla independiente de perfil personal con su nombre, apellido y correo electrónico vigentes, además de una opción para modificar su propia contraseña.
- **FR-002**: El sistema DEBE permitir a una persona autenticada actualizar únicamente su propio nombre y apellido, exigiendo que ambos tengan contenido válido.
- **FR-003**: El sistema DEBE impedir por interfaz y por controles de acceso que una persona consulte o modifique el perfil de otra.
- **FR-004**: El sistema DEBE exigir la contraseña actual válida antes de aceptar una solicitud de cambio de correo electrónico.
- **FR-005**: El sistema DEBE requerir que la nueva dirección de correo sea válida, distinta de la vigente y no esté asociada a otra cuenta antes de iniciar su confirmación.
- **FR-006**: El sistema DEBE enviar la confirmación del cambio únicamente a la nueva dirección solicitada y conservar el correo anterior como dirección de acceso hasta que la confirmación se complete con un enlace vigente de un solo uso.
- **FR-007**: El sistema DEBE cambiar el correo de acceso solo después de una confirmación válida y enviar un aviso de seguridad al correo que estaba vigente antes del cambio, sin incluir secretos ni enlaces sensibles.
- **FR-008**: El sistema DEBE rechazar sin cambios las confirmaciones de correo inválidas, vencidas o ya utilizadas y las solicitudes con contraseña actual incorrecta, dirección inválida o dirección ya asociada a otra cuenta.
- **FR-009**: El sistema DEBE hacer accesible desde el perfil el flujo de cambio de contraseña definido en la especificación `006-autogestion-contrasena`, sin debilitar sus reglas de contraseña, confirmación de contraseña actual, cierre de otras sesiones ni aviso de seguridad.
- **FR-010**: El sistema DEBE registrar cada cambio efectivo de correo como evento de seguridad con titular, momento y dirección anterior y nueva protegidas de exposición indebida; no debe registrar contraseñas ni enlaces de confirmación en texto legible.
- **FR-011**: El sistema DEBE informar claramente el estado de cada operación: datos personales guardados, confirmación de correo pendiente, correo confirmado, validación fallida o error temporal.
- **FR-012**: El sistema DEBE mostrar en la pantalla general de toda persona autenticada un indicador con el texto “Logueado como” y la identidad de la sesión activa: nombre y apellido cuando estén disponibles, o correo electrónico en caso contrario.
- **FR-013**: El sistema DEBE ofrecer desde la pantalla general un acceso identificable al perfil personal de la sesión activa y no debe conservar ni mostrar la identidad de una sesión anterior tras cerrarla o invalidarla.

### Key Entities

- **Perfil personal**: datos de identidad que pertenecen a una única persona autenticada, incluyendo nombre, apellido y correo electrónico de acceso.
- **Solicitud de cambio de correo**: pedido autenticado de reemplazar la dirección de acceso, que requiere revalidar la contraseña actual y confirmar control de la nueva dirección.
- **Confirmación de correo**: enlace de un solo uso y duración limitada dirigido a la nueva dirección, que habilita el cambio efectivo del correo de acceso.
- **Evento de seguridad de perfil**: registro de un cambio efectivo de correo que permite trazabilidad sin revelar secretos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona autenticada puede localizar y actualizar su nombre y apellido en menos de 2 minutos, sin asistencia de un administrador.
- **SC-002**: Una persona puede completar un cambio de correo confirmado y volver a iniciar sesión con la nueva dirección en menos de 5 minutos desde que inicia la solicitud.
- **SC-003**: El 100 % de los intentos de consultar o modificar perfiles ajenos se rechaza y no expone datos personales de terceros.
- **SC-004**: El 100 % de las solicitudes de cambio de correo sin revalidación de contraseña o sin confirmación válida conserva el correo de acceso anterior.
- **SC-005**: El 100 % de los cambios efectivos de correo genera un aviso de seguridad a la dirección anterior y un evento de trazabilidad, sin incluir secretos.
- **SC-006**: El 100 % de las personas autenticadas puede identificar la cuenta de su sesión activa y acceder a su perfil desde la pantalla general sin navegar por más de una opción.

## Assumptions

- Se reutiliza la identidad por correo y contraseña ya existente; no se incorporan registro público, proveedores externos de acceso ni autenticación multifactor.
- Nombre y apellido son obligatorios para una cuenta activa y se mantienen como datos personales separados.
- El enlace de confirmación de correo aplica la vigencia, uso único y protección contra reenvío definidos por el proveedor de identidad configurado.
- El aviso al correo anterior se envía solo después de que el nuevo correo fue confirmado con éxito; si no se puede entregar, el cambio no se revierte automáticamente.
- El cambio de contraseña ya está dentro de `006-autogestion-contrasena`; esta entrega solo lo incorpora como entrada desde el perfil, sin duplicar su lógica ni ampliar sus requisitos.
- La pantalla general es la primera pantalla que ve una persona tras autenticarse y contiene el indicador “Logueado como” y el acceso al perfil; no se define una ubicación visual específica dentro de ella.
- Quedan fuera de alcance la edición de roles, organización, foto de perfil, preferencias, eliminación de cuenta, historial visible de cambios y modificación de datos por terceros.
