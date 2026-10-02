import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './operaciones.mjs';

const environment = process.argv[2];
if (!['staging', 'production'].includes(environment)) throw new Error('Uso: pnpm deploy:vps -- staging|production');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, `.env.${environment}`);
try { await access(envFile); } catch { throw new Error(`No existe .env.${environment} en el VPS.`); }

for (const product of ['kestra', 'superset', 'playwright', 'nango']) {
  const composeBase = `infra/${product}/compose.yaml`;
  const composeVps = `infra/${product}/compose.vps.yaml`;
  const args = ['compose', '--project-name', `platform-${environment}-${product}`, '--env-file', envFile, '-f', composeBase, '-f', composeVps];
  await run('docker', [...args, 'config', '--quiet'], { cwd: root });
  // --ignore-buildable salta los servicios con build: (p. ej. superset-init) que no
  // tienen de dónde bajarse; build los compila a partir de su Dockerfile. Separado
  // de up --build (como usa dev:superset) para que el log distinga cuál paso falló.
  await run('docker', [...args, 'pull', '--ignore-buildable'], { cwd: root });
  await run('docker', [...args, 'build'], { cwd: root });
  await run('docker', [...args, 'up', '-d', '--remove-orphans'], { cwd: root });
  await run('docker', [...args, 'ps'], { cwd: root });
}
