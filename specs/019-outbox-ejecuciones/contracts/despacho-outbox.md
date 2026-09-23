# Contrato: despacho por outbox

La operación de inicio crea ejecución y orden durable cuando el origen requiere
despacho asíncrono. El usuario solo recibe el ID de ejecución.

Kestra reclama un lote limitado de órdenes pendientes o vencidas. Cada fila
contiene únicamente `orden_id`, `ejecucion_id`, `organizacion_id`,
`conexion_id`, `capacidad` y detalle sanitizado. El reclamo es exclusivo y
vence.

Kestra confirma inicio, libera una falla transitoria o agota una orden. El
worker conserva el cierre de ejecución existente. Solo el rol técnico puede
reclamar o confirmar; no viajan secretos, URLs ni logs crudos.
