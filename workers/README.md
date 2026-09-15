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
