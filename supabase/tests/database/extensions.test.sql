-- Smoke test de capacidades habilitadas por migracion, sin depender de
-- ninguna tabla de negocio (todavia no existen). Cuando exista "organizaciones",
-- el test de aislamiento RLS real se agrega en este mismo directorio.
begin;

select plan(1);

select has_extension('vector', 'pgvector debe estar habilitada (ver migracion enable_pgvector)');

select * from finish();

rollback;
