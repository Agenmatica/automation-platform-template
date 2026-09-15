# Workers

Cada worker futuro vive en su propia carpeta con Dockerfile, contrato de entrada,
salida idempotente, healthcheck y pruebas. No se crea un worker hasta identificar
una automatización concreta que Kestra necesite ejecutar.

## Convención de workers de integración

Cuando la automatización concreta es traer datos de un sistema externo, el worker
sigue la convención de abajo — para que una integración nueva no tenga que
rediseñar desde cero su estructura, su relación con Kestra ni su modelo de datos.

### Runtime

Node.js + TypeScript es el runtime por defecto — ya es el lenguaje del resto del
monorepo (`apps/web`), y comparte tooling (`pnpm lint`/`build`/`test`, el mismo
runner de CI). No es obligatorio: un worker puntual puede usar otro lenguaje si
su carga de trabajo lo justifica (por ejemplo, procesamiento de datos pesado).

### Un worker por sistema externo, un conector por tipo de dato

Un worker se dedica a un único sistema externo. Cuando ese sistema expone más de
un tipo de dato o reporte, cada uno se implementa como un conector propio dentro
del worker — aislado de los demás, sin conocerlos ni depender de ellos. Cada
conector elige su propio método de acceso: API, o automatización de navegador
con Playwright cuando no hay API disponible para ese reporte puntual. La
automatización de navegador reutiliza la infraestructura de Playwright ya
existente en el template (`infra/playwright`), sin requerir una imagen o
servicio nuevo.

### Kestra orquesta, el worker ejecuta

Kestra programa, reintenta y alerta. El worker ejecuta el trabajo técnico:
llamadas a APIs, automatización de navegador, descarga y procesamiento de
archivos, validación e importación. Uno no reemplaza al otro.

### Healthcheck de un worker de ejecución puntual

Un worker de este tipo no queda corriendo esperando requests — Kestra lo
dispara, corre, y termina. Para ese perfil, el healthcheck se cumple con el
código de salida/estado que Kestra ya registra por cada ejecución; no hace
falta un endpoint HTTP separado. Un worker que en cambio sea un servicio
persistente necesita un healthcheck tradicional — ese caso queda fuera de esta
convención.

Si el fallo es una credencial invalida, el worker DEBE escribir en stderr el
marcador `CREDENCIAL_INVALIDA:<conexion_id>` y terminar con error. Kestra usa
esa señal para marcar exclusivamente esa conexión como inválida y alertar a
su organización; cualquier otro error se trata como técnico. `conexion_id` se
recibe como variable de entorno de despacho, nunca contiene una credencial.

### Tabla central: normalizar datos de varias fuentes sin una tabla por sistema

Cuando un worker importa un tipo de registro de negocio que también puede
llegar por otros sistemas externos (otros workers, u otros conectores del
mismo worker), ese tipo de registro se normaliza en una **tabla central** en
vez de crear una tabla por sistema. Cada worker puede tener varias tablas
centrales — una por cada tipo de registro distinto que produzca — y un mismo
conector puede escribir en más de una si el dato que trae mezcla más de un
concepto de negocio.

La tabla central sigue la misma estructura conceptual sin importar el dominio:

- Una columna que identifica la **organización** dueña del registro — como
  cualquier tabla expuesta del template, no es una excepción al aislamiento
  multi-tenant: requiere RLS igual que si las filas las escribiera un usuario
  desde la UI en vez de un worker. La organización de cada registro es la
  dueña de la conexión/credencial que el worker usó en esa ejecución; el
  worker la propaga a cada fila que escribe, no es algo que el conector deba
  inferir de los datos en sí.
- Una columna `origen` que identifica de qué conector/sistema vino el
  registro.
- Una columna `id_externo` con el identificador que el sistema de origen le
  asignó.
- Una columna `jsonb` (por ejemplo `datos_originales`) para los campos
  particulares de cada fuente que no comparten las demás — evita forzar todo
  a una estructura común.

La clave de idempotencia es la combinación **`(organización, origen,
id_externo)`** — los tres campos juntos, nunca `id_externo` solo ni
`origen` + `id_externo` sin la organización: dos organizaciones distintas
pueden conectar cada una su propia cuenta del mismo sistema externo, y cada
una asigna sus propios `id_externo` — pueden coincidir en número sin ser el
mismo dato. Reimportar un período ya procesado no debe generar filas
duplicadas para la misma combinación.

Esto es una convención de diseño, no una estructura de columnas que el
template provea directamente: los nombres de columnas de dominio, los tipos
de datos específicos y la estructura SQL real son responsabilidad de cada
implementación que adapte el patrón a su propio dominio de negocio.

La tabla central vive en su propio esquema de base de datos (`dominio`),
separado del esquema de plataforma (`public`) donde vive el resto del
template — organizaciones, perfiles, membresías, feature flags, backups,
etc. Cada implementación crea sus tablas de dominio ahí, no en `public`;
el template solo habilita el esquema vacío, sin tablas, hasta que una
implementación cree la primera.

La lectura de esas filas importadas queda disponible para cualquier miembro de
la organización, mediante las políticas RLS de la tabla de dominio. No exige
el rol de administrador que sí se necesita para gestionar la conexión que
trajo los datos: `conexiones` y sus credenciales son recursos operativos,
mientras que los datos ya normalizados forman parte del dominio compartido de
la organización.

### Testing de la normalización

Cada conector conserva fixtures JSON del dato crudo que recibe del sistema
externo y los usa en CI para probar la normalización hacia sus tablas
centrales. Las pruebas deben cubrir transformaciones e idempotencia sin
requerir acceso en vivo al sistema externo ni credenciales reales.

La automatización de navegador no busca una cobertura automatizada realista
contra el sistema externo real. Su resultado se controla por el estado y el
código de salida que Kestra registra en cada ejecución; los fixtures cubren la
lógica determinista que sí puede verificarse de manera repetible.

### Fuera de alcance

Esta convención no resuelve procesamiento en tiempo real disparado por eventos
de usuario (colas como Redis/BullMQ) ni un backend HTTP síncrono que sirva a
un frontend. Si una implementación puntual necesita alguna de las dos cosas,
es una decisión propia de esa implementación — no algo que esta convención
cubra ni que deba forzarse dentro de un worker de integración.

### Origen de esta convención

Esta convención no se diseñó de antemano: surge de que al menos dos
automatizaciones de dominios de negocio independientes llegaron al mismo
patrón (runtime, división worker/conector, relación con Kestra, tabla
central) sin coordinación entre sí. Por eso se documenta acá, a nivel de
template, en vez de quedar dentro de una implementación puntual.

### Credenciales de un conector

Un conector necesita credenciales para acceder a su sistema externo (API
keys, una sesión de navegador logueada, u otro secreto equivalente). Esas
credenciales siguen el manejo de secretos ya establecido para el proyecto:
nunca en Git, solo en gestores de variables o vault por entorno (ver
`.env.example` en la raíz y en cada `infra/<producto>/`). Esta convención no
define un mecanismo de almacenamiento nuevo ni específico para conectores.
