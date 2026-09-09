-- Analítica embebida por organización (spec 007). Ver
-- specs/007-analitica-embebida/data-model.md y contracts/.
--
-- Sigue el patrón endurecido de la spec 005 (search_path = '', referencias
-- calificadas, revoke all + grant select por separado de las RPCs
-- security definer) en vez del patrón search_path = public de la spec 003,
-- porque es el más reciente que este mismo repo ya estableció.

-- ============================================================================
-- Tablas
-- ============================================================================

create table reportes (
  id uuid primary key default gen_random_uuid(),
  superset_dashboard_uuid text not null unique,
  nombre text not null,
  creado_por uuid not null references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

comment on table reportes is
  'Catálogo interno de reportes embebibles de Superset. Registrarlo acá (FR-001) es independiente de crearlo en Superset — uno no implica el otro.';

create table reportes_roles_default (
  reporte_id uuid not null references reportes (id) on delete cascade,
  rol_id text not null references roles_organizacion (id),
  primary key (reporte_id, rol_id),
  check (rol_id <> 'administrador')
);

comment on table reportes_roles_default is
  'Visibilidad por rol por defecto de un reporte (FR-002), definida por el superadmin. administrador nunca es una fila acá: tiene acceso incondicional (FR-006), garantizado por este check, no solo por UI.';

create table reportes_organizaciones (
  reporte_id uuid not null references reportes (id) on delete cascade,
  organizacion_id uuid not null references organizaciones (id) on delete cascade,
  asignado_por uuid not null references auth.users (id) on delete cascade,
  asignado_en timestamptz not null default now(),
  primary key (reporte_id, organizacion_id)
);

comment on table reportes_organizaciones is
  'Qué organizaciones tienen un reporte asignado (FR-003). Borrar una fila es desasignar; una reasignación posterior arranca desde el default vigente (FR-016), nunca conserva lo anterior.';

create table reportes_organizaciones_roles (
  reporte_id uuid not null,
  organizacion_id uuid not null,
  rol_id text not null references roles_organizacion (id),
  primary key (reporte_id, organizacion_id, rol_id),
  foreign key (reporte_id, organizacion_id)
    references reportes_organizaciones (reporte_id, organizacion_id) on delete cascade,
  check (rol_id <> 'administrador')
);

comment on table reportes_organizaciones_roles is
  'Visibilidad por rol efectiva de una organización puntual (FR-005). Se completa por trigger al momento de la asignación (herencia congelada, FR-004) y de ahí en más es independiente del default global.';

create table eventos_reportes (
  id bigint generated always as identity primary key,
  reporte_id uuid not null references reportes (id) on delete cascade,
  organizacion_id uuid references organizaciones (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  accion text not null check (
    accion in (
      'reporte_registrado',
      'default_actualizado',
      'asignado',
      'desasignado',
      'roles_organizacion_actualizados'
    )
  ),
  detalle jsonb,
  created_at timestamptz not null default clock_timestamp()
);

comment on table eventos_reportes is
  'Auditoría append-only de esta funcionalidad (FR-012, SC-004). organizacion_id es null en eventos a nivel de reporte (registro, default); no nulo en eventos por organización.';

create index eventos_reportes_reporte_id_id_idx on eventos_reportes (reporte_id, id desc);

-- ============================================================================
-- Funciones helper (private, security definer — evitan recursión de RLS)
-- ============================================================================

create or replace function private.rol_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select rol_id from public.usuarios_organizacion where user_id = (select auth.uid())),
    case
      when (select private.is_superadmin())
        and exists (
          select 1 from public.superadmin_organizacion_activa
          where user_id = (select auth.uid())
        )
      then 'administrador'
    end
  );
$$;

comment on function private.rol_id() is
  'Rol efectivo del usuario actual: su fila en usuarios_organizacion, o administrador si es superadmin con una organización activa (mismo criterio que private.puede_escribir() trata a un superadmin en contexto). Null si ninguno de los dos casos aplica.';

revoke execute on function private.rol_id() from public;
grant execute on function private.rol_id() to authenticated;

create or replace function private.puede_gestionar_reportes(p_organizacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios_organizacion u
    where u.user_id = (select auth.uid())
      and u.organizacion_id = p_organizacion_id
      and u.rol_id = 'administrador'
  ) or (
    (select private.is_superadmin()) and exists (
      select 1 from public.superadmin_organizacion_activa a
      where a.user_id = (select auth.uid()) and a.organizacion_id = p_organizacion_id
    )
  );
$$;

comment on function private.puede_gestionar_reportes(uuid) is
  'Administrador de la organización dada, o superadmin con esa organización activa. Redefinida acá (no reusa private.puede_gestionar_membresias de la spec 005) porque esta spec parte de main sin ese PR mergeado todavía (research.md #7).';

revoke execute on function private.puede_gestionar_reportes(uuid) from public;
grant execute on function private.puede_gestionar_reportes(uuid) to authenticated;

create or replace function private.puede_ver_reporte(p_reporte_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reportes_organizaciones_roles ror
    where ror.reporte_id = p_reporte_id
      and ror.organizacion_id = (select private.organizacion_id())
      and (
        ror.rol_id = (select private.rol_id())
        or (select private.rol_id()) = 'administrador'
      )
  );
$$;

comment on function private.puede_ver_reporte(uuid) is
  'Usada por la policy de select de reportes: evita que esa policy consulte reportes_organizaciones_roles directamente (RLS-sobre-RLS), mismo motivo por el que private.organizacion_id()/is_superadmin() son security definer.';

revoke execute on function private.puede_ver_reporte(uuid) from public;
grant execute on function private.puede_ver_reporte(uuid) to authenticated;

-- ============================================================================
-- Trigger: herencia congelada del default al asignar (FR-004/FR-016)
-- ============================================================================

create or replace function private.heredar_roles_default_reporte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reportes_organizaciones_roles (reporte_id, organizacion_id, rol_id)
  select new.reporte_id, new.organizacion_id, rol_id
  from public.reportes_roles_default
  where reporte_id = new.reporte_id;
  return new;
end;
$$;

comment on function private.heredar_roles_default_reporte() is
  'Corre una sola vez, al insertarse la asignación — no vuelve a sincronizar si el default cambia después (FR-004, Acceptance Scenario 4 de la spec).';

create trigger reportes_organizaciones_heredar_roles
  after insert on reportes_organizaciones
  for each row execute function private.heredar_roles_default_reporte();

-- ============================================================================
-- RPCs (public, security definer) — únicas mutaciones permitidas
-- ============================================================================

create or replace function public.registrar_reporte(
  p_superset_dashboard_uuid text,
  p_nombre text,
  p_roles_default text[]
)
returns public.reportes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporte public.reportes;
begin
  if not (select private.is_superadmin()) then
    raise exception 'Solo un superadmin puede registrar reportes' using errcode = '42501';
  end if;

  if 'administrador' = any(p_roles_default) then
    raise exception 'administrador no se configura: tiene acceso incondicional' using errcode = '22023';
  end if;

  insert into public.reportes (superset_dashboard_uuid, nombre, creado_por)
  values (p_superset_dashboard_uuid, p_nombre, (select auth.uid()))
  returning * into v_reporte;

  if p_roles_default is not null and array_length(p_roles_default, 1) > 0 then
    insert into public.reportes_roles_default (reporte_id, rol_id)
    select v_reporte.id, rol_id from unnest(p_roles_default) as rol_id;
  end if;

  insert into public.eventos_reportes (reporte_id, actor_user_id, accion, detalle)
  values (
    v_reporte.id,
    (select auth.uid()),
    'reporte_registrado',
    jsonb_build_object('roles_default', p_roles_default)
  );

  return v_reporte;
end;
$$;

comment on function public.registrar_reporte(text, text, text[]) is
  'Contrato: specs/007-analitica-embebida/contracts/gestion-reportes.md.';

revoke execute on function public.registrar_reporte(text, text, text[]) from public;
grant execute on function public.registrar_reporte(text, text, text[]) to authenticated;

create or replace function public.establecer_roles_default_reporte(
  p_reporte_id uuid,
  p_roles_id text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_superadmin()) then
    raise exception 'Solo un superadmin puede modificar el default de un reporte' using errcode = '42501';
  end if;

  if 'administrador' = any(p_roles_id) then
    raise exception 'administrador no se configura: tiene acceso incondicional' using errcode = '22023';
  end if;

  if not exists (select 1 from public.reportes where id = p_reporte_id) then
    raise exception 'El reporte % no existe', p_reporte_id using errcode = 'P0002';
  end if;

  delete from public.reportes_roles_default where reporte_id = p_reporte_id;

  if p_roles_id is not null and array_length(p_roles_id, 1) > 0 then
    insert into public.reportes_roles_default (reporte_id, rol_id)
    select p_reporte_id, rol_id from unnest(p_roles_id) as rol_id;
  end if;

  insert into public.eventos_reportes (reporte_id, actor_user_id, accion, detalle)
  values (
    p_reporte_id,
    (select auth.uid()),
    'default_actualizado',
    jsonb_build_object('roles_default', p_roles_id)
  );
end;
$$;

comment on function public.establecer_roles_default_reporte(uuid, text[]) is
  'Contrato: specs/007-analitica-embebida/contracts/gestion-reportes.md. No afecta organizaciones ya asignadas (FR-004).';

revoke execute on function public.establecer_roles_default_reporte(uuid, text[]) from public;
grant execute on function public.establecer_roles_default_reporte(uuid, text[]) to authenticated;

create or replace function public.asignar_reporte(
  p_reporte_id uuid,
  p_organizacion_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_filas integer;
begin
  if not (select private.is_superadmin()) then
    raise exception 'Solo un superadmin puede asignar reportes' using errcode = '42501';
  end if;

  if not exists (select 1 from public.reportes where id = p_reporte_id) then
    raise exception 'El reporte % no existe', p_reporte_id using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.organizaciones where id = p_organizacion_id) then
    raise exception 'La organización % no existe', p_organizacion_id using errcode = 'P0002';
  end if;

  insert into public.reportes_organizaciones (reporte_id, organizacion_id, asignado_por)
  values (p_reporte_id, p_organizacion_id, (select auth.uid()))
  on conflict (reporte_id, organizacion_id) do nothing;

  get diagnostics v_filas = row_count;

  -- Idempotente (Principio III): si ya estaba asignado, no duplica el evento
  -- ni vuelve a disparar la herencia (el trigger es AFTER INSERT, no corre
  -- en un on conflict do nothing sin insert real).
  if v_filas > 0 then
    insert into public.eventos_reportes (reporte_id, organizacion_id, actor_user_id, accion)
    values (p_reporte_id, p_organizacion_id, (select auth.uid()), 'asignado');
  end if;
end;
$$;

comment on function public.asignar_reporte(uuid, uuid) is
  'Contrato: specs/007-analitica-embebida/contracts/gestion-reportes.md.';

revoke execute on function public.asignar_reporte(uuid, uuid) from public;
grant execute on function public.asignar_reporte(uuid, uuid) to authenticated;

create or replace function public.desasignar_reporte(
  p_reporte_id uuid,
  p_organizacion_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_filas integer;
begin
  if not (select private.is_superadmin()) then
    raise exception 'Solo un superadmin puede desasignar reportes' using errcode = '42501';
  end if;

  delete from public.reportes_organizaciones
  where reporte_id = p_reporte_id and organizacion_id = p_organizacion_id;

  get diagnostics v_filas = row_count;

  if v_filas > 0 then
    insert into public.eventos_reportes (reporte_id, organizacion_id, actor_user_id, accion)
    values (p_reporte_id, p_organizacion_id, (select auth.uid()), 'desasignado');
  end if;
end;
$$;

comment on function public.desasignar_reporte(uuid, uuid) is
  'Contrato: specs/007-analitica-embebida/contracts/gestion-reportes.md. El on delete cascade de reportes_organizaciones_roles limpia la visibilidad por rol de esa organización — una reasignación posterior arranca desde el default vigente (FR-016).';

revoke execute on function public.desasignar_reporte(uuid, uuid) from public;
grant execute on function public.desasignar_reporte(uuid, uuid) to authenticated;

create or replace function public.establecer_roles_reporte_organizacion(
  p_reporte_id uuid,
  p_organizacion_id uuid,
  p_roles_id text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.puede_gestionar_reportes(p_organizacion_id)) then
    raise exception 'No puede gestionar la visibilidad de reportes de esta organización' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.reportes_organizaciones
    where reporte_id = p_reporte_id and organizacion_id = p_organizacion_id
  ) then
    raise exception 'Ese reporte no está asignado a esta organización' using errcode = '42501';
  end if;

  if 'administrador' = any(p_roles_id) then
    raise exception 'administrador no se configura: tiene acceso incondicional' using errcode = '22023';
  end if;

  delete from public.reportes_organizaciones_roles
  where reporte_id = p_reporte_id and organizacion_id = p_organizacion_id;

  if p_roles_id is not null and array_length(p_roles_id, 1) > 0 then
    insert into public.reportes_organizaciones_roles (reporte_id, organizacion_id, rol_id)
    select p_reporte_id, p_organizacion_id, rol_id from unnest(p_roles_id) as rol_id;
  end if;

  insert into public.eventos_reportes (reporte_id, organizacion_id, actor_user_id, accion, detalle)
  values (
    p_reporte_id,
    p_organizacion_id,
    (select auth.uid()),
    'roles_organizacion_actualizados',
    jsonb_build_object('roles', p_roles_id)
  );
end;
$$;

comment on function public.establecer_roles_reporte_organizacion(uuid, uuid, text[]) is
  'Contrato: specs/007-analitica-embebida/contracts/gestion-reportes.md. FR-005/FR-006 — nunca afecta otra organización ni el default global, y rechaza administrador en el array.';

revoke execute on function public.establecer_roles_reporte_organizacion(uuid, uuid, text[]) from public;
grant execute on function public.establecer_roles_reporte_organizacion(uuid, uuid, text[]) to authenticated;

-- ============================================================================
-- RLS
-- ============================================================================

alter table reportes enable row level security;
alter table reportes_roles_default enable row level security;
alter table reportes_organizaciones enable row level security;
alter table reportes_organizaciones_roles enable row level security;
alter table eventos_reportes enable row level security;

create policy reportes_select on reportes
  for select to authenticated
  using (
    (select private.is_superadmin())
    or (select private.puede_ver_reporte(reportes.id))
  );

create policy reportes_roles_default_select on reportes_roles_default
  for select to authenticated
  using ((select private.is_superadmin()));

create policy reportes_organizaciones_select on reportes_organizaciones
  for select to authenticated
  using (
    (select private.is_superadmin())
    or organizacion_id = (select private.organizacion_id())
  );

create policy reportes_organizaciones_roles_select on reportes_organizaciones_roles
  for select to authenticated
  using (
    (select private.is_superadmin())
    or (
      organizacion_id = (select private.organizacion_id())
      and (
        rol_id = (select private.rol_id())
        or (select private.rol_id()) = 'administrador'
      )
    )
  );

create policy eventos_reportes_select on eventos_reportes
  for select to authenticated
  using (
    (select private.is_superadmin())
    or (
      organizacion_id is not null
      and organizacion_id = (select private.organizacion_id())
      and (select private.puede_escribir())
    )
  );

-- ============================================================================
-- Grants (auto_expose_new_tables = false: hacen falta explícitos; patrón
-- endurecido de la spec 005 — solo select directo, mutaciones únicamente
-- vía las RPCs de arriba)
-- ============================================================================

revoke all on table reportes from anon, authenticated;
grant select on table reportes to authenticated;

revoke all on table reportes_roles_default from anon, authenticated;
grant select on table reportes_roles_default to authenticated;

revoke all on table reportes_organizaciones from anon, authenticated;
grant select on table reportes_organizaciones to authenticated;

revoke all on table reportes_organizaciones_roles from anon, authenticated;
grant select on table reportes_organizaciones_roles to authenticated;

revoke all on table eventos_reportes from anon, authenticated;
grant select on table eventos_reportes to authenticated;
