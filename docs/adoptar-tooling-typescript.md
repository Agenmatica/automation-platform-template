# Adoptar tooling Node/TypeScript en un producto derivado

La Spec 020 reemplaza tooling operativo propio por programas Node ESM. No crea
un backend de aplicación: Refine continúa usando Supabase directamente con RLS;
Kestra coordina y los workers ejecutan integraciones aisladas.

## Inventario del template

| Grupo | Relevo Node | Archivo anterior | Estado |
| --- | --- | --- | --- |
| Render/publicación Kestra | `pnpm kestra:render-flow`, `pnpm kestra:deploy-flow` | `infra/kestra/{renderizar-flow,desplegar-flow}.ps1` | Relevo creado; retiro pendiente |
| CI y VPS | `pnpm db:reset:ci`, `pnpm deploy:vps -- staging` | `scripts/{reset-db-ci,deploy-vps}.sh` | Relevo creado; retiro pendiente |
| IA, secretos y runtime | `infra/{ia,kestra}/*.mjs` | scripts PowerShell correspondientes | Pendiente de migración |
| Entry points/fixtures Docker | — | `infra/**/entrypoint.sh`, fixtures `*.sh` | Excepción técnica: Docker/imagen los invoca internamente; revisar por archivo |

## Adopción incremental

1. Inventariar los scripts propios del producto y separarlos de los que una
   imagen Docker o herramienta de terceros exige internamente.
2. Traer el relevo Node, probarlo con datos locales sin secretos en argumentos,
   y actualizar `package.json`, CI y la guía operativa en el mismo commit.
3. Recién después retirar el archivo anterior. No borrar comandos específicos
   del producto si no hay un equivalente validado.
4. Ejecutar `pnpm lint`, `pnpm build`, `pnpm infra:config` y los tests/flows
   afectados. Una validación de YAML no sustituye una ejecución real de Kestra.

Los valores sensibles se leen únicamente desde el entorno o Vault. Las
herramientas no aceptan credenciales por flags ni imprimen cuerpos de respuesta
que puedan contenerlas.
