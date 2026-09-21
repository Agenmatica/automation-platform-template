[CmdletBinding()]
param(
  [string] $DbContainer = 'supabase_db_automation-platform-template-supabase-de'
)

# Prueba real, efímera y sin revelar el centinela: comprueba alta y rotación
# de una sola referencia de Vault y que stdout del aprovisionador no incluye
# la clave. Requiere Supabase local levantado.
$ErrorActionPreference = 'Stop'
$providerCode = 'fixture-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$credentialName = 'prueba-aprovisionamiento'
$secretFixture = 'fixture-' + [guid]::NewGuid().ToString('N')

function Invoke-Db([string] $Sql) {
  $result = $Sql | docker.exe exec -i $DbContainer psql -U postgres -d postgres -At -q -v ON_ERROR_STOP=1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw 'Falló una consulta de la prueba de aprovisionamiento.' }
  return $result.Trim()
}

try {
  Invoke-Db "insert into public.ia_proveedores(codigo,nombre,adaptador) values ('$providerCode','Fixture aprovisionamiento','fixture');" | Out-Null
  $env:IA_PROVEEDOR_CODIGO = $providerCode
  $env:IA_PROVEEDOR_CREDENCIAL = $credentialName
  $env:IA_PROVEEDOR_CLAVE = $secretFixture
  $script = Join-Path $PSScriptRoot 'aprovisionar-proveedores.ps1'
  $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -DbContainer $DbContainer 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw 'El aprovisionador falló durante la primera carga.' }
  if ($output.Contains($secretFixture)) { throw 'El aprovisionador escribió la clave en stdout o stderr.' }

  $before = Invoke-Db "select vault_secret_id from public.ia_credenciales_proveedor c join public.ia_proveedores p on p.id = c.proveedor_id where p.codigo = '$providerCode' and c.nombre = '$credentialName';"
  $env:IA_PROVEEDOR_CLAVE = 'fixture-' + [guid]::NewGuid().ToString('N')
  $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -DbContainer $DbContainer 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw 'El aprovisionador falló durante la rotación.' }
  if ($output.Contains($env:IA_PROVEEDOR_CLAVE)) { throw 'La rotación escribió la clave en stdout o stderr.' }
  $after = Invoke-Db "select vault_secret_id from public.ia_credenciales_proveedor c join public.ia_proveedores p on p.id = c.proveedor_id where p.codigo = '$providerCode' and c.nombre = '$credentialName';"
  $count = Invoke-Db "select count(*) from public.ia_credenciales_proveedor c join public.ia_proveedores p on p.id = c.proveedor_id where p.codigo = '$providerCode' and c.nombre = '$credentialName';"
  if ($before -ne $after -or $count -ne '1') { throw 'La rotación no conservó una única referencia de Vault.' }
  $exposiciones = @(rg -n --glob '*.ts' --glob '*.tsx' --glob '*.yml' 'IA_PROVEEDOR_CLAVE|vault_secret_id' apps/web/src infra/kestra)
  if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -gt 1) { throw 'Refine o Kestra contienen una referencia a clave o Vault ID de proveedor IA.' }
  Write-Host 'OK: aprovisionamiento y rotación sin exponer la clave.'
}
finally {
  Remove-Item Env:\IA_PROVEEDOR_CODIGO, Env:\IA_PROVEEDOR_CREDENCIAL, Env:\IA_PROVEEDOR_CLAVE -ErrorAction SilentlyContinue
  Invoke-Db "with borradas as (delete from public.ia_credenciales_proveedor c using public.ia_proveedores p where c.proveedor_id = p.id and p.codigo = '$providerCode' returning c.vault_secret_id) delete from vault.secrets where id in (select vault_secret_id from borradas); delete from public.ia_proveedores where codigo = '$providerCode';" | Out-Null
}
