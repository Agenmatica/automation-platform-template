# Data Model: Convención de Workers de Integración (Node + Kestra)

Este documento no describe una tabla ni una migración real — no hay base de datos propia de esta feature (ver `plan.md`, Storage: N/A). Describe el **modelo conceptual** que `workers/README.md` debe documentar como patrón, para que cada implementación lo instancie con su propio esquema concreto (Assumptions de `spec.md`).

## Entidad: Worker de integración

Unidad de ejecución técnica que un flow de Kestra dispara.

| Campo conceptual | Descripción |
|---|---|
| Runtime | Node.js + TypeScript por defecto (R2 en `research.md`); otro lenguaje si un caso puntual lo justifica |
| Disparo | Flow de Kestra (schedule o evento) — el worker no se autoprograma |
| Conectores | Uno o más, cada uno aislado (ver Entidad: Conector) |
| Contrato de salida | Idempotente — reintentar una ejecución no duplica efectos |
| Healthcheck | Código de salida/estado registrado por Kestra (R6) — no endpoint HTTP para este perfil de worker |

**Relaciones**: un Worker ejecuta N Conectores; un Worker escribe en 0 o 1 Tabla central (0 si no normaliza multi-fuente, ver Edge Cases de `spec.md`).

## Entidad: Conector

Módulo dentro de un worker responsable de un único sistema externo.

| Campo conceptual | Descripción |
|---|---|
| Sistema externo | Uno por conector — no comparte lógica con otros conectores del mismo worker |
| Método de acceso | API, o automatización de navegador (Playwright, R7) cuando no hay API disponible |
| Credenciales | Gestionadas vía el mecanismo de secretos ya existente en el proyecto (R5) — nunca en Git, nunca en la tabla central |
| Acoplamiento | Ninguno con otros conectores — cambiar el método de acceso de un conector no afecta a los demás (FR-004, SC-004) |
| Contexto de organización | Cada ejecución de un conector corre en nombre de una organización concreta (la dueña de la conexión/credencial usada) — ese contexto es lo que el worker propaga a la Tabla central, no algo que el conector deba inferir por su cuenta. |

**Relación con Tabla central**: cada registro que un conector produce se escribe en la Tabla central marcado con su propio valor de `origen` y con la organización de la conexión que lo originó.

## Entidad: Tabla central (patrón, no esquema)

Patrón de modelo de datos que un worker usa para normalizar registros de múltiples fuentes que representan **un mismo tipo de registro de negocio** (cada tipo de registro es un concepto distinto), en vez de una tabla por sistema externo. Es una tabla de datos real de quien implemente la convención — no una excepción al aislamiento multi-tenant del template (Principio I; FR-011).

**Un worker puede tener varias tablas centrales.** Si los mismos sistemas externos integrados exponen más de un tipo de dato, cada tipo se normaliza en su propia tabla central, no todos juntos en una sola. Un mismo conector puede escribir en más de una tabla central si el sistema que integra expone más de un tipo de dato (FR-004b).

| Columna (conceptual) | Tipo esperado | Regla |
|---|---|---|
| *(referencia a organización)* | FK a la tabla de organizaciones | Identifica qué organización es dueña del registro. Obligatoria — habilita RLS igual que cualquier otra tabla expuesta del template. Parte de la clave compuesta de idempotencia. |
| `origen` | texto/enum corto | Identifica de qué conector/sistema vino el registro. Parte de la clave compuesta de idempotencia. |
| `id_externo` | texto | El identificador que el sistema de origen le asignó al registro. Parte de la clave compuesta de idempotencia — **nunca usado solo, ni junto a `origen` sin la organización** (R4 en `research.md`): dos organizaciones con cuentas distintas del mismo sistema externo pueden compartir el mismo `id_externo` sin ser el mismo dato. |
| *(columnas comunes del dominio)* | según la implementación | Los campos que **todas** las fuentes de ese dominio comparten — definidos por cada spec que la implemente, no por esta convención. |
| *(columna flexible, ej. `datos_originales`)* | `jsonb` | Los campos que una fuente tiene y otra no — evita forzar todo a la estructura común. |

**Regla de unicidad**: la combinación `(organización, origen, id_externo)` identifica un registro de forma única. Un worker que reimporta un período ya procesado no debe generar filas duplicadas para la misma combinación (Acceptance Scenario 3, User Story 2 de `spec.md`).

**RLS**: como cualquier tabla expuesta del template, requiere policy de aislamiento por organización — no hay excepción porque las filas las escriba un worker en vez de un usuario desde la UI.

**Lo que este documento NO define**: nombres de columnas de dominio, tipos de datos específicos del negocio, ni ningún esquema SQL real — eso es explícitamente responsabilidad de cada spec que implemente la convención (FR-005).
