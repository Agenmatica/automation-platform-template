# Data Model: UI de IA y corrección de esperando_aprobacion en la base

## Migración (aditiva)

```sql
alter table public.ia_interacciones drop constraint ia_interacciones_estado_check;
alter table public.ia_interacciones add constraint ia_interacciones_estado_check
  check (estado in ('iniciada','preparando','invocando','respuesta_validada','esperando_aprobacion','completada','rechazada','fallida_tecnica','revision_humana','cancelada'));
```

(El nombre real del constraint se confirma en `plan.md`/implementación contra el nombre que Postgres le asignó automáticamente en la migración original.)

`private.registrar_evento_interaccion_ia` gana dos ramas en su tabla de transiciones válidas:

```text
(v_actual = 'respuesta_validada' and p_estado in ('completada','rechazada','revision_humana','esperando_aprobacion'))
(v_actual = 'esperando_aprobacion' and p_estado in ('completada','rechazada'))
```

Ninguna rama existente cambia.

## Componentes de UI (sin entidad de datos nueva)

### `InsigniaEstadoInteraccionIA`

```tsx
function InsigniaEstadoInteraccionIA({ estado }: { estado: EstadoInteraccion }): JSX.Element
```

Mapea los 10 valores a 4 categorías visuales (research.md, Decisión 4):

| Categoría | Estados | Presentación |
|---|---|---|
| En curso | `iniciada`, `preparando`, `invocando` | Indicador de progreso |
| Éxito | `completada` | Color de éxito |
| Necesita acción humana | `esperando_aprobacion`, `revision_humana` | Color de advertencia, distinto de éxito y de error |
| Terminal sin éxito | `rechazada`, `fallida_tecnica`, `cancelada` | Color de error |

### `AccionesResolucionInteraccionIA`

```tsx
function AccionesResolucionInteraccionIA({
  interaccionId,
  estado,
  onResuelto,
}: {
  interaccionId: string
  estado: EstadoInteraccion
  onResuelto: () => void
}): JSX.Element | null
```

Devuelve `null` salvo que `estado` sea `'revision_humana'` o `'esperando_aprobacion'` (FR-005). Cuando se muestra, ofrece las tres acciones (completar/rechazar/cancelar) llamando `resolver_revision_ia` con `interaccionId` y el estado final correspondiente; llama `onResuelto` al terminar para que quien lo use recargue su propia lista.
