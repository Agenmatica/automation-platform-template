# Validación del outbox

1. Levantar Supabase y Kestra locales.
2. Crear una solicitud manual autorizada y verificar una ejecución y una orden pendiente.
3. Reclamarla como `kestra_orquestacion`; un reclamo concurrente no la obtiene.
4. Dejar vencer el reclamo y verificar recuperación con intento auditado.
5. Simular agotamiento y verificar estado terminal y error sanitizado.
6. Ejecutar pgTAP, `pnpm infra:config:kestra` y una adopción real antes de retirar el trigger HTTP del producto.
