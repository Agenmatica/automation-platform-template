import { execFile, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const tag = 'automation-platform-template/spec014-fixture-worker:local';
const sshImage = 'automation-platform-template/spec014-fixture-ssh:local';
const sentinel = 'CENTINELA_014_NO_PERSISTIR';
const containers = ['spec014-ssh-x', 'spec014-ssh-y'];
const secretNames = ['fixture-014-x', 'fixture-014-y', 'fixture-014-tecnica', 'fixture-014-credencial'];

async function command(file, args, options = {}) {
  try {
    return await execFileAsync(file, args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...options });
  } catch (error) {
    const detail = typeof error.stderr === 'string' ? error.stderr.trim() : '';
    throw new Error(`${file} terminó con código ${error.code ?? 'desconocido'}${detail ? `: ${detail}` : ''}`);
  }
}

async function docker(args, options) { return (await command('docker', args, options)).stdout.trim(); }
async function compose(args, options) { return (await docker(['compose', '-f', 'infra/kestra/compose.yaml', ...args], options)).trim(); }
async function commandWithInput(file, args, input) {
  return await new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`${file} terminó con código ${code ?? 'desconocido'}${stderr.trim() ? `: ${stderr.trim()}` : ''}`)));
    child.stdin.end(input);
  });
}
async function db(sql, dbContainer) {
  const output = await commandWithInput('docker', ['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-q', '-v', 'ON_ERROR_STOP=1'], sql);
  return output.split(/\r?\n/).filter(Boolean);
}
async function dbAsSuperadmin(sql, dbContainer) {
  const [superadmin] = await db('select user_id from superadmins limit 1;', dbContainer);
  if (!superadmin) throw new Error('No hay un superadmin local para aprovisionar el fixture; sembralo antes de correr este comando.');
  return await db(`do $$ begin perform set_config('request.jwt.claims', json_build_object('sub','${superadmin}','role','authenticated')::text, false); end $$; ${sql}`, dbContainer);
}
async function workerRoleRemove(organizationId, dbContainer) {
  const role = `worker_${organizationId.replaceAll('-', '')}`;
  await db(`revoke all on schema private from ${role}; revoke all on function private.organizacion_del_rol_actual() from ${role}; drop role if exists ${role};`, dbContainer);
}
async function waitPort(port, label) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { await command('node', ['-e', `require('net').connect(${Number(port)}, '127.0.0.1').once('connect',()=>process.exit(0)).once('error',()=>process.exit(1))`]); return; } catch { await new Promise((resolve) => setTimeout(resolve, 1000)); }
  }
  throw new Error(`${label} no quedó disponible en 127.0.0.1:${port} dentro de 30 segundos.`);
}
function basicHeader(configuration, envFile) {
  const fromEnv = (name, fallback) => process.env[name] || fallback;
  let username = fromEnv('KESTRA_BASIC_AUTH_USERNAME', 'admin@local.test');
  let password = fromEnv('KESTRA_BASIC_AUTH_PASSWORD', 'change-me-local');
  for (const line of envFile.split(/\r?\n/)) {
    const [, key, value] = /^(KESTRA_BASIC_AUTH_(?:USERNAME|PASSWORD))=(.*)$/.exec(line) || [];
    if (key === 'KESTRA_BASIC_AUTH_USERNAME') username = value.trim();
    if (key === 'KESTRA_BASIC_AUTH_PASSWORD') password = value.trim();
  }
  const found = /basic-auth:\s*\n\s*enabled:\s*true\s*\n\s*username:\s*([^\s]+)\s*\n\s*password:\s*([^\s]+)/s.exec(configuration);
  if (found) [, username, password] = found;
  return { Authorization: `Basic ${Buffer.from(`${username}:${password}`, 'ascii').toString('base64')}` };
}
async function request(base, endpoint, options, headers) {
  const response = await fetch(`${base}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`Kestra devolvió HTTP ${response.status}.`);
  return response.status === 204 ? undefined : await response.json();
}
async function publish(base, source, namespace, id, headers) {
  const body = await readFile(source, 'utf8');
  const options = { headers: { 'content-type': 'application/x-yaml' }, body };
  try { await request(base, `/flows/${namespace}/${id}`, { ...options, method: 'PUT' }, headers); }
  catch (error) {
    if (!error.message.includes('HTTP 404')) throw error;
    await request(base, '/flows', { ...options, method: 'POST' }, headers);
  }
}
async function start(base, namespace, id, inputs, headers) {
  const form = new FormData();
  for (const [key, value] of Object.entries(inputs)) form.set(key, value);
  return (await request(base, `/executions/${namespace}/${id}`, { method: 'POST', body: form }, headers)).id;
}
async function waitExecution(base, id, headers) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const execution = await request(base, `/executions/${id}`, { method: 'GET' }, headers);
    if (!['CREATED', 'RUNNING', 'RETRYING'].includes(execution.state.current)) return execution;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`La ejecución ${id} no llegó a un estado terminal a tiempo.`);
}
async function saveArtifacts(base, id, label, headers, artifactDirectory) {
  const execution = await request(base, `/executions/${id}`, { method: 'GET' }, headers);
  await writeFile(path.join(artifactDirectory, `${label}.exec.json`), JSON.stringify(execution, null, 2));
  const logs = await request(base, `/logs/${id}`, { method: 'GET' }, headers);
  await writeFile(path.join(artifactDirectory, `${label}.logs.json`), JSON.stringify(logs, null, 2));
  const alert = execution.taskRunList?.find((task) => ['alertar_tecnica', 'alertar_credencial'].includes(task.taskId) && task.outputs?.executionId);
  if (alert) {
    const alertId = alert.outputs.executionId;
    await writeFile(path.join(artifactDirectory, `${label}.alertas.exec.json`), JSON.stringify(await request(base, `/executions/${alertId}`, { method: 'GET' }, headers), null, 2));
    await writeFile(path.join(artifactDirectory, `${label}.alertas.logs.json`), JSON.stringify(await request(base, `/logs/${alertId}`, { method: 'GET' }, headers), null, 2));
  }
  return execution;
}
function assertClassification(execution, expectedCredential, label) {
  const task = execution.taskRunList?.find((item) => item.taskId === 'clasificar_y_alertar');
  if (!task) throw new Error(`${label} no generó la tarea clasificar_y_alertar.`);
  if (Boolean(task.outputs?.evaluationResult) !== expectedCredential) throw new Error(`${label} tuvo una clasificación inesperada.`);
}

let dbContainer;
let organizationX;
let organizationY;
let work;
try {
  const localDatabases = (await docker(['ps', '--format', '{{.Names}} {{.ID}}'])).split(/\r?\n/);
  dbContainer = localDatabases.find((line) => line.startsWith('supabase_db_automation-platform-template-supabase-'))?.split(' ')[1];
  const kestra = await compose(['ps', '-q', 'kestra']);
  if (!dbContainer || !kestra) throw new Error('Supabase o Kestra local no están levantados para el fixture E2E.');
  const kestraPort = (await docker(['port', kestra, '8080/tcp'])).match(/:(\d+)$/)?.[1];
  const supabasePort = (await docker(['port', dbContainer, '5432/tcp'])).match(/:(\d+)$/)?.[1];
  if (!kestraPort || !supabasePort) throw new Error('No se pudo resolver un puerto local requerido por el fixture.');
  const base = `http://127.0.0.1:${kestraPort}/api/v1/main`;
  work = await mkdtemp(path.join(os.tmpdir(), 'spec014-'));
  const artifactDirectory = path.join(work, 'artifacts');
  await mkdir(artifactDirectory);
  await docker(['build', '-t', tag, 'infra/kestra/fixtures/worker']);
  await docker(['build', '-t', sshImage, 'infra/kestra/fixtures/ssh-host']);
  const keyBase64 = await docker(['exec', kestra, 'sh', '-c', 'printf "%s" "$SECRET_ORQUESTACION_SSH_PRIVATE_KEY"']);
  if (!keyBase64) throw new Error('Kestra no tiene una clave SSH de orquestación utilizable.');
  const keyFile = path.join(work, 'orquestacion.key');
  await writeFile(keyFile, Buffer.from(keyBase64, 'base64'), { mode: 0o600 });
  if (process.platform === 'win32') {
    const username = process.env.USERNAME;
    if (!username) throw new Error('No se pudo resolver el usuario actual para proteger la clave temporal.');
    await command('icacls', [keyFile, '/inheritance:r', '/grant:r', `${username}:(R,W)`]);
  }
  const publicKey = await command('ssh-keygen', ['-y', '-f', keyFile]).then((result) => result.stdout.trim());
  await rm(keyFile, { force: true });
  const headers = basicHeader(await docker(['exec', kestra, 'cat', '/app/confs/application.yml']), await readFile('infra/kestra/.env', 'utf8').catch(() => ''));
  organizationX = crypto.randomUUID(); organizationY = crypto.randomUUID();
  await db(`insert into public.organizaciones(id,nombre) values ('${organizationX}','fixture-014-x'), ('${organizationY}','fixture-014-y');`, dbContainer);
  const [passwordX] = await dbAsSuperadmin(`select password_rol from public.aprovisionar_servidor_organizacion('${organizationX}','host.docker.internal','fixture','no-usar',22041);`, dbContainer);
  const [passwordY] = await dbAsSuperadmin(`select password_rol from public.aprovisionar_servidor_organizacion('${organizationY}','host.docker.internal','fixture','no-usar',22042);`, dbContainer);
  const vaultIds = await Promise.all(secretNames.map(async (name) => (await db(`select vault.create_secret('${sentinel}','${name}');`, dbContainer))[0]));
  const connections = Array.from({ length: 4 }, () => crypto.randomUUID());
  await db(`insert into public.conexiones(id,organizacion_id,sistema_externo,credencial_vault_id) values ('${connections[0]}','${organizationX}','fixture-exito','${vaultIds[0]}'),('${connections[1]}','${organizationY}','fixture-exito','${vaultIds[1]}'),('${connections[2]}','${organizationX}','fixture-tecnica','${vaultIds[2]}'),('${connections[3]}','${organizationX}','fixture-credencial','${vaultIds[3]}');`, dbContainer);
  const envX = path.join(work, 'x.env'); const envY = path.join(work, 'y.env');
  const workerEnv = (id, password) => `PGHOST=host.docker.internal\nPGPORT=${supabasePort}\nPGDATABASE=postgres\nPGUSER=worker_${id.replaceAll('-', '')}\nPGPASSWORD=${password}\nWORKER_NETWORK=bridge\n`;
  await writeFile(envX, workerEnv(organizationX, passwordX)); await writeFile(envY, workerEnv(organizationY, passwordY));
  for (const [name, port, envFile] of [['spec014-ssh-x', '22041', envX], ['spec014-ssh-y', '22042', envY]]) {
    await docker(['run', '-d', '--name', name, '-p', `127.0.0.1:${port}:2222`, '-e', `PUBLIC_KEY=${publicKey}`, '-e', 'USER_NAME=fixture', '-e', 'PASSWORD_ACCESS=false', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', `${envFile}:/opt/automation-platform/worker.env:ro`, sshImage]);
    await waitPort(port, `SSH fixture ${name.at(-1).toUpperCase()}`);
  }
  await publish(base, 'infra/kestra/flows/plantilla-generico.yml', 'platform.orquestacion', 'plantilla-generico', headers);
  await publish(base, 'infra/kestra/flows/plantilla-dedicado.yml', 'platform.orquestacion', 'plantilla-dedicado', headers);
  await publish(base, 'infra/kestra/flows/alertas.yml', 'platform.alertas', 'alertas', headers);
  console.log('Disparando escenario de éxito (dos organizaciones)...');
  const successId = await start(base, 'platform.orquestacion', 'plantilla-generico', { sistema_externo: 'fixture-exito', imagen: tag }, headers);
  await waitExecution(base, successId, headers);
  const success = await saveArtifacts(base, successId, 'exito', headers, artifactDirectory);
  if (success.state.current !== 'SUCCESS') throw new Error(`El escenario de éxito terminó en ${success.state.current}, se esperaba SUCCESS.`);
  console.log('Disparando escenario de falla técnica...');
  const technicalId = await start(base, 'platform.orquestacion', 'plantilla-dedicado', { organizacion_id: organizationX, sistema_externo: 'fixture-tecnica', imagen: tag }, headers);
  await waitExecution(base, technicalId, headers);
  assertClassification(await saveArtifacts(base, technicalId, 'falla-tecnica', headers, artifactDirectory), false, 'La falla técnica');
  console.log('Disparando escenario de falla de credencial (con reintento)...');
  const credentialId = await start(base, 'platform.orquestacion', 'plantilla-dedicado', { organizacion_id: organizationX, sistema_externo: 'fixture-credencial', imagen: tag }, headers);
  await waitExecution(base, credentialId, headers);
  assertClassification(await saveArtifacts(base, credentialId, 'falla-credencial', headers, artifactDirectory), true, 'La falla de credencial');
  await writeFile(path.join(artifactDirectory, 'kestra-internal-storage.txt'), await docker(['exec', kestra, 'sh', '-c', `grep -rF -e '${sentinel}' -e '${Buffer.from(sentinel).toString('base64')}' /app/storage /tmp/kestra-wd 2>/dev/null; echo fin-busqueda`]));
  await command('node', ['infra/kestra/test-secretos-orquestacion.mjs', '--artifact-directory', artifactDirectory], { env: { ...process.env, CREDENCIAL_CENTINELA: sentinel } });
  console.log('OK: recorrido completo sin apariciones del centinela en ninguna ejecución real.');
} finally {
  await Promise.all(containers.map((name) => docker(['rm', '-f', name]).catch(() => undefined)));
  if (dbContainer && organizationX && organizationY) {
    await db(`delete from public.organizaciones where id in ('${organizationX}','${organizationY}');`, dbContainer).catch(() => undefined);
    await workerRoleRemove(organizationX, dbContainer).catch(() => undefined);
    await workerRoleRemove(organizationY, dbContainer).catch(() => undefined);
    await db(`delete from vault.secrets where name in (${secretNames.map((name) => `'${name}'`).join(',')});`, dbContainer).catch(() => undefined);
  }
  if (work) await rm(work, { recursive: true, force: true });
}
