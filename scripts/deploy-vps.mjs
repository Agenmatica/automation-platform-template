import { access } from 'node:fs/promises';
import path from 'node:path';
import { run } from './operaciones.mjs';

const environment = process.argv[2];
if (!['staging', 'production'].includes(environment)) throw new Error('Uso: pnpm deploy:vps -- staging|production');
const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, `.env.${environment}`);
try { await access(envFile); } catch { throw new Error(`No existe .env.${environment} en el VPS.`); }

for (const product of ['kestra', 'superset', 'playwright', 'nango']) {
  const composeBase = `infra/${product}/compose.yaml`;
  const composeVps = `infra/${product}/compose.vps.yaml`;
  const args = ['compose', '--project-name', `platform-${environment}-${product}`, '--env-file', envFile, '-f', composeBase, '-f', composeVps];
  await run('docker', [...args, 'config', '--quiet'], { cwd: root });
  await run('docker', [...args, 'pull'], { cwd: root });
  await run('docker', [...args, 'up', '-d', '--remove-orphans'], { cwd: root });
  await run('docker', [...args, 'ps'], { cwd: root });
}
