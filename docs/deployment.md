# Entornos y despliegue

## Desarrollo

Todo corre en la máquina, separado por producto: Refine, Supabase CLI, Kestra
y Superset. Es el entorno diario y no genera costo cloud adicional.

```powershell
pnpm dev:refine
pnpm dev:supabase
pnpm dev:kestra
pnpm dev:superset
```

## Staging económico

- Cada pull request obtiene un Vercel Preview.
- La rama `staging` apunta a un proyecto Supabase Free separado de producción.
- Kestra, Superset y workers usan un segundo proyecto Compose en el mismo VPS,
  sólo cuando hay que probar una integración completa.
- Al terminar la prueba se ejecuta `docker compose -p platform-staging down`.

Staging valida migraciones, permisos, workflows y conexión entre componentes
sin tocar datos reales. Puede mantenerse en costo cero adicional mientras no se
supere el plan gratuito de Vercel/Supabase ni sea necesario ampliar el VPS.

## Producción

- `apps/web`: proyecto Vercel de producción.
- `supabase/`: proyecto Supabase Cloud de producción mediante migraciones.
- `infra/kestra/compose.yaml`: Kestra en el VPS, detrás de HTTPS/reverse proxy.
- `infra/superset/compose.yaml`: Superset en el VPS, detrás de HTTPS/reverse proxy.
- `infra/playwright/compose.yaml`: servidor de Playwright en el VPS, sólo
  accesible para Kestra (no pasa por el reverse proxy, no es público).
- Los workers se agregan como su propio Compose cuando exista un caso concreto.

No se promueven bases copiando datos. Se promueven código, migraciones y
configuración; las credenciales son distintas en cada entorno.

## Servidores de organización

Supabase, Kestra, Refine y Superset siguen siendo instancias centrales
compartidas; cada worker de integración se ejecuta, en cambio, en el
servidor aislado de su organización. El alta de ese servidor es un
procedimiento manual: hoy no requiere ni justifica una herramienta de
aprovisionamiento propia.

1. Preparar el VPS de la organización con Docker y `sshd`. Crear un usuario
   de despacho acotado para Kestra, restringido a la operación del worker;
   no usar una cuenta administrativa general del VPS.
2. Registrar desde la pantalla de superadmin
   `apps/web/src/pages/servidores/create.tsx` la organización, host, puerto
   SSH, usuario y credencial SSH de ese usuario. La llamada
   `private.aprovisionar_servidor_organizacion` crea el rol de base de datos
   `worker_*` limitado a esa organización y guarda tanto la credencial SSH
   como la de base en Supabase Vault.
3. Copiar y almacenar de forma segura la contraseña del rol de base de datos
   que la pantalla muestra una sola vez. No se puede volver a obtener en texto
   plano: queda cifrada en Vault y solo se usa durante el despacho.
4. Verificar el alta con el flujo de prueba de
   `specs/013-orquestacion-multi-organizacion/quickstart.md`: Kestra debe
   conectar por SSH, descargar la imagen del worker desde GHCR y ejecutarla
   en ese VPS, no en la infraestructura central.

### Continuidad tras restaurar un backup

Si se restaura una copia de la base compartida en un proyecto Supabase distinto,
las credenciales cifradas de Vault no son recuperables. La respuesta operativa
aceptada es reconectar cada sistema externo y volver a aprovisionar cada
servidor de organización para generar sus nuevas credenciales SSH y de base.
No se debe intentar copiar ni reconstruir claves de cifrado desde el backup.

## CI

`.github/workflows/validate.yml` corre en un runner self-hosted (no en
`ubuntu-latest`), para no depender de la cuota de minutos de GitHub Actions.
Vive en `infra/runner/` (`pnpm dev:runner` / `pnpm dev:down:runner`), como
cualquier otro producto — un contenedor Docker, no un proceso nativo del
sistema operativo.

La imagen (`infra/runner/Dockerfile`) es genérica: no tiene nada específico
de este proyecto adentro, solo Node/pnpm/Docker CLI/el runner de GitHub. Lo
que ata un contenedor a un repo puntual son las variables de entorno
(`RUNNER_REPO`, `RUNNER_NAME`, `RUNNER_LABELS` en `infra/runner/compose.yaml`
y `GH_RUNNER_PAT` en `.env`) — para reutilizarlo en otro proyecto, se copia
la carpeta tal cual y solo cambia `RUNNER_REPO`.

Usa el mismo patrón Docker-fuera-de-Docker que Kestra (monta
`/var/run/docker.sock`): los `docker compose`/`supabase start` que corren los
jobs terminan controlando el Docker del host, no uno anidado.

Hoy corre en la PC de desarrollo, no en un VPS — cuando exista uno, se migra
sin cambiar nada del Dockerfile, solo dónde se levanta el compose.

Detalle a tener en cuenta: dentro del contenedor del runner, `127.0.0.1` es
el contenedor mismo, no el host — por eso el job `database` usa
`pnpm test:db:ci` (conecta por `host.docker.internal`) en vez de
`pnpm test:db` (que asume `127.0.0.1`, correcto solo para correrlo a mano en
el host). `supabase start` sí funciona igual en los dos casos porque controla
al Docker del host vía el socket montado, no depende de la red del
contenedor.

## Promoción simple

```text
rama de feature → Preview → staging (si hace falta) → main/producción
```

Para cambios sólo visuales se puede omitir el staging completo. Para cambios de
datos, permisos o automatizaciones, staging es obligatorio.

En el VPS, `pnpm deploy:vps -- staging` o `pnpm deploy:vps -- production` despliega Kestra y
Superset como proyectos Docker separados (`platform-<entorno>-kestra` y
`platform-<entorno>-superset`).
