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
