---
name: revision-pr
description: Revisa un PR o un diff de esta plataforma contra su spec de Spec Kit, las reglas del proyecto y la evidencia de que funciona. Úsala antes de mergear un PR, al revisar el trabajo de otro agente o cuando pidan "revisá esta rama". Enruta a las skills de seguridad según lo que toque el diff.
---

# Revisión de PR

Revisás para encontrar por qué el PR **no** debería mergearse, no para confirmar que está bien. Un PR sin hallazgos es un resultado válido; un hallazgo sin escenario concreto de falla, no.

## 1. Fijar el diff

- Base: la que indiquen; si no, `main`. Diff con `git diff <base>...HEAD` (tres puntos) y commits con `git log <base>..HEAD --oneline`.
- Si es un PR de GitHub: `gh pr view <n> --json title,body,headRefName,files,statusCheckRollup`.
- Cortá acá si la base no resuelve o el diff está vacío.

## 2. Juntar las fuentes

- **Spec**: `specs/<carpeta>/` que corresponda a la rama o al PR (`spec.md`, `plan.md`, `tasks.md` y sus notas de desvío). Si no hay spec y el cambio es de negocio, eso ya es un hallazgo (constitución, principio II).
- **Reglas**: `CLAUDE.md`, `AGENTS.md`, `.specify/memory/constitution.md` y, si existe, `docs/revision-reglas-producto.md` (propio de cada producto derivado; el template no lo trae).
- **Excepciones aprendidas**: la sección del final de esta skill y la del archivo de reglas del producto.

## 3. Tres ejes, revisados por separado

Si el diff es grande, corré cada eje en un sub-agente propio para que no se contaminen; si es chico, hacelos en secuencia. No mezcles ni reordenes hallazgos entre ejes.

### Spec
- Requisitos o tareas pedidos que faltan o quedaron a medias; tareas marcadas `[X]` sin código que las respalde.
- Comportamiento que la spec no pidió (alcance de más).
- Requisitos que parecen implementados pero están mal. Citá la línea de la spec.

### Reglas del proyecto
Checklist de plataforma (hard, salvo excepción aprendida):
- Migraciones en `supabase/migrations`, aditivas o con reversión documentada en la spec; nada que destruya lo creado en el mismo PR.
- RLS en toda tabla expuesta, con prueba pgTAP del aislamiento; nunca la service-role key en el navegador.
- Sin secretos en git; solo `.env.example` actualizado.
- Frontend en `apps/web`, procesos en `workers/`, Compose por producto en `infra/<producto>/compose.yaml`, nunca uno raíz.
- Commits, ramas y slugs de spec en castellano; PR contra `main` que se cierra con merge commit.
- Documentación en el mismo cambio (`pnpm docs:check`).
- En un producto derivado: si es un mecanismo de plataforma sin lógica de negocio, ¿debería haber ido al template?
- Las reglas de `docs/revision-reglas-producto.md`, si existe.

Heurística secundaria (juicio, nunca hard, y la regla del repo gana): nombres que no dicen lo que hacen, lógica duplicada, abstracciones que la spec no necesita, un archivo cambiado por motivos no relacionados.

### Evidencia
Leer el diff no prueba que funcione. Exigí:
- CI verde en el último commit (no en uno anterior).
- Pruebas nuevas o ajustadas para el comportamiento cambiado, en la capa correcta (ver `pruebas-plataforma`).
- Si toca SQL o resolvió conflictos en SQL: validado sobre una base limpia (el CI aplica todo desde cero; la base local no).
- Si toca workers, Kestra o UI: una corrida real que entre por el mismo camino que el usuario (UI → outbox → despacho), no disparando el flow o el worker directo.
- Pasos de despliegue post-merge identificados: mergear no publica flows ni reconstruye imágenes.

## 4. Especialistas según el diff

Cargá solo la que aplique:
- `supabase/migrations`, RLS, RPC → `authz-security`
- `.github/workflows` → `ci-cd-security`
- `infra/`, Dockerfiles, Compose → `infra-security`
- secretos, tokens, cifrado → `crypto-secrets`
- dependencias nuevas o cambiadas → `supply-chain-security`

## 5. Verificar antes de reportar

Para cada hallazgo candidato, intentá refutarlo contra el código real (leé el archivo, no solo el hunk). Queda solo si podés escribir: **entrada o estado concreto → resultado incorrecto**. Lo demás se descarta.

Si podés elegir, que revise un modelo distinto del que escribió el código: comparten puntos ciegos.

## 6. Reporte

Por eje, hallazgos ordenados por gravedad (bloqueante / importante / menor), cada uno con archivo:línea, la regla o línea de spec que incumple y el escenario de falla. Cerrá con un veredicto: **mergeable**, **mergeable con cambios menores** o **no mergeable**, y qué falta para cambiarlo.

## Excepciones aprendidas

Cuando el responsable rechaza un hallazgo con un motivo válido, anotalo acá (o en el archivo de reglas del producto si es propio del producto) en una línea, para no volver a marcarlo:

- (ninguna todavía)
