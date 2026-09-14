# Estrategia de producto técnico del template

**Estado:** exploratorio. Este documento orienta decisiones de plataforma; no
es una spec, no compromete fechas y no autoriza implementación. Cada capacidad
aprobada debe tener su propia spec, plan y tareas.

## Objetivo

Permitir crear y operar productos multi-tenant con rapidez, seguridad y
autonomía, sin rediseñar en cada producto la identidad, el aislamiento de
datos, la automatización, la calidad ni —cuando corresponda— las capacidades
de IA.

El éxito no es acumular servicios. El éxito es que un producto nuevo pueda
concentrarse en su dominio y usar una base técnica ya confiable.

## Estado actual

El template ya ofrece una fundación relevante:

- Autenticación, perfiles, organizaciones, membresías y roles.
- Aislamiento multi-tenant mediante RLS y pruebas pgTAP.
- Frontend operativo con Refine y rutas protegidas.
- Servicios independientes para Supabase, Kestra, Superset, Playwright y
runners.
- Migraciones, pruebas web, CI básico, datos seed y despliegue documentado.
- Panel de funcionalidades habilitables por organización, con comportamiento
fail-closed y auditoría.

## Backlog entregado

Estas capacidades ya están implementadas. La prioridad se asigna de forma
retrospectiva para mostrar qué fundamentos habilitan el backlog futuro; no
reemplaza las prioridades históricas de sus specs.


| Prioridad | Categoría       | Capacidad entregada                       | Dependencias                             | Resultado disponible                                                                                                                                                                                 | Estado       |
| --------- | --------------- | ------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| P0        | Infraestructura | Separación local por producto             | Ninguna                                  | Cada componente se levanta con su propio Compose y ciclo de desarrollo; no existe un Compose raíz. [Spec 001](../specs/001-separacion-local-por-producto/spec.md)                                    | Implementado |
| P0        | Fundación       | Template genérico de automatización       | Separación local por producto            | Monorepo reutilizable, convenciones de desarrollo, documentación y despliegues independientes para Refine, Supabase, Kestra, Superset y workers. [Spec 002](../specs/002-plantilla-generica/spec.md) | Implementado |
| P0        | Multi-tenancy   | Organizaciones, roles y RLS               | Fundación genérica                       | Organizaciones, membresía única, roles, contexto seguro y pruebas de aislamiento para datos expuestos. [Spec 003](../specs/003-fundacion-multitenant/spec.md)                                        | Implementado |
| P0        | Multi-tenancy   | Contexto de organización activa           | Organizaciones, roles y RLS              | Un superadmin entra y sale de una organización concreta; la interfaz y las policies operan fail-closed sin contexto activo. [Spec 004](../specs/004-contexto-organizacion-activa/spec.md)            | Implementado |
| P1        | Identidad       | Gestión de miembros                       | Organizaciones y contexto activo         | Administradores y superadmins con contexto pueden invitar, listar, cambiar rol y remover miembros, con auditoría y RLS. [Spec 005](../specs/005-gestion-miembros/spec.md)                            | Implementado |
| P0        | Identidad       | Autogestión de contraseña                 | Supabase Auth y rutas protegidas         | Invitación, definición, recuperación y cambio de contraseña con protecciones de sesión y notificaciones de Auth. [Spec 006](../specs/006-autogestion-contrasena/spec.md)                             | Implementado |
| P1        | Analítica       | Analítica embebida por organización       | Multi-tenancy y Superset                 | Reportes de Superset embebidos con acceso resuelto por organización y sin exponer credenciales de administración al navegador. [Spec 007](../specs/007-analitica-embebida/spec.md)                   | Implementado |
| P1        | Identidad       | Perfil personal y seguridad de cuenta     | Autogestión de contraseña, RLS y Storage | Perfil propio, cambio seguro de correo, fotos aisladas, resumen de cuenta y avisos de seguridad. [Spec 008](../specs/008-perfil-usuario/spec.md)                                                     | Implementado |
| P0        | Plataforma      | Panel de funcionalidades por organización | Multi-tenancy y contexto activo          | Catálogo, habilitación fail-closed por organización, administración de superadmin y auditoría de cambios. [Spec 009](../specs/009-panel-de-funcionalidades/spec.md)                                  | Implementado |
| P1        | Identidad       | Nombre visible entre miembros             | Gestión de miembros y perfil personal    | Nombre y apellido visibles entre miembros de una misma organización (antes solo UUID), con estado explícito si el perfil está incompleto. [Spec 010](../specs/010-nombre-miembros-organizacion/spec.md) | Implementado |
| P0        | Operación       | Backups automáticos de Postgres           | Ninguna                                  | Respaldo diario (o a demanda) de la base completa vía Kestra, con verificación estructural y registro auditable de estado/tamaño/error. Restauración queda fuera de esta entrega (ítem 6 del backlog priorizado). [Spec 011](../specs/011-backups-postgres/spec.md) | Implementado |


 La spec 003 conserva una tarea abierta de comprobación inicial de entorno;
la capacidad funcional está implementada y es dependencia de las specs
posteriores.

## Principios de producto

1. **El template aporta mecanismos; el producto aporta dominio.** El template
 no conoce reuniones, visitantes, facturas ni otras reglas particulares.
2. **Los productos son autónomos.** Un producto derivado conserva sus propios
 datos, secretos, entornos y despliegues; el template no participa en su
 ejecución diaria.
3. **Compartir es una decisión deliberada.** Una mejora vuelve al template solo
 si sirve a más de un dominio sin arrastrar conceptos del producto de origen.
4. **Sin infraestructura o abstracción vacía.** Una capacidad se construye al
 aparecer un caso de uso concreto y verificable.
5. **Seguridad y operación antes que comodidad.** RLS, secretos, recuperación,
 auditoría y pruebas no se reemplazan por revisiones manuales.
6. **La IA propone; las personas controlan.** Las acciones sensibles requieren
 permisos, confirmación humana y trazabilidad.

## Backlog priorizado

### Qué significa cada campo

- **Prioridad:** P0 bloquea trabajo posterior una vez que aparece su
disparador; P1 es la siguiente capacidad de alto valor una vez cubiertos los
P0 (o cuando aparece su propio disparador); P2 es útil pero se activa solo
con el primer caso de uso concreto; P3 se explora más adelante y no debe
generar infraestructura anticipada.
- **Dependencias:** qué otra capacidad de este backlog (o del backlog ya
entregado) tiene que existir antes de poder abrir la spec de esta.
- **Disparador:** el evento de producto real que habilita abrir la spec. Sin
él, el ítem se queda en Exploración sin importar su prioridad.
- **Estado:** todos los ítems siguen en **Exploración** hasta que una
decisión de producto abra su propia spec (ver [Regla para priorizar una
nueva capacidad](#regla-para-priorizar-una-nueva-capacidad)).

### Cómo se ordena la cola

Un backlog real es una única cola, no una tabla separada por tema. El orden
de la tabla siguiente sale de aplicar, en este orden:

0. **El dominio del futuro producto no es una condición de esta cola.**
Ninguna de las 23 capacidades necesita saber qué va a hacer el producto
derivado — todas están diseñadas como mecanismo genérico, sin conocimiento
de dominio (Principio 1; ver también Límites explícitos). No tener un
dominio pensado hoy **no pospone ningún ítem** de esta tabla. Lo único que
sigue siendo una condición real — y aparte del dominio — es el
**Disparador** de cada fila: un evento de un producto derivado real y en
marcha, sea cual sea su dominio. Sin al menos un producto derivado
existiendo, ningún disparador puede ocurrir; esa es la única razón por la
que hoy nada de esta tabla se activa, no la falta de un dominio elegido.
1. **Dependencia primero (restricción dura).** No se puede empezar una
capacidad antes que lo que necesita, y esto manda incluso sobre la
prioridad nominal: *Trazas, costos y evaluaciones* está etiquetada P0 pero
no puede empezar antes que *Auditoría transversal* (P1), porque depende de
ella. No es un error de esta tabla — es una alerta legítima del backlog:
hasta que exista la spec de Auditoría transversal, Trazas y costos no puede
avanzar aunque su prioridad nominal sea mayor.
2. **Prioridad**, entre las capacidades que ya tienen sus dependencias
resueltas.
3. **Valor de negocio**, como desempate dentro de una misma prioridad: se
adelanta lo que desbloquea más capacidades siguientes (por ejemplo,
*Gestión de entornos* se adelanta frente a otros P0 porque de ella dependen
seis capacidades más).

Los "horizontes" (Convertir la base en derivable / Operar con confianza / IA
segura / Bajo demanda) siguen sirviendo como agrupación temática para leer el
detalle de cada capacidad en la sección siguiente, pero **no determinan el
orden de ejecución** — ese orden es el de la tabla de abajo.

### Backlog único (orden de ejecución)

Se agrega una columna que no existía antes: **Tipo de disparador**. Sale
directo del punto 0 de arriba — como el dominio no importa, lo único que
distingue a un ítem de otro es si su disparador va a ocurrir en *cualquier*
producto derivado tarde o temprano (**Inevitable**), o si depende de que
ese producto elija construir esa función en particular, algo que puede no
pasar nunca (**Condicional**). No cambia el orden de la cola (eso lo siguen
dando dependencia, prioridad y valor); ayuda a leer cada fila con la
pregunta correcta: "Inevitable" es "esto va a pasar seguro, en algún
momento"; "Condicional" es "esto pasa *solo si* el producto termina
necesitando justo esta función".

| # | Prioridad | Capacidad | Horizonte | Dependencias | Disparador | Tipo de disparador | Resultado de salida | Estado |
| - | --------- | --------- | --------- | ------------- | ---------- | ------------------- | -------------------- | ------ |
| 1  | P0 | Creador de productos derivados | H1 | Ninguna | Primer producto derivado. | Inevitable | Crear un repo nuevo con nombre, servicios, variables y documentación propios. | Exploración |
| 2  | P0 | Gestión de entornos | H1 | Creador de productos derivados | Primer despliegue de producto. | Inevitable | Contrato claro de variables, secretos, URLs y responsabilidades por entorno. | Exploración |
| 3  | P0 | Seguridad continua | H2 | Ninguna | Antes de producción y de forma continua. | Inevitable | Chequeos automatizados de dependencias, imágenes, secretos y configuración. | Exploración |
| 4  | P0 | Política de datos IA | H3 | Gestión de entornos y seguridad continua | Antes de datos reales en IA. | Condicional (solo si usa IA) | Reglas explícitas de datos permitidos, excluidos y tratamiento de errores. | Exploración |
| 5  | P0 | Versión de origen | H1 | Creador de productos derivados | Primer producto derivado. | Inevitable | Cada producto registra el tag o commit de origen. | Exploración |
| 6  | P0 | Restauración | H2 | Backups (entregado, spec 011) | Antes de operar datos reales. | Inevitable | Restauración verificada en un entorno aislado. | Exploración |
| 7  | P0 | E2E en CI | H2 | Gestión de entornos | Primer flujo crítico de negocio. | Inevitable | Suite Playwright versionada que corre en CI para recorridos críticos. | Exploración |
| 8  | P0 | Monitoreo, alertas y errores | H2 | Gestión de entornos | Primer servicio de producción. | Inevitable | Healthchecks, registro central de errores y alertas ante fallos críticos. | Exploración |
| 9  | P0 | Gateway IA | H3 | Política de datos IA y gestión de entornos | Primera llamada a un modelo. | Condicional (solo si usa IA) | Backend único que aplica autenticación, límites y configuración de proveedor. | Exploración |
| 10 | P0 | Contexto y permisos IA | H3 | Gateway IA y RLS existente | Primera consulta IA sobre datos internos. | Condicional (solo si usa IA) | Cada ejecución recibe identidad, organización y alcance autorizados. | Exploración |
| 11 | P1 | Contratos de integración | H1 | Gestión de entornos | Primera integración nueva entre componentes. | Condicional (solo si integra componentes) | Convención documentada de autenticación, payloads, errores y versionado. | Exploración |
| 12 | P1 | Auditoría transversal | H2 | Contratos de integración | Primera operación sensible que cruce componentes. | Condicional (solo si hay operación sensible cruzando componentes) | Actor, organización, acción, resultado y momento consultables de forma uniforme. | Exploración |
| 13 | P0 | Trazas, costos y evaluaciones | H3 | Gateway IA y auditoría transversal | Primera capacidad IA en uso. | Condicional (solo si usa IA) | Registro de modelo, costo, fuentes, herramientas y casos de evaluación versionados. | Exploración |
| 14 | P1 | Adopción selectiva de mejoras | H1 | Versión de origen | Primera mejora que deba volver a un producto derivado. | Condicional (solo si vuelve una mejora) | Guía para incorporar commits o paquetes de forma deliberada. | Exploración |
| 15 | P1 | Herramientas IA | H3 | Contexto y permisos IA; contratos de integración | Primera herramienta conectada al modelo. | Condicional (solo si usa IA) | Herramientas con contratos, permisos y validación de entradas/salidas. | Exploración |
| 16 | P1 | Aprobación humana | H3 | Herramientas IA y auditoría transversal | Primera acción con efecto externo o persistente. | Condicional (solo si hay acción automatizada con efecto externo) | Flujo propuesta → revisión → aprobación/rechazo → ejecución auditable. | Exploración |
| 17 | P2 | Archivos y documentos | H2 | Gestión de entornos | Primer producto que gestione documentos. | Condicional (solo si gestiona documentos) | Carga, acceso, retención y eliminación por organización con permisos explícitos. | Exploración |
| 18 | P2 | Notificaciones | H2 | Auditoría transversal | Primera notificación fuera de Auth. | Condicional (solo si notifica algo fuera de Auth) | Interfaz común para solicitar avisos; contenido y destinatarios siguen siendo del producto. | Exploración |
| 19 | P2 | Ejecuciones durables | H3 | Gateway IA y patrón Kestra existente | Primera tarea IA de larga duración. | Condicional (solo si usa IA) | Estados, reintentos y resultados sobre Kestra o workers. | Exploración |
| 20 | P2 | UI de IA | H4 | Gateway IA; trazas y costos IA | Una capacidad IA necesita mostrar progreso, fuentes o aprobación. | Condicional (solo si usa IA) | Piezas visuales reutilizables: estado de generación, progreso, fuentes y aprobación de propuestas. | Exploración |
| 21 | P2 | Búsqueda documental/RAG | H4 | Archivos y documentos; contexto y permisos IA | Un producto necesita responder sobre documentos propios. | Condicional (documentos + IA) | Ingesta, indexación, búsqueda, permisos y referencias a las fuentes. | Exploración |
| 22 | P3 | Paquetes compartidos | H4 | Dos productos reutilizando código estable | Dos o más productos usan la misma interfaz de código. | Condicional (requiere un segundo producto) | Paquete versionado, con pruebas y compatibilidad explícita entre productos. | Exploración |
| 23 | P3 | gRPC interno | H4 | Varios workers especializados y contratos definidos | Hay necesidad real de alto volumen o streaming. | Condicional (solo con volumen/streaming real) | Contratos fuertes y streaming entre workers especializados. | Exploración |

H1 = Convertir la base en derivable · H2 = Operar un producto con confianza ·
H3 = Capacidad AI-first segura · H4 = Capacidades activadas por demanda.

8 de los 24 ítems son **Inevitables**: en cuanto exista un primer producto
derivado y avance por su ciclo de vida normal (creado → desplegado → en
producción con datos reales), los va a cruzar sin importar a qué se dedique.
Los otros 16 son **Condicionales**: dependen de que ese producto elija
construir justo esa función (IA, documentos, integraciones, notificaciones,
un segundo producto) — pueden tardar mucho más o no llegar a activarse
nunca. Ninguna de las dos categorías necesita saber el dominio de antemano;
la diferencia es si la función en sí va a existir.

> **Horizonte 3 no se abre solo porque llegó su turno en la cola.** Empieza
> únicamente cuando exista una funcionalidad de IA concreta que lo dispare —
> no con un chatbot genérico. Si ese disparador no aparece, los ítems 5, 10,
> 11, 14, 16, 17 y 20 se saltan y la cola sigue por el siguiente ítem
> disponible (por ejemplo, el 12, 15, 18 o 19, que no dependen de IA).

## Límites explícitos

No se incorporan al template por sí mismos:

- Reglas, tablas, dashboards, prompts o flujos propios de un producto.
- Datos reales, secretos, proveedores configurados o destinos de alertas de un
producto.
- RAG, bases vectoriales, gRPC, microservicios o paquetes solo porque podrían
ser útiles en el futuro.
- Un chat genérico sin un trabajo concreto que resolver.

## Regla para priorizar una nueva capacidad

Antes de abrir una spec, responder:

1. ¿Qué problema real resuelve y para quién?
2. ¿Es reutilizable sin conocer el dominio de un producto?
3. ¿Qué producto o flujo concreto la activa ahora?
4. ¿Qué riesgo reduce o qué resultado medible habilita?
5. ¿Podemos resolverlo con lo que ya existe antes de agregar infraestructura?

Si no hay respuestas claras, la capacidad permanece en exploración.

## Indicadores de que la estrategia funciona

- Un producto derivado arranca con configuración propia sin copiar secretos ni
editar nombres manualmente en muchos archivos.
- Los cambios genéricos se pueden adoptar selectivamente sin bloquear al
producto.
- Los flujos críticos se prueban de punta a punta y los datos se pueden
recuperar.
- Una capacidad IA puede explicar qué datos usó, qué propuso, quién aprobó y
qué costo tuvo.

## Detalle de capacidades

Esta sección describe el alcance esperado de cada capacidad. El detalle ayuda
a convertir una capacidad elegida en una spec concreta, pero no reemplaza esa
spec.

### Horizonte 1 — Base derivable

#### Creador de productos derivados

Debe iniciar un repositorio nuevo desde el template sin dejar referencias al
nombre, dominio, proyecto Docker o configuración de otro producto. Puede ser
un script interactivo, un generador o una guía ejecutable. Debe generar los
archivos de variables de ejemplo, actualizar nombres de Compose y dejar una
lista explícita de recursos externos a crear.

No debe crear proveedores cloud reales, secretos reales ni tablas del dominio
del producto. Su resultado es un repositorio independiente, listo para abrir
la primera spec de negocio.

#### Versión de origen

Debe registrar un tag o commit exacto del template al crear un producto. Esto
no requiere un servicio nuevo: puede ser un archivo de metadatos y una etiqueta
Git. Sirve para responder "¿de qué base nació este producto?" cuando haya que
evaluar una mejora posterior.

#### Adopción selectiva de mejoras

Debe documentar cuándo una mejora vuelve al template y cómo un producto la
adopta: normalmente mediante commits seleccionados o, más adelante, paquetes
versionados. Debe incluir verificación posterior y el criterio para no traer
cambios que dependan de un dominio ajeno.

Ejemplo: una mejora genérica de auditoría puede incorporarse al template y
llevarse después a un producto. Una tabla de visitantes de BNI no.

#### Gestión de entornos

Debe definir qué configuración pertenece a local, staging y producción; dónde
vive cada secreto; quién la carga; y cómo se valida antes de desplegar. El
template puede aportar `.env.example`, validadores y convenciones de nombres.

No debe guardar secretos ni intentar compartirlos entre productos. Cada
producto tiene sus propios proyectos Supabase, URLs, claves y destinos.

#### Contratos de integración

Debe definir una convención común para integraciones entre componentes: quién
llama a quién, cómo se autentica, qué payload acepta, qué respuesta devuelve,
qué errores puede producir y cómo se versiona. Puede empezar como contratos
Markdown y esquemas TypeScript/JSON, sin introducir gRPC ni un gateway nuevo.

Ejemplo: una Edge Function que dispara un flujo Kestra debe tener un contrato
que indique input, permisos requeridos, identificador de ejecución y errores
posibles.

### Horizonte 2 — Operación confiable

#### Backups y restauración

Debe definir qué se respalda, con qué frecuencia, durante cuánto tiempo y en
qué ubicación separada del entorno activo. Incluye Supabase y, cuando tengan
datos propios relevantes, las bases de metadatos de Kestra y Superset.

La restauración es parte de la capacidad: se debe poder recuperar un entorno
aislado desde una copia y comprobar integridad. Un backup no probado no cuenta
como recuperación disponible.

#### Monitoreo, alertas y errores

Debe distinguir tres cosas: salud de servicios (está vivo), errores técnicos
(por qué falló) y alertas operativas (quién debe enterarse). El template aporta
healthchecks, formato de eventos y una integración repetible; cada producto
elige sus destinos y umbrales.

Ejemplo: una caída de Kestra genera una alerta; un flujo fallido conserva su
log y un enlace a la ejecución; una excepción web queda agrupada en el registro
de errores del producto.

#### Auditoría transversal

Debe producir eventos consistentes para acciones importantes que cruzan
componentes: actor, organización, acción, recurso afectado, resultado y fecha.
No pretende registrar cada lectura ni reemplazar los logs técnicos.

Ejemplo: una persona aprueba una acción propuesta por IA; el evento conserva
quién aprobó, qué ejecución aprobó y qué flujo se inició, sin guardar secretos
ni el contenido innecesario.

#### Notificaciones

Debe ofrecer una forma común de solicitar un aviso y conocer su resultado:
pendiente, enviado, fallido o reintentado. La interfaz no decide el mensaje de
negocio; ese contenido, el canal y el destinatario los define cada producto.

Puede comenzar con email y notificaciones dentro de la aplicación. WhatsApp,
Slack u otros proveedores solo se incorporan al existir un caso de uso y una
autorización para ellos.

#### Archivos y documentos

Debe extender el uso puntual de Storage hacia un patrón de archivos: propietario
u organización, tipo, tamaño, estado, permisos, retención y eliminación. Debe
mantener RLS y no exponer URLs públicas cuando el archivo sea privado.

No define "contratos", "facturas" o "actas"; cada producto agrega esos vínculos
de dominio sobre el mecanismo general.

#### E2E en CI

Debe convertir Playwright de infraestructura disponible a pruebas ejecutables
en CI. La base debe definir cómo levantar servicios, crear datos efímeros,
ejecutar el navegador, obtener evidencias y limpiar el entorno.

Cada producto escribe sus recorridos críticos. Por ejemplo, BNI probaría un
visitante y su seguimiento; el template no incluye ese escenario.

#### Seguridad continua

Debe automatizar controles repetibles antes de liberar cambios: dependencias
con vulnerabilidades conocidas, secretos commiteados, imágenes Docker
desactualizadas o configuración insegura. Los hallazgos deben ser visibles y
tener un criterio claro para bloquear o advertir.

No reemplaza la revisión de RLS, las pruebas ni el diseño de cada feature; los
complementa.

### Horizonte 3 — IA segura

#### Gateway IA

Debe ser el único punto desde el cual los productos llaman a modelos. Recibe
una solicitud autenticada, aplica límites y reglas, obtiene las credenciales
del servidor y devuelve o programa el resultado. Así las claves de proveedores
nunca llegan al navegador y se puede cambiar proveedor sin reescribir pantallas.

No implica un chatbot: puede atender una operación concreta, como resumir una
nota o extraer campos de un archivo.

#### Contexto y permisos IA

Debe derivar el usuario y la organización desde la sesión y los permisos
existentes, nunca desde valores enviados libremente por el navegador o el
prompt. Las herramientas de IA deben respetar el mismo aislamiento que RLS.

Ejemplo: una consulta sobre miembros solo puede recibir datos de la
organización efectiva de quien la inició.

#### Ejecuciones durables

Debe modelar tareas que no conviene mantener abiertas en HTTP: pendiente,
procesando, completada, fallida y cancelada cuando corresponda. Kestra coordina
el trabajo y workers ejecutan tareas especializadas si hicieran falta.

Ejemplo: analizar una hora de audio puede devolver un identificador de
ejecución; la interfaz muestra progreso y obtiene el resultado más tarde.

#### Herramientas IA

Debe registrar funciones explícitas que el modelo puede usar, con schema de
entrada, schema de salida, permisos y validación. El modelo no recibe acceso
directo a la base ni la capacidad de ejecutar SQL arbitrario.

Ejemplo: `listar_tareas_pendientes` puede devolver datos autorizados; una
herramienta para crear recordatorios puede requerir aprobación posterior.

#### Aprobación humana

Debe separar una recomendación de una acción efectiva. La IA deja una propuesta
visible; una persona autorizada la aprueba, ajusta o rechaza; y recién entonces
se inicia la escritura o el flujo externo.

No hace falta para una respuesta meramente informativa. Sí para crear registros,
enviar mensajes, modificar datos o llamar servicios externos.

#### Trazas, costos y evaluaciones

Debe registrar modelo, versión de prompt, tiempo, costo estimado, fuentes y
herramientas usadas. También debe mantener casos de evaluación para comprobar
que un cambio de modelo o prompt no empeore comportamientos importantes.

No debe guardar por defecto datos sensibles completos en logs. La política de
retención y redacción forma parte del diseño de la feature.

#### Política de datos IA

Debe clasificar qué puede enviarse a un proveedor, qué requiere minimización o
anonimización y qué nunca puede salir del entorno. También debe definir cómo se
informa a usuarios y cómo se retienen solicitudes y resultados.

La política es genérica; cada producto puede endurecerla según su dominio o
regulación.

### Horizonte 4 — Bajo demanda

#### Búsqueda documental/RAG

Tiene sentido cuando un producto posee documentos y necesita responder usando
su contenido. Incluye ingesta, extracción de texto, indexación, búsqueda,
permisos y referencias a las fuentes. No se crea una base vectorial vacía ni se
indexan archivos sin una pregunta real que resolver.

#### UI de IA

El template puede proveer piezas visuales reutilizables: estado de generación,
progreso, fuentes, revisión de propuestas y botones de aprobación. Cada
producto define la conversación, las pantallas y el lenguaje propio de su
dominio.

#### Paquetes compartidos

Se crean cuando dos o más productos usan código estable con la misma interfaz.
El paquete debe tener versión, pruebas y compatibilidad explícita. Antes de
eso, una mejora puede viajar como commit seleccionado desde el template.

#### gRPC interno

Solo tiene sentido entre varios workers especializados que necesitan contratos
fuertes, streaming o volumen elevado. No se usa para el navegador, Supabase ni
Kestra sin un problema técnico que HTTP, colas o scripts no resuelvan.
