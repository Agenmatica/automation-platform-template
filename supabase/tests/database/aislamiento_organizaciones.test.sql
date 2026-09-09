-- Aislamiento real entre organizaciones (spec 003, US1, FR-006, SC-001).
-- Corre como postgres (dueño de las tablas, RLS no aplica) para armar el
-- fixture, y como el rol "authenticated" — simulando distintos usuarios
-- vía request.jwt.claims, igual que hace PostgREST — para verificar que
-- cada policy realmente filtra.
begin;

select plan(27);

-- ============================================================================
-- Fixture: 2 organizaciones, 1 admin + 1 miembro por organización, 1 usuario
-- sin ninguna fila en usuarios_organizacion, 1 cliente por organización.
-- ============================================================================

insert into organizaciones (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Organización Uno'),
  ('22222222-2222-2222-2222-222222222222', 'Organización Dos');

insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'admin1@example.com'),
  ('a1000000-0000-0000-0000-000000000002', 'miembro1@example.com'),
  ('a2000000-0000-0000-0000-000000000001', 'admin2@example.com'),
  ('a9000000-0000-0000-0000-000000000009', 'sin-organizacion@example.com'),
  ('a5000000-0000-0000-0000-000000000005', 'superadmin@example.com');

insert into superadmins (user_id) values
  ('a5000000-0000-0000-0000-000000000005');

insert into usuarios_organizacion (user_id, organizacion_id, rol_id) values
  ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'administrador'),
  ('a1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'miembro'),
  ('a2000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'administrador');

insert into clientes (id, organizacion_id, nombre) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cliente de la Uno'),
  ('c2000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Cliente de la Dos');

-- ============================================================================
-- Admin de la organización 1
-- ============================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  (select count(*) from clientes)::int, 1,
  'admin de la organización 1 ve exactamente un cliente'
);

select is(
  (select nombre from clientes limit 1), 'Cliente de la Uno',
  'admin de la organización 1 ve el cliente correcto (no el de la organización 2)'
);

select throws_ok(
  $$insert into clientes (organizacion_id, nombre) values ('22222222-2222-2222-2222-222222222222', 'Intento cruzado')$$,
  '42501',
  null,
  'admin de la organización 1 no puede insertar un cliente en la organización 2'
);

update clientes set nombre = 'Hackeado' where organizacion_id = '22222222-2222-2222-2222-222222222222';

reset role;

select is(
  (select nombre from clientes where id = 'c2000000-0000-0000-0000-000000000001'), 'Cliente de la Dos',
  'el intento de actualización cruzada del admin de la organización 1 no afectó ninguna fila'
);

-- ============================================================================
-- Miembro de la organización 1 (aislamiento, no permiso de escritura —
-- eso lo cubre el test de permisos de clientes, US3)
-- ============================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a1000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  (select count(*) from clientes)::int, 1,
  'miembro de la organización 1 ve exactamente un cliente'
);

select is(
  (select nombre from clientes limit 1), 'Cliente de la Uno',
  'miembro de la organización 1 ve el cliente correcto (no el de la organización 2)'
);

reset role;

-- ============================================================================
-- Admin de la organización 2 (simetría — no es un problema de una sola vía)
-- ============================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a2000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  (select count(*) from clientes)::int, 1,
  'admin de la organización 2 ve exactamente un cliente'
);

select is(
  (select nombre from clientes limit 1), 'Cliente de la Dos',
  'admin de la organización 2 ve el cliente correcto (no el de la organización 1)'
);

reset role;

-- ============================================================================
-- Usuario sin ninguna fila en usuarios_organizacion (fail-closed, FR-007)
-- ============================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a9000000-0000-0000-0000-000000000009', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  (select count(*) from clientes)::int, 0,
  'un usuario sin membresía ni perfil de superadmin no ve ningún cliente'
);

select is(
  (select count(*) from organizaciones)::int, 0,
  'un usuario sin membresía ni perfil de superadmin no ve ninguna organización'
);

reset role;

-- ============================================================================
-- Permisos de escritura en clientes (US3, FR-011): administrador puede
-- crear/editar en su propia organización, miembro no puede (solo lee).
-- ============================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

insert into clientes (id, organizacion_id, nombre) values
  ('c1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Cliente nuevo del admin');

select is(
  (select count(*) from clientes where organizacion_id = '11111111-1111-1111-1111-111111111111')::int, 2,
  'admin de la organización 1 puede insertar un cliente en su propia organización'
);

update clientes set nombre = 'Cliente nuevo del admin (editado)' where id = 'c1000000-0000-0000-0000-000000000002';

select is(
  (select nombre from clientes where id = 'c1000000-0000-0000-0000-000000000002'),
  'Cliente nuevo del admin (editado)',
  'admin de la organización 1 puede editar un cliente de su propia organización'
);

reset role;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a1000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$insert into clientes (organizacion_id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Intento de miembro')$$,
  '42501',
  null,
  'miembro de la organización 1 no puede insertar clientes (solo lectura, FR-011)'
);

update clientes set nombre = 'Editado por miembro' where id = 'c1000000-0000-0000-0000-000000000001';

reset role;

select is(
  (select nombre from clientes where id = 'c1000000-0000-0000-0000-000000000001'), 'Cliente de la Uno',
  'el intento de edición del miembro de la organización 1 no afectó ninguna fila (solo lectura, FR-011)'
);

-- ============================================================================
-- Superadmin "entra" a una organización a la vez (spec 003, US4, FR-006,
-- FR-013) y contexto de organización activa (spec 004: no-op al salir sin
-- nada activo, salida explícita, auditoría de salida automática al
-- cambiar de organización).
-- En este punto la organización 1 tiene 2 clientes y la 2 tiene 1 (ver
-- secciones anteriores).
-- ============================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a5000000-0000-0000-0000-000000000005', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  (select count(*) from clientes)::int, 0,
  'el superadmin sin ninguna organización activa no ve ningún cliente (fail-closed)'
);

-- Salir sin tener ninguna organización activa es un no-op (spec 004,
-- Clarifications Q1): no falla, no agrega fila de auditoría.
select lives_ok(
  $$select salir_de_organizacion()$$,
  'salir_de_organizacion() sin organización activa no falla (no-op)'
);

reset role;

select is(
  (select count(*) from superadmin_entradas where user_id = 'a5000000-0000-0000-0000-000000000005')::int, 0,
  'el no-op de salir_de_organizacion no agregó ninguna fila de auditoría'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a5000000-0000-0000-0000-000000000005', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select entrar_a_organizacion('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*) from clientes)::int, 2,
  'tras entrar a la organización 1, el superadmin ve exactamente sus 2 clientes'
);

update clientes set nombre = 'Editado por el superadmin' where id = 'c1000000-0000-0000-0000-000000000001';

select is(
  (select nombre from clientes where id = 'c1000000-0000-0000-0000-000000000001'), 'Editado por el superadmin',
  'con la organización 1 activa, el superadmin puede editar sus clientes (como su administrador)'
);

select entrar_a_organizacion('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*) from clientes)::int, 1,
  'tras entrar a la organización 2, el superadmin ve solo el cliente de esa organización (el contexto cambió, no se mezclan)'
);

reset role;

select is(
  (select count(*) from superadmin_entradas where user_id = 'a5000000-0000-0000-0000-000000000005')::int, 3,
  'quedaron 3 filas de auditoría: entrada a la 1, salida automática de la 1, entrada a la 2 (spec 004, FR-007)'
);

select is(
  (select accion from superadmin_entradas
     where user_id = 'a5000000-0000-0000-0000-000000000005'
     order by id asc limit 1),
  'entrada',
  'la primera fila de auditoría es la entrada a la organización 1'
);

select is(
  (select array_agg(accion order by id asc) from superadmin_entradas
     where user_id = 'a5000000-0000-0000-0000-000000000005'),
  array['entrada', 'salida', 'entrada'],
  'el orden de acciones es entrada (org 1), salida automática (org 1), entrada (org 2) — verificado por id, no por entrado_en (spec 004, research.md)'
);

select is(
  (select organizacion_id from superadmin_entradas
     where user_id = 'a5000000-0000-0000-0000-000000000005' and accion = 'salida'),
  '11111111-1111-1111-1111-111111111111',
  'la fila de salida automática corresponde a la organización que dejó (la 1), no a la nueva activa'
);

-- Salir explícitamente de la organización activa (spec 004, FR-005/FR-006).
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a5000000-0000-0000-0000-000000000005', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select salir_de_organizacion();

select is(
  (select count(*) from clientes)::int, 0,
  'tras salir, el superadmin vuelve a no ver ningún cliente (fail-closed, igual que antes de haber entrado)'
);

reset role;

select is(
  (select count(*) from superadmin_entradas where user_id = 'a5000000-0000-0000-0000-000000000005')::int, 4,
  'la salida explícita agregó una cuarta fila de auditoría'
);

select is(
  (select accion from superadmin_entradas
     where user_id = 'a5000000-0000-0000-0000-000000000005'
     order by id desc limit 1),
  'salida',
  'la última fila de auditoría es la salida explícita de la organización 2'
);

select * from finish();

rollback;
