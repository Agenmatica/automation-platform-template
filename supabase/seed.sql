-- Datos de demostración se agregarán sólo cuando exista la primera spec de negocio.

-- Superadmin de desarrollo local. Sin esto, cada `supabase db reset` (o el
-- primer `pnpm dev:supabase`) deja la plataforma sin ningún superadmin y hay
-- que darlo de alta a mano por SQL (ver quickstart de la spec 003). Sólo
-- corre en local: seed.sql no se aplica contra un proyecto remoto.
--
-- Credenciales fijas, sólo para el stack local:
--   email:    superadmin@local.test
--   password: Superadmin-Local1!
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = 'superadmin@local.test';

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated',
      'authenticated', 'superadmin@local.test',
      crypt('Superadmin-Local1!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '',
      now(), now()
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id::text, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'superadmin@local.test'),
      'email', now(), now()
    );
  end if;

  insert into superadmins (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;
end $$;
