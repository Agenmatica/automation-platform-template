# Research: Runners locales que no saturan la red ni la memoria

Fuentes: inspección de los runners en marcha del template el 2026-09-25
(`docker exec` sobre `automation-platform-template-runner-dev-runner-*`), el
código de pnpm 11.19.0 instalado en la imagen (`/usr/lib/node_modules/pnpm/dist`)
y pruebas de `docker compose config`.

## R1. Dónde vive hoy el store y por qué cada réplica descarga todo

- **Hallazgo**: en los jobs, `pnpm/action-setup` exporta `PNPM_HOME=/root/setup-pnpm/node_modules/.bin`
  y pnpm usa `$PNPM_HOME/store/v11` como store. Medido: 82 MB, 262 MB y 323 MB
  en las réplicas 1, 2 y 3 — cada una con su copia, dentro de la capa del
  contenedor (se pierde al recrearlo). `/root/.local/share/pnpm/store` solo
  tiene restos de un store `v3` viejo.
- **Decisión**: montar un volumen con nombre en `/pnpm-store` y fijar
  `pnpm_config_store_dir=/pnpm-store` en el entorno del contenedor runner.
- **Por qué**: pnpm 11 lee su configuración de variables `pnpm_config_*`
  (las `npm_config_*` ya no aplican a opciones de pnpm). Probado en el
  contenedor: con `PNPM_HOME` fijado como lo deja `action-setup`,
  `pnpm_config_store_dir=/tmp/b pnpm store path` devuelve `/tmp/b/v11`, o sea
  la variable gana sobre `PNPM_HOME`. El runner de GitHub hereda el entorno del
  contenedor a cada step, así que no hace falta tocar `validate.yml`.
- **Alternativas descartadas**: montar el volumen en `$PNPM_HOME/store`
  (depende de un detalle interno de `action-setup` que puede cambiar);
  `store-dir` en `pnpm-workspace.yaml` (afectaría el desarrollo local fuera
  del runner); `cache: pnpm` de `setup-node` o `actions/cache` (guardan en el
  storage de GitHub — descartado de antemano, ver `docs/ci-self-hosted-storage.md`).

## R2. ¿Es seguro que varias réplicas (y varios repos) usen el mismo store a la vez?

Sí, con dos límites. Verificado en el código de pnpm 11.19.0:

1. **Archivos de contenido** (`files/`): son direccionados por hash. La
   escritura (`writeBufferToCafs` → `writeOrCheck`) crea el archivo con
   `flag: "wx"` (exclusivo); si otro proceso ya lo creó (`EEXIST`) verifica su
   integridad y, si no coincide (por ejemplo, porque el otro todavía estaba
   escribiendo), lo reescribe de forma atómica: archivo temporal + `rename`.
   Dos escritores del mismo archivo escriben los mismos bytes, así que el
   resultado final es siempre el contenido correcto. Además, pnpm verifica la
   integridad del archivo al importarlo en `node_modules`
   (`verify-store-integrity`, activo por defecto) y lo vuelve a bajar si está
   dañado.
2. **Índice** (`index.db`): en pnpm 11 es SQLite en modo `journal_mode=WAL`
   con `busy_timeout=5000`, pensado para varios procesos pnpm a la vez. SQLite
   coordina con locks POSIX y memoria compartida (`index.db-shm`), que
   funcionan entre contenedores porque comparten el kernel del host y el
   volumen es local.
3. **Detalle entre contenedores**: el nombre del temporal usa `pid + threadId`;
   en contenedores distintos dos procesos pueden tener el mismo PID. Solo
   importa si ambos reescriben el mismo archivo a la vez, y aun así escriben
   bytes idénticos: el peor caso es un archivo transitoriamente incompleto que
   la verificación de integridad detecta y reescribe. Riesgo aceptado.

**Límites (documentados en `docs/deployment.md`)**:

- El volumen tiene que ser un volumen local de Docker (o un disco local del
  host Linux). **No** una carpeta de Windows montada ni un sistema de archivos
  de red: ahí los locks de SQLite y el `rename` atómico no son confiables.
- `pnpm store prune` **no** es seguro con instalaciones en curso (borra
  archivos que otra instalación puede estar por enlazar). Se corre a mano con
  todos los runners sin jobs (o detenidos), nunca automático.

**Compartir entre productos**: por defecto el volumen tiene nombre fijo
(`platform-runner-pnpm-store`), igual en todos los productos que adopten la
capacidad, así una dependencia se baja una sola vez por máquina. No amplía la
confianza: los runners ya montan `/var/run/docker.sock` (equivalente a root en
el host) y todos los repositorios son del mismo operador. Quien quiera aislar
un producto fija `RUNNER_PNPM_STORE_VOLUME` con otro nombre.

## R3. Enlaces duros vs. copia

- **Hallazgo**: el directorio de trabajo del job (`/home/runner/_work`) queda
  en la capa del contenedor y el store en otro volumen: son sistemas de
  archivos distintos, así que pnpm no puede usar enlaces duros y
  `package-import-method=auto` cae a copia.
- **Decisión**: aceptar la copia. Copiar desde disco local es mucho más barato
  que descargar por Wi-Fi, y evita tener que mover `_work` a un volumen (que
  además quedaría compartido o habría que declarar uno por réplica, cosa que
  Compose con `replicas` no permite).
- **Medición**: tiempos de instalación de las corridas en `quickstart.md` y en
  el PR.

## R4. Concurrencia de red y reintentos

- **Hallazgo**: pnpm 11 calcula la concurrencia de descarga como
  `min(96, max(workers × 3, 64))` → 64 en esta máquina de 12 núcleos, y
  `maxsockets = network-concurrency × 3`. Con tres réplicas y dos repos, hasta
  ~380 descargas simultáneas sobre el mismo Wi-Fi. `fetch-retries` por
  defecto es 2. El propio pnpm sugiere, ante `ECONNRESET`, bajar
  `network-concurrency` y subir `fetch-retries`.
- **Decisión**: `pnpm_config_network_concurrency=${RUNNER_PNPM_NETWORK_CONCURRENCY:-16}`
  y `pnpm_config_fetch_retries=5` en el entorno del runner.
- **Por qué**: 16 era el valor por defecto de pnpm antes de la heurística por
  núcleos y sigue siendo el fallback interno (`pLimit(networkConcurrency ?? 16)`).
  Con el store compartido la concurrencia solo pesa en instalaciones en frío o
  con dependencias nuevas; el costo de bajarla es poco.
- **Alternativas**: 1 (lo que sugiere pnpm como último recurso: demasiado
  lento en frío); fijarlo en `pnpm-workspace.yaml` (afectaría también a
  instalaciones locales con buena red).

## R5. Tope de memoria por contenedor

- **Medición**: muestreo de `docker stats` cada 2 s sobre las tres réplicas
  del template durante corridas reales del CI (ver tabla abajo).
- **Decisión**: `deploy.resources.limits.memory: ${RUNNER_MEMORY_LIMIT:-<valor>}`
  con el pico observado + ~50 %, redondeado hacia arriba a GiB.
- **Qué cubre y qué no**: limita lo que corre dentro del runner (pnpm, `tsc`,
  `vite build`, `vitest`, `pg_prove`). Los contenedores que un job levanta por
  el socket de Docker (stack de Supabase del CI) corren fuera y no cuentan.
- **Si un job lo supera**: el OOM killer del kernel mata el proceso más
  grande (el del job, no el runner); el step falla con código 137 y el runner
  sigue registrado. Si muriera el runner, `restart: unless-stopped` lo
  levanta y el entrypoint lo vuelve a registrar.

| Réplica | Pico observado | Momento |
|---------|----------------|---------|
| (se completa con la medición del CI) | | |

## R6. Réplicas configurables

- **Decisión**: `deploy.replicas: ${RUNNER_REPLICAS:-3}`.
- **Probado con `docker compose config`**: sin variable → 3; `0` → 0 (válido:
  no levanta runners de ese repo); `abc` → error `failed to cast to expected
  type`; `-1` → error `must be greater than or equal to 0`; tope de memoria
  `xx` → error `invalid size`. Los valores inválidos fallan de forma visible.
- **Cuándo bajarla**: ver `docs/deployment.md`. Con 1 réplica los jobs de un
  PR corren en serie (application → infrastructure → database) y el CI tarda
  más, pero la máquina solo ejecuta un job de ese repo a la vez.

## R7. Publicación como capacidad

- **Decisión**: capacidad nueva `local-ci-runners` 1.0.0 con ruta
  `infra/runner/compose.yaml`, y guía `docs/adoptar-runners-locales.md`.
  `infra/runner/entrypoint.mjs` sigue perteneciendo a
  `portable-typescript-tooling` y no cambia.
- **Por qué nueva y no versión de otra**: ninguna capacidad publicada cubre
  la configuración de los runners; `isolated-ci-database` es la base del CI,
  no el runner.
