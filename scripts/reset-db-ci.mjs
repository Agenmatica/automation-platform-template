import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { run } from './operaciones.mjs';

const root = path.resolve(import.meta.dirname, '..');
const port = process.env.SUPABASE_DB_PORT ?? '5434';
const baseArgs = ['--host', 'host.docker.internal', '--port', port, '--username', 'postgres', '--dbname', 'postgres', '--set', 'ON_ERROR_STOP=1', '--quiet'];
const env = { PGPASSWORD: 'postgres', PGSSLMODE: 'disable' };
const execute = async (input) => await run('psql', baseArgs, { cwd: root, env, input, quiet: true });

await execute('drop schema if exists public cascade; drop schema if exists private cascade; create schema public;');
const migrations = (await readdir(path.join(root, 'supabase/migrations'))).filter((file) => file.endsWith('.sql')).sort();
for (const migration of migrations) {
  console.log(`Aplicando supabase/migrations/${migration}...`);
  await execute(await readFile(path.join(root, 'supabase/migrations', migration), 'utf8'));
}
console.log('Sembrando supabase/seed.sql...');
await execute(await readFile(path.join(root, 'supabase/seed.sql'), 'utf8'));
