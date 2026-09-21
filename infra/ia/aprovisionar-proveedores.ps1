[CmdletBinding()]
param(
  [string] $DbContainer = $env:SUPABASE_DB_CONTAINER
)

# Aprovisiona una clave de proveedor desde el entorno local/de despliegue hacia
# Vault. No acepta la clave por parámetro para que PowerShell no la exponga en
# el historial de comandos; un archivo .env ignorado puede cargar estas
# variables antes de invocar el script.
#
# Variables requeridas:
#   IA_PROVEEDOR_CODIGO       Código existente en public.ia_proveedores.
#   IA_PROVEEDOR_CREDENCIAL   Nombre lógico de la credencial del proveedor.
#   IA_PROVEEDOR_CLAVE        Clave a guardar o rotar en Vault.
#
# SUPABASE_DB_CONTAINER es opcional si hay un único contenedor local cuyo
# nombre comienza con supabase_db_. El script se ejecuta fuera de Refine y de
# Kestra, con acceso administrativo local a PostgreSQL.

$ErrorActionPreference = 'Stop'

function Require-EnvironmentValue([string] $Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Falta la variable de entorno requerida $Name."
  }
  return $value
}

$providerCode = Require-EnvironmentValue 'IA_PROVEEDOR_CODIGO'
$credentialName = Require-EnvironmentValue 'IA_PROVEEDOR_CREDENCIAL'
$providerKey = Require-EnvironmentValue 'IA_PROVEEDOR_CLAVE'

if ($providerCode -notmatch '^[a-z0-9-]+$') {
  throw 'IA_PROVEEDOR_CODIGO debe coincidir con ^[a-z0-9-]+$.'
}

if ($credentialName.Length -gt 120) {
  throw 'IA_PROVEEDOR_CREDENCIAL no puede superar 120 caracteres.'
}

if ([string]::IsNullOrWhiteSpace($DbContainer)) {
  $candidates = @(
    docker.exe ps --format '{{.Names}}' |
      Where-Object { $_ -like 'supabase_db_*' }
  )
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo listar los contenedores Docker para localizar PostgreSQL local.'
  }
  if ($candidates.Count -ne 1) {
    throw 'Definí SUPABASE_DB_CONTAINER: no se encontró exactamente un contenedor local supabase_db_*. '
  }
  $DbContainer = $candidates[0]
}

$sql = @'
\set proveedor_codigo `printf %s "$IA_PROVEEDOR_CODIGO"`
\set credencial_nombre `printf %s "$IA_PROVEEDOR_CREDENCIAL"`
\set clave `printf %s "$IA_PROVEEDOR_CLAVE"`

select
  set_config('app.ia.proveedor_codigo', :'proveedor_codigo', false) as configurado_proveedor,
  set_config('app.ia.credencial_nombre', :'credencial_nombre', false) as configurado_credencial,
  set_config('app.ia.clave', :'clave', false) as configurado_clave
\gset

begin;

do $aprovisionar$
declare
  v_proveedor_id uuid;
  v_vault_secret_id uuid;
  v_codigo text := current_setting('app.ia.proveedor_codigo');
  v_nombre text := current_setting('app.ia.credencial_nombre');
  v_clave text := current_setting('app.ia.clave');
begin
  select id into v_proveedor_id
  from public.ia_proveedores
  where codigo = v_codigo;

  if v_proveedor_id is null then
    raise exception 'No existe el proveedor de IA %', v_codigo using errcode = '22023';
  end if;

  select vault_secret_id into v_vault_secret_id
  from public.ia_credenciales_proveedor
  where proveedor_id = v_proveedor_id and nombre = v_nombre
  for update;

  if found then
    perform vault.update_secret(v_vault_secret_id, v_clave, null, null, null);
  else
    v_vault_secret_id := vault.create_secret(
      v_clave,
      'ia-' || v_codigo || '-' || v_nombre,
      'Clave de proveedor de IA aprovisionada fuera de Refine y Kestra.',
      null
    );

    insert into public.ia_credenciales_proveedor (proveedor_id, nombre, vault_secret_id)
    values (v_proveedor_id, v_nombre, v_vault_secret_id);
  end if;
end;
$aprovisionar$;

commit;
'@

# Las variables se inyectan sólo en el proceso efímero de psql dentro del
# contenedor. Las directivas \set leen el entorno allí y \gset evita que
# set_config (incluida la clave) escriba valores en stdout.
$output = $sql | & docker.exe exec -i `
  --env IA_PROVEEDOR_CODIGO `
  --env IA_PROVEEDOR_CREDENCIAL `
  --env IA_PROVEEDOR_CLAVE `
  $DbContainer psql -U postgres -d postgres -At -q -v ON_ERROR_STOP=1 | Out-String

if ($LASTEXITCODE -ne 0) {
  throw 'Falló el aprovisionamiento de Vault; no se mostró la clave para preservar el secreto.'
}

Write-Host "Credencial '$credentialName' del proveedor '$providerCode' aprovisionada en Vault."
