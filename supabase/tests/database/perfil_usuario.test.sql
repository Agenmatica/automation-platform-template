-- Fixture base de la spec 008. T006 agrega sobre estas identidades las
-- aserciones de RLS, Storage y eventos cuando exista la migración de perfil.
begin;

select plan(2);

create temp table perfil_usuario_fixture (
  user_id uuid primary key,
  organizacion_id uuid not null,
  rol_id text not null
);

insert into perfil_usuario_fixture (user_id, organizacion_id, rol_id) values
  ('81000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', 'administrador'),
  ('81000000-0000-0000-0000-000000000002', '81111111-1111-1111-1111-111111111111', 'miembro'),
  ('82000000-0000-0000-0000-000000000001', '82222222-2222-2222-2222-222222222222', 'miembro');

select is(
  (select count(*) from perfil_usuario_fixture)::int,
  3,
  'el fixture contiene tres personas para probar aislamiento'
);

select is(
  (select count(distinct organizacion_id) from perfil_usuario_fixture)::int,
  2,
  'el fixture contiene dos organizaciones'
);

select * from finish();

rollback;
