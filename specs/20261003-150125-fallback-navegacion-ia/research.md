# Research: Fallback de navegación asistido por IA

## Decisión 1: paquete nuevo, no extensión de `packages/ia`

**Decision**: crear `packages/ia-navegacion` como paquete propio en el workspace, con `@platform/ia` como dependencia declarada (no un `peerDependency` ni código copiado).

**Rationale**: `packages/ia` es el núcleo de gobernanza (proveedores, políticas, presupuesto, interacción, purga) y ya está mergeado con su propio contrato (`016-capacidad-ia-gobernada`). El contrato de "paso recuperable / acción permitida / verificador / checkpoint" es un concepto distinto — navegación, no gobernanza de IA — y mezclarlo en el mismo paquete acoplaría dos razones de cambio diferentes. Mantenerlo separado también deja `packages/ia` libre para que cualquier otro consumidor (sin navegador) lo use sin cargar tipos de Playwright.

**Alternatives considered**: agregar un módulo `navegacion.ts` dentro de `packages/ia` — rechazado porque introduciría una dependencia de tipos de Playwright en un paquete que hoy es agnóstico de runtime; ponerlo directo en `workers/` — rechazado porque no hay todavía un worker consumidor real en este repo (la adopción de negocio es una spec de producto futura, fuera de este alcance) y una capacidad de plataforma reutilizable no debe nacer dentro de un worker concreto.

## Decisión 2: una acción propuesta, una verificación, sin reintento interno tras rechazo

**Decision**: cada invocación del mecanismo ejecuta como máximo una acción propuesta por IA y una verificación. Un verificador que no confirma éxito (o que lanza) termina esa invocación de inmediato devolviendo el control al consumidor; el mecanismo no vuelve a proponer una segunda acción dentro de la misma invocación.

**Rationale**: se verificó el código real de `packages/ia` (`interacciones.ts::registrarFallo`) y su documentación (`README.md`): un fallo de tipo `'contrato'` o `'verificador'` transiciona de inmediato a `'rechazada'` sin pasar por el camino de fallback — "Un incumplimiento de contrato o verificador se rechaza sin fallback". El presupuesto de intentos/tiempo de la política (`limiteIntentos`, `limiteSegundos`) gobierna únicamente la resiliencia técnica entre el perfil de modelo principal y el de fallback (`perfilParaFalloTecnico`) ante timeout, error técnico o respuesta inválida — nunca un segundo intento tras un rechazo de verificador. La spec original asumía lo contrario (múltiples acciones dentro del mismo presupuesto) y se corrigió durante este research para no construir un comportamiento que el núcleo ya mergeado no soporta y que, de todos modos, sería menos seguro (no limitar los intentos de la IA sobre una página real).

**Alternatives considered**: extender `packages/ia` para que un `'verificador'` también sea elegible para fallback — rechazado: cambiaría el comportamiento de un contrato ya mergeado y usado por otros consumidores potenciales, fuera del alcance de esta spec; mantener un contador de intentos propio en esta capa, llamando a `validarPresupuesto` en un loop externo con múltiples interacciones — rechazado porque reintroduce exactamente el comportamiento que el núcleo decidió no ofrecer, solo que por la puerta de atrás.

## Decisión 3: la capa es una función pura, sin persistencia ni tabla propia

**Decision**: `packages/ia-navegacion` no agrega ninguna migración de Supabase ni tabla propia. Toda persistencia de interacción, política y auditoría ya vive en `capacidad-ia-gobernada`; esta capa solo orquesta llamadas a `packages/ia` y al adaptador de navegador que el consumidor le pasa.

**Rationale**: consistente con el Principio V de la constitución (simplicidad operativa: no agregar infraestructura sin caso de uso) y con FR-010/FR-011 de la spec (no agrega canal de auditoría ni observabilidad propio). El `Delivery scope` de la spec es `workers | kestra`, no `supabase`.

**Alternatives considered**: ninguna evaluada seriamente — agregar persistencia propia contradiría directamente FR-010.

## Decisión 4: contrato de "acción permitida" como unión discriminada cerrada, no texto libre

**Decision**: el vocabulario de acciones permitidas se expresa como un conjunto fijo de formas de acción genéricas de navegador (p. ej. completar un campo, esperar un elemento, hacer clic en un elemento ya localizado por el consumidor, confirmar una descarga/operación en curso), cada una con sus propios campos tipados — no como una cadena de texto libre ni código ejecutable.

**Rationale**: FR-003 exige que toda acción propuesta por la IA pertenezca a un vocabulario explícito y se rechace si no pertenece. Una unión discriminada cerrada permite validar estructuralmente (sin necesidad de un sandbox de ejecución de código) que la propuesta de la IA es una de las formas permitidas antes de interpretarla, y permite que la sanitización de `packages/ia` (`sanitizarDato`) filtre por las claves declaradas en `datosPermitidos` del contrato del consumidor.

**Alternatives considered**: dejar que el consumidor registre funciones arbitrarias ejecutables como "acciones" — rechazado, equivale a ejecución de código arbitrario propuesto por IA, exactamente lo que FR-003 prohíbe.

## Decisión 5: gap de CI preexistente en `packages/ia`, corregido en el mismo cambio

**Decision**: los tests de `packages/ia` (`vitest run`) no están conectados a ningún script de la raíz del repo ni al workflow `validate.yml` — se descubrió que `pnpm test`, `pnpm build` y `pnpm lint` en la raíz solo apuntan a `@platform/web`. Este cambio agrega un script `test:ia` en la raíz que corre `pnpm --filter @platform/ia --filter @platform/ia-navegacion test`, lo encadena desde `pnpm test`, y agrega el paso correspondiente a `validate.yml`.

**Rationale**: sin esta corrección, los tests reales de esta nueva capacidad (y los ya existentes de `packages/ia`) nunca se ejecutarían en CI, violando la puerta de calidad de la constitución ("Toda entrega debe... pasar los tests"). Es una corrección mínima y necesaria para que esta misma entrega sea verificable, no una ampliación de alcance.

**Alternatives considered**: dejar el gap para una spec separada — rechazado, porque entonces esta propia entrega quedaría sin verificación real en CI, que es exactamente la garantía que la constitución exige para toda entrega.
