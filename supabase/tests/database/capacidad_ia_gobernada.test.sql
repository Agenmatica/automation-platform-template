begin;

select plan(25);

insert into auth.users (id, email) values
  ('16000000-0000-0000-0000-000000000001', 'ia-superadmin@example.com'),
  ('16000000-0000-0000-0000-000000000002', 'ia-org-admin@example.com');
insert into public.superadmins (user_id) values ('16000000-0000-0000-0000-000000000001');

insert into public.ia_proveedores (codigo, nombre, adaptador, habilitado, retencion_verificada_en, retencion_verifica_hasta, evidencia_retencion_url, verificado_por)
values ('fixture-ia', 'Fixture IA', 'fixture', true, now(), now() + interval '1 day', 'https://example.invalid/retencion', '16000000-0000-0000-0000-000000000001');

insert into public.ia_credenciales_proveedor (proveedor_id, nombre, vault_secret_id)
select id, 'fixture', extensions.gen_random_uuid() from public.ia_proveedores where codigo = 'fixture-ia';
insert into public.ia_modelos_descubiertos (credencial_id, modelo_id)
select id, 'fixture-model' from public.ia_credenciales_proveedor where nombre = 'fixture';

select has_table('public', 'ia_interacciones', 'crea tabla de interacciones');
select has_table('public', 'ia_eventos_interaccion', 'crea tabla de eventos append-only');

select set_config('request.jwt.claims', json_build_object('sub', '16000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.ia_proveedores), 0, 'administrador de organización no ve proveedores IA globales');
select throws_ok($$select private.resolver_politica_ia('fixture')$$, '42501', null, 'authenticated no puede resolver políticas IA de runtime');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '16000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.ia_proveedores where codigo = 'fixture-ia'), 1, 'superadmin ve proveedor IA global');
reset role;

select is((select count(*)::int from information_schema.column_privileges where table_schema = 'public' and table_name = 'ia_credenciales_proveedor' and column_name = 'vault_secret_id' and grantee = 'authenticated'), 0, 'authenticated no recibe grant sobre vault_secret_id');
select ok(has_function_privilege('workers_orquestacion', 'private.resolver_politica_ia(text)', 'execute'), 'grupo técnico de workers puede resolver política IA');
select ok(has_function_privilege('workers_orquestacion', 'private.obtener_clave_perfil_ia(uuid)', 'execute'), 'grupo técnico de workers puede obtener clave temporal');
select ok(not has_function_privilege('authenticated', 'private.obtener_clave_perfil_ia(uuid)', 'execute'), 'authenticated no puede obtener claves IA');

select is((select count(*)::int from public.ia_proveedores where codigo in ('openai', 'anthropic', 'google', 'xai', 'deepseek', 'alibaba-qwen', 'zhipu-glm', 'moonshot-kimi', 'baidu-ernie')), 9, 'siembra el catálogo cerrado de nueve proveedores');

select set_config('request.jwt.claims', json_build_object('sub', '16000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$select private.configurar_proveedor_ia('openai', false, null, null, null)$$, '42501', null, 'administrador de organización no configura proveedores IA');
select throws_ok($$select public.crear_perfil_modelo_ia((select id from public.ia_credenciales_proveedor where nombre = 'fixture'), 'fixture-model', 'No permitido')$$, '42501', null, 'administrador de organización no crea perfiles IA');
select throws_ok($$select public.guardar_contrato_ia('contrato-fixture', 1, 'fixture', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, 'borrador')$$, '42501', null, 'administrador de organización no guarda contratos IA');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '16000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok($$select private.configurar_proveedor_ia('openai', true, now(), now() + interval '1 day', 'https://example.invalid/evidencia')$$, 'superadmin configura proveedor con evidencia vigente');
select ok((select habilitado and verificado_por = '16000000-0000-0000-0000-000000000001'::uuid from public.ia_proveedores where codigo = 'openai'), 'habilitación conserva verificador superadmin');
select lives_ok($$select public.crear_perfil_modelo_ia((select id from public.ia_credenciales_proveedor where nombre = 'fixture'), 'fixture-model', 'Perfil fixture')$$, 'superadmin crea perfil desde modelo descubierto');
select lives_ok($$select public.guardar_contrato_ia('contrato-fixture', 1, 'fixture', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, 'aprobado')$$, 'superadmin guarda contrato aprobado');
select lives_ok($$select public.guardar_politica_ia('politica-fixture', 1, (select id from public.ia_contratos_consumidor where codigo = 'contrato-fixture'), (select id from public.ia_perfiles_modelo where nombre = 'Perfil fixture'), (select id from public.ia_perfiles_modelo where nombre = 'Perfil fixture'), 2::smallint, 90, 'aprobada')$$, 'superadmin aprueba política con fallback permitido');
reset role;

insert into public.ia_interacciones (consumidor_codigo, origen, idempotency_key, politica_id, politica_version, perfil_principal_id, perfil_fallback_id, perfil_efectivo_id, estado, intentos, vence_en, purga_pendiente_en)
select 'fixture', 'worker', 'revision-fixture', id, 1, perfil_principal_id, perfil_fallback_id, perfil_principal_id, 'revision_humana', 2, now() + interval '1 minute', now() + interval '90 days'
from public.ia_politicas where codigo = 'politica-fixture';
insert into public.ia_interacciones (consumidor_codigo, origen, idempotency_key, politica_id, politica_version, perfil_principal_id, perfil_fallback_id, perfil_efectivo_id, estado, intentos, vence_en, resultado_sanitizado, error_sanitizado, evidencia_path, purga_pendiente_en)
select 'fixture', 'worker', 'purga-fixture', id, 1, perfil_principal_id, perfil_fallback_id, perfil_principal_id, 'completada', 1, now() - interval '91 days', '{"detalle":"temporal"}'::jsonb, 'error temporal', 'fixture/purga.json', now() - interval '1 day'
from public.ia_politicas where codigo = 'politica-fixture';
insert into public.ia_eventos_interaccion (interaccion_id, secuencia, tipo)
select id, 1, 'completada' from public.ia_interacciones where idempotency_key = 'purga-fixture';

select set_config('request.jwt.claims', json_build_object('sub', '16000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.ia_interacciones), 0, 'administrador de organización no ve interacciones IA');
select throws_ok($$select public.resolver_revision_ia((select id from public.ia_interacciones where idempotency_key = 'revision-fixture'), 'cancelada', '{}'::jsonb)$$, '42501', null, 'administrador de organización no resuelve revisión IA');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '16000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok($$select public.resolver_revision_ia((select id from public.ia_interacciones where idempotency_key = 'revision-fixture'), 'cancelada', '{"origen":"fixture"}'::jsonb)$$, 'superadmin resuelve revisión humana');
reset role;

select is((select count(*)::int from private.evidencias_ia_pendientes_purga(clock_timestamp())), 1, 'runtime encuentra una evidencia vencida para borrar por Storage API');
select is(private.finalizar_purga_evidencias_ia(array[(select id from public.ia_interacciones where idempotency_key = 'purga-fixture')]), 1, 'confirma purga idempotente después del borrado en Storage');
select ok((select evidencia_path is null and resultado_sanitizado is null and error_sanitizado is null from public.ia_interacciones where idempotency_key = 'purga-fixture'), 'purga retira detalle sensible y conserva agregado de interacción');

select ok(has_function_privilege('workers_orquestacion', 'private.obtener_clave_credencial_ia(uuid)', 'execute'), 'worker autorizado puede obtener clave de credencial para descubrimiento');

select * from finish();
rollback;
