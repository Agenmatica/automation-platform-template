# Data Model: Saneamiento de contenido no confiable para IA

Sin entidad de datos nueva — ninguna tabla, ninguna migración. Solo tipos y funciones en `packages/ia/src/`.

## `types.ts`

```ts
export type ContratoConsumidor = {
  // ...campos existentes sin cambio...
  clavesNoConfiables?: readonly string[] // subconjunto de datosPermitidos
}
```

## `sanitizar.ts`

```ts
export function marcarContenidoNoConfiable(texto: string): string
```

Envuelve `texto` con un delimitador de nonce aleatorio (research.md, Decisión 1): `<datos-no-confiables nonce="<uuid>">texto</datos-no-confiables-<uuid>>`, generado con `crypto.randomUUID()` en cada llamada — nunca el mismo nonce dos veces.

```ts
export function clavesActivadas(clavesNoConfiables: readonly string[] | undefined, entrada: Record<string, unknown>): readonly string[]
```

Devuelve el subconjunto de `clavesNoConfiables` que está presente en `entrada` como string (es decir, que de verdad se va a marcar) — la señal de activación para FR-005, sin que `prepararInvocacion` cambie su forma de retorno. Un consumidor que quiere auditar si se activó el marcado llama esto con el mismo contrato y la misma entrada, antes o después de `prepararInvocacion`, sin coste extra ni dependencia nueva.

## `ejecutar.ts`

`prepararInvocacion` gana un paso nuevo, después de `sanitizarDato` y antes de devolver: para cada clave en `contrato.clavesNoConfiables` presente en el resultado sanitizado con valor de tipo string, reemplaza ese valor por `marcarContenidoNoConfiable(valor)` (FR-003, FR-004). La firma y el tipo de retorno no cambian — sigue devolviendo `Record<string, unknown>` (FR-006, cero cambio de comportamiento para quien no declara `clavesNoConfiables`).
