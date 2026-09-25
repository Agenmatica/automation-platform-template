# Contrato operativo de workers

Un worker es un proceso puntual, independiente y ejecutable en un contenedor
Linux `amd64`. Puede correr sobre un host Linux o sobre Windows con un runtime
de contenedores Linux.

## Paquete mínimo

Cada carpeta `workers/<nombre>/` debe declarar `@workers/<nombre>` y los scripts
`build`, `lint`, `test` y `start`. El entrypoint vive en `src/index.ts` y debe
terminar con código cero en éxito y distinto de cero en error.

## Entrada y salida

El worker recibe `ORGANIZACION_ID`, `SISTEMA_EXTERNO`, `CONEXION_ID` y los
parámetros propios del conector. `EJECUCION_ID` se agrega cuando el flow lo
necesita para idempotencia.

Nunca recibe una credencial en la línea de comandos ni en la imagen. El acceso
se resuelve durante el runtime con el mecanismo de Vault existente.

Si la credencial es inválida, stderr solo contiene
`CREDENCIAL_INVALIDA:<conexion_id>`. Los demás errores se sanitizan y no deben
incluir tokens, cookies, archivos ni secretos.

## Red y runtime

La red es deny-by-default. Cada worker documenta los dominios de Supabase, Vault
y del proveedor externo que necesita; cualquier destino adicional debe fallar.
El lanzador aplica usuario no root, límites de CPU/memoria, timeout, filesystem
temporal y capabilities mínimas.

## Publicación

El pipeline descubre workers válidos, construye desde la raíz del monorepo y
publica una imagen por integración. Kestra consume el digest exacto, nunca un
tag mutable como referencia persistida.

## Runtime endurecido

Kestra debe usar `--read-only`, `/tmp` efímero, `--cap-drop=ALL`,
`no-new-privileges`, límites CPU/memoria y la red `worker-deny-by-default`;
nunca monta el socket Docker.

## Observabilidad y evidencia visual

Contrato genérico para workers que automatizan un navegador (u otro proceso
con etapas); lo introdujo la spec
`20260925-133820-observabilidad-workers-navegador`. No define etapas de
negocio: cada producto nombra las suyas.

### Eventos por etapa

Cada cambio de etapa se emite en stdout como una línea JSON:

```json
{"etapa":"sesion","estado":"completada","timestamp":"2026-09-25T13:38:20.000Z","ejecucion":"<id>","mensaje":"Sesión iniciada"}
```

| Campo | Regla |
|---|---|
| `etapa` | `^[a-z][a-z0-9_-]{0,39}$`; nombre libre del producto. `evidencia` está reservada para fallos de captura. |
| `estado` | `iniciada`, `completada`, `fallida` u `omitida`. |
| `timestamp` | ISO-8601 en UTC con `Z`. |
| `ejecucion` | `EJECUCION_ID` si el flow lo envía; si no, `KESTRA_EJECUCION_ID`. |
| `mensaje` | Opcional, hasta 500 caracteres, sanitizado. |

Kestra conserva esas líneas en los logs de la tarea de despacho y las
plantillas publican esos logs como output (`publicar_logs`). La última etapa
`completada` antes de una `fallida` es la última etapa completada. Una línea
que no respeta el formato queda como log común; no rompe la ejecución.

### Sanitización

Ningún evento, log, nombre de archivo ni captura puede contener credenciales,
tokens, cookies, contenido de `localStorage`/`sessionStorage`, encabezados de
autenticación ni URLs con secretos. stderr sigue reservado a errores
sanitizados (`CREDENCIAL_INVALIDA:<conexion_id>` u otro motivo sin secretos);
cualquier escritura en stderr marca la tarea con advertencia.

### Evidencia visual

- `EVIDENCIA_VISUAL` (`false` por defecto) la configura la plataforma por
  entorno en Kestra; el input `evidencia_visual` de las plantillas la
  reemplaza para una ejecución puntual. El despacho la transmite al worker.
- Con evidencia habilitada, el despacho monta una carpeta por ejecución y
  organización en `/evidencia` y envía `EVIDENCIA_DIR=/evidencia`: es la
  única escritura adicional al rootfs de solo lectura. Sin `EVIDENCIA_DIR` o
  con `EVIDENCIA_VISUAL=false`, el worker no captura.
- Se capturan solo hitos (por ejemplo, tras iniciar sesión, antes de una
  descarga o al fallar), nunca por interacción ni por registro procesado, y
  como máximo 50 por despacho. Nombre: `<AAAAMMDDTHHMMSSmmmZ>-<etapa>.png`.
- Las capturas no se toman con campos de credencial visibles y nunca
  contienen ni reemplazan datos de negocio: archivos descargados, datos
  importados y auditoría siguen su propio camino.
- Si una captura falla, el worker emite
  `{"etapa":"evidencia","estado":"fallida",...}` y sigue con el mismo
  resultado de negocio.
- La plataforma publica las capturas como outputs de la ejecución
  (`publicar_evidencia`), las borra del host y las purga al superar
  `EVIDENCIA_RETENCION_DIAS` (30 por defecto) con el flow
  `limpieza-evidencia`. El worker no lee esa variable ni borra evidencia.
