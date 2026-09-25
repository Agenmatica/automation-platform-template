// Validación real de la observabilidad de workers (spec 20260925-133820):
// publica las plantillas en el Kestra local del template, despacha el worker
// fixture por hosts SSH fixture y verifica eventos, logs publicados, capturas
// y limpieza, sin apariciones de la credencial centinela.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildFixtureImages, command, db, docker, fixtureWorkerTag as imagen, localStack, provisionOrganization,
  publish, removeOrganizations, request, start, startSshHost, waitExecution, workerEnv,
} from './e2e-comun.mjs';

const sentinel = 'CENTINELA_OBSERVABILIDAD_NO_PERSISTIR';
const run = crypto.randomUUID();
const containers = ['obs-ssh-x', 'obs-ssh-y'];
const secretNames = ['x', 'y', 'tecnica', 'captura'].map((label) => `fixture-obs-${run}-${label}`);
const namespace = 'platform.orquestacion';

const tarea = (execution, id) => execution.taskRunList?.filter((task) => task.taskId === id) ?? [];
function assert(condition, message) { if (!condition) throw new Error(message); }

async function descargar(ctx, executionId, uri) {
  const response = await fetch(`${ctx.base}/executions/${executionId}/file?path=${encodeURIComponent(uri)}`, { headers: ctx.headers });
  return { status: response.status, body: response.ok ? Buffer.from(await response.arrayBuffer()) : undefined };
}

// Guarda ejecución, logs y archivos publicados como artefactos para la
// búsqueda del centinela, y devuelve la ejecución y sus logs.
async function recolectar(ctx, id, label) {
  const execution = await request(ctx.base, `/executions/${id}`, { method: 'GET' }, ctx.headers);
  const logs = await request(ctx.base, `/logs/${id}`, { method: 'GET' }, ctx.headers);
  await writeFile(path.join(ctx.artifacts, `${label}.exec.json`), JSON.stringify(execution, null, 2));
  await writeFile(path.join(ctx.artifacts, `${label}.logs.json`), JSON.stringify(logs, null, 2));
  const publicados = {};
  for (const task of tarea(execution, 'publicar_logs')) {
    const file = await descargar(ctx, id, task.outputs.uri);
    assert(file.status === 200, `${label}: el archivo de logs publicado no se pudo descargar (${file.status}).`);
    publicados.logs = file.body.toString('utf8');
    await writeFile(path.join(ctx.artifacts, `${label}.logs-publicados.ion`), file.body);
  }
  return { execution, logs, publicados };
}

async function ejecutar(ctx, flowId, inputs, label) {
  const id = await start(ctx.base, namespace, flowId, { imagen, ...inputs }, ctx.headers);
  ctx.ejecuciones.push(id);
  await waitExecution(ctx.base, id, ctx.headers);
  return { id, ...(await recolectar(ctx, id, label)) };
}

function eventos(logs) {
  return logs.map((log) => { try { return JSON.parse(log.message); } catch { return undefined; } })
    .filter((evento) => evento && typeof evento.etapa === 'string' && typeof evento.estado === 'string');
}

function assertLogsPublicados(resultado, label, esperado) {
  const [publicar] = tarea(resultado.execution, 'publicar_logs');
  assert(publicar?.state.current === 'SUCCESS', `${label}: publicar_logs no terminó en SUCCESS.`);
  assert(resultado.publicados.logs?.includes(esperado), `${label}: el archivo de logs publicado no contiene ${esperado}.`);
}

async function escenariosLogs(ctx) {
  console.log('Logs: genérico con dos organizaciones...');
  const exito = await ejecutar(ctx, 'plantilla-generico', { sistema_externo: 'fixture-exito' }, 'logs-generico');
  assert(exito.execution.state.current === 'SUCCESS', `Genérico terminó en ${exito.execution.state.current}.`);
  const fin = eventos(exito.logs).filter((evento) => evento.etapa === 'fin' && evento.estado === 'completada');
  assert(fin.length === 2, `Genérico: se esperaban 2 eventos fin/completada y hubo ${fin.length}.`);
  assert(fin.every((evento) => evento.ejecucion === exito.id && !Number.isNaN(Date.parse(evento.timestamp))), 'Genérico: eventos sin ejecución o timestamp válidos.');
  assertLogsPublicados(exito, 'Genérico', '\\"etapa\\":\\"fin\\"');

  console.log('Logs: dedicado con falla técnica...');
  const tecnica = await ejecutar(ctx, 'plantilla-dedicado', { organizacion_id: ctx.x, sistema_externo: 'fixture-tecnica' }, 'logs-tecnica');
  const [clasificar] = tarea(tecnica.execution, 'clasificar_y_alertar');
  assert(clasificar && !clasificar.outputs?.evaluationResult, 'Dedicado técnica: la clasificación de alertas cambió.');
  const ultima = eventos(tecnica.logs).filter((evento) => evento.estado === 'completada').at(-1);
  assert(ultima?.etapa === 'sesion', `Dedicado técnica: la última etapa completada debía ser sesion y fue ${ultima?.etapa}.`);
  assertLogsPublicados(tecnica, 'Dedicado técnica', '\\"estado\\":\\"fallida\\"');
}

let ctx;
let work;
try {
  work = await mkdtemp(path.join(os.tmpdir(), 'observabilidad-'));
  const stack = await localStack(work);
  ctx = { ...stack, artifacts: path.join(work, 'artifacts'), ejecuciones: [] };
  await mkdir(ctx.artifacts);
  await buildFixtureImages();
  const x = await provisionOrganization(ctx.dbContainer, 'fixture-obs-x', 22061);
  ctx.x = x.id;
  const y = await provisionOrganization(ctx.dbContainer, 'fixture-obs-y', 22062);
  ctx.y = y.id;
  const vaultIds = await Promise.all(secretNames.map(async (name) => (await db(`select vault.create_secret('${sentinel}','${name}');`, ctx.dbContainer))[0]));
  await db(`insert into public.conexiones(organizacion_id,sistema_externo,credencial_vault_id) values ('${ctx.x}','fixture-exito','${vaultIds[0]}'),('${ctx.y}','fixture-exito','${vaultIds[1]}'),('${ctx.x}','fixture-tecnica','${vaultIds[2]}'),('${ctx.x}','fixture-captura-fallida','${vaultIds[3]}');`, ctx.dbContainer);
  const envX = path.join(work, 'x.env'); const envY = path.join(work, 'y.env');
  await writeFile(envX, workerEnv(ctx.x, x.password, ctx.supabasePort)); await writeFile(envY, workerEnv(ctx.y, y.password, ctx.supabasePort));
  await startSshHost('obs-ssh-x', '22061', ctx.publicKey, envX);
  await startSshHost('obs-ssh-y', '22062', ctx.publicKey, envY);
  await publish(ctx.base, 'infra/kestra/flows/plantilla-generico.yml', namespace, 'plantilla-generico', ctx.headers);
  await publish(ctx.base, 'infra/kestra/flows/plantilla-dedicado.yml', namespace, 'plantilla-dedicado', ctx.headers);
  await publish(ctx.base, 'infra/kestra/flows/alertas.yml', 'platform.alertas', 'alertas', ctx.headers);

  await escenariosLogs(ctx);

  await writeFile(path.join(ctx.artifacts, 'kestra-internal-storage.txt'), await docker(['exec', ctx.kestra, 'sh', '-c', `grep -rF -e '${sentinel}' -e '${Buffer.from(sentinel).toString('base64')}' /app/storage /tmp/kestra-wd 2>/dev/null; echo fin-busqueda`]));
  await command('node', ['infra/kestra/test-secretos-orquestacion.mjs', '--artifact-directory', ctx.artifacts], { env: { ...process.env, CREDENCIAL_CENTINELA: sentinel } });
  console.log('OK: observabilidad validada en ejecuciones reales sin apariciones del centinela.');
} finally {
  await Promise.all(containers.map((name) => docker(['rm', '-f', name]).catch(() => undefined)));
  await removeOrganizations(ctx?.dbContainer, [ctx?.x, ctx?.y], secretNames);
  if (work) await rm(work, { recursive: true, force: true });
}
