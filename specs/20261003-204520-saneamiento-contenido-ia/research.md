# Research: Saneamiento de contenido no confiable para IA

## Decisión 1: delimitador con nonce aleatorio, no una etiqueta de texto fija

**Decision**: la función de marcado envuelve el texto así: `<datos-no-confiables nonce="<uuid>">...contenido...</datos-no-confiables-<uuid>>`, usando `crypto.randomUUID()` (ya usado en el repo, `ia-navegacion/src/intentarRecuperarPaso.ts`) como nonce, distinto en cada llamada.

**Rationale**: investigado el estado del arte 2026 (no asumido): una etiqueta de texto fija (`### USER INPUT ###` o similar) puede ser falsificada por el propio atacante incluyendo esa misma cadena en su contenido, confundiendo dónde termina el dato y dónde "empieza" una instrucción fabricada. Un nonce aleatorio por invocación no es adivinable de antemano por el contenido de la página — el atacante no puede incluir el nonce correcto porque no lo conoce hasta que la invocación ya se armó.

**Alternatives considered**: patrón "dual LLM" (un modelo sin privilegios procesa primero el contenido no confiable, antes de que llegue al modelo que decide acciones) — es la mitigación más fuerte según la misma investigación, pero es un cambio arquitectónico mucho mayor (dos invocaciones, dos políticas, un modelo "sin privilegios" que hoy no existe en el catálogo) sin que ningún consumidor real lo necesite todavía — construirlo ahora sería especulativo. Queda documentado como la evolución futura si algún consumidor real demuestra que el delimitador no alcanza.

**Fuentes**: búsqueda real realizada 2026-10-03 sobre defensas de inyección de prompt vigentes en 2026 — confirma que los delimitadores de texto fijo son falsificables y que el nonce por pedido es la evolución recomendada sobre ese patrón; confirma también que ningún delimitador de texto es garantía absoluta (un modelo puede ser persuadido en lenguaje natural a ignorarlo), consistente con cómo se documenta la limitación en Assumptions de spec.md.

## Decisión 2: declarativo en el contrato, aplicado automáticamente por `prepararInvocacion`

**Decision**: `ContratoConsumidor` gana `clavesNoConfiables?: readonly string[]` (subconjunto de `datosPermitidos`); `prepararInvocacion` aplica el marcado a esas claves después de `sanitizarDato` (que ya filtra por `datosPermitidos`) y antes de devolver la entrada preparada.

**Rationale**: mismo patrón que `claveAislamientoOrganizacion` (contexto-permisos-ia) — declarativo, opt-in, aplicado por el núcleo en vez de depender de que cada consumidor se acuerde de llamar una función de marcado a mano. Es exactamente el tipo de olvido que causó el gap real: `ai-navigation-fallback` nunca marcó nada porque la función ni existía.

**Alternatives considered**: una función de marcado que el consumidor llama manualmente antes de pasar sus datos — rechazada, es la misma clase de olvido que ya se demostró real.

## Decisión 3: señal de activación, sin persistencia propia

**Decision**: `prepararInvocacion` sigue devolviendo la entrada preparada, pero ahora el valor de retorno (o un segundo valor si hace falta) indica si se activó el marcado (boolean o lista de claves marcadas). El consumidor decide si lo incluye en `detalle_sanitizado` al registrar el evento — `packages/ia` no escribe en la base por su cuenta (mismo límite que toda la capacidad hasta ahora).

**Rationale**: coherente con que `packages/ia` es pura, sin acceso a Supabase (packages/ia-navegacion y cualquier consumidor futuro sí tienen ese acceso). `EventoInteraccion.detalle` ya es un `Record<string, unknown>` genérico (precedente de `trazas-costos-evaluaciones-ia`) donde esto encaja sin tabla nueva.

**Alternatives considered**: que `prepararInvocacion` reciba un callback de auditoría — rechazado, agrega una dependencia nueva (inyección de función) para un caso que una señal de retorno simple ya resuelve.
