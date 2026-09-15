[CmdletBinding()]
param()

# Fixture efimero de Spec 014. No escribe secretos en el repositorio: los
# archivos worker.env y los artefactos exportados de Kestra viven en
# $env:TEMP y se eliminan en finally. Corre el recorrido completo de
# quickstart.md (exito en dos organizaciones, falla tecnica, falla de
# credencial con reintento) contra un Kestra local real, exporta sus
# outputs/logs y termina invocando test-secretos-orquestacion.ps1
# -ArtifactDirectory para demostrar de forma automatizada y repetible cero
# apariciones del centinela (FR-008; research.md R5: "Solo revision de YAML:
# rechazado, no prueba persistencia en runtime").
#
# Requiere: Supabase y Kestra locales corriendo (pnpm dev:supabase,
# pnpm dev:kestra), un superadmin sembrado en la base local, y correr desde
# la raiz del repo.
$ErrorActionPreference = 'Stop'
$tag = 'automation-platform-template/spec014-fixture-worker:local'
$db = 'supabase_db_automation-platform-template-supabase-de'
$kestra = 'automation-platform-template-kestra-dev-kestra-1'
$kestraBase = 'http://localhost:8082/api/v1/main'
$sentinel = 'CENTINELA_014_NO_PERSISTIR'
$work = Join-Path $env:TEMP ("spec014-" + [guid]::NewGuid())
$artifactDir = Join-Path $work 'artifacts'
$orgX = [guid]::NewGuid().ToString(); $orgY = [guid]::NewGuid().ToString()
$containers = @('spec014-ssh-x', 'spec014-ssh-y')
$vaultSecretNames = @('fixture-014-x', 'fixture-014-y', 'fixture-014-tecnica', 'fixture-014-credencial')

function Invoke-Db([string] $Sql) {
  # El SQL viaja por stdin, nunca como argumento -c: un argumento con
  # comillas simples y dobles mezcladas (como el JSON del JWT impersonado)
  # cruza mal el limite PowerShell -> proceso nativo en Windows y termina
  # corrompido. docker.exe tambien es un proceso nativo: un exit distinto de
  # cero no dispara $ErrorActionPreference = 'Stop' por si solo, de ahi el
  # chequeo explicito.
  # -q suprime los avisos de fin de sentencia (BEGIN, SET, DO, INSERT 0 1):
  # sin esto se cuelan como lineas extra y corren de posicion el resultado
  # real cuando se toma [0].
  $raw = $Sql | docker exec -i $db psql -U postgres -d postgres -At -q -v ON_ERROR_STOP=1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    throw "psql fallo (exit $LASTEXITCODE) para: $Sql`n$raw"
  }
  # El operador coma es obligatorio: un `return @(...)` con un solo elemento
  # se "desenrolla" a un escalar al cruzar el limite de la funcion (PowerShell
  # enumera el array hacia el stream de salida), y como todo objeto tiene una
  # propiedad .Count sintetica, el llamador no nota la diferencia hasta que
  # indexa [0] sobre un string y recibe su primer caracter en vez del valor.
  return ,@($raw -split "`r?`n" | Where-Object { $_ -ne '' })
}

function Invoke-DbComoSuperadmin([string] $Sql) {
  # aprovisionar_servidor_organizacion exige un superadmin autenticado; el
  # fixture reutiliza uno ya sembrado localmente e impersona su JWT. postgres
  # ya es superusuario (bypassa el GRANT EXECUTE a `authenticated`), asi que
  # no hace falta SET ROLE; set_config(..., false) es a nivel de sesion y no
  # requiere un bloque de transaccion. El DO/PERFORM evita que el propio
  # set_config emita una fila de salida que se colaria antes de la de $Sql.
  $superadmin = (Invoke-Db 'select user_id from superadmins limit 1;')[0]
  if ([string]::IsNullOrWhiteSpace($superadmin)) {
    throw 'No hay un superadmin local para aprovisionar el fixture; sembra uno antes de correr este script.'
  }
  $wrapped = "do `$`$ begin perform set_config('request.jwt.claims', json_build_object('sub','$superadmin','role','authenticated')::text, false); end `$`$; $Sql"
  return Invoke-Db $wrapped
}

function Remove-WorkerRole([string] $OrganizacionId) {
  $role = 'worker_' + ($OrganizacionId -replace '-', '')
  # El aprovisionamiento otorga privilegios propios a este rol (schema
  # private, organizacion_del_rol_actual); DROP ROLE falla si quedan
  # dependientes, asi que se revocan antes de intentarlo.
  Invoke-Db "revoke all on schema private from $role;" | Out-Null
  Invoke-Db "revoke all on function private.organizacion_del_rol_actual() from $role;" | Out-Null
  Invoke-Db "drop role if exists $role;" | Out-Null
}

function Get-KestraAuthHeader {
  # Lee infra/kestra/.env (no versionado) en vez de preguntarle al contenedor:
  # KESTRA_CONFIGURATION es una sola variable YAML embebida multilinea y el
  # cruce Windows -> docker exec -> sh le pierde los saltos de linea. Cae en
  # los defaults documentados en compose.yaml si el archivo o las claves no
  # existen.
  $user = 'admin@local.test'
  $pass = 'change-me-local'
  $envFile = 'infra/kestra/.env'
  if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
      if ($line -match '^KESTRA_BASIC_AUTH_USERNAME=(.*)$') { $user = $Matches[1].Trim() }
      if ($line -match '^KESTRA_BASIC_AUTH_PASSWORD=(.*)$') { $pass = $Matches[1].Trim() }
    }
  }
  $token = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${user}:${pass}"))
  return @{ Authorization = "Basic $token" }
}

function Publish-KestraFlow([string] $Path, [string] $Namespace, [string] $FlowId, [hashtable] $Headers) {
  $yaml = Get-Content -LiteralPath $Path -Raw
  try {
    Invoke-RestMethod -Uri "$kestraBase/flows/$Namespace/$FlowId" -Method Put -Headers $Headers -ContentType 'application/x-yaml' -Body $yaml | Out-Null
  } catch {
    # El flow todavia no existe en este Kestra: PUT sobre un id inexistente
    # devuelve 404 en vez de crearlo.
    Invoke-RestMethod -Uri "$kestraBase/flows" -Method Post -Headers $Headers -ContentType 'application/x-yaml' -Body $yaml | Out-Null
  }
}

function Start-KestraExecution([string] $Namespace, [string] $FlowId, [hashtable] $Inputs, [hashtable] $Headers) {
  # Invoke-RestMethod en Windows PowerShell 5.1 no tiene -Form; Kestra exige
  # multipart/form-data para inputs, asi que se arma el cuerpo a mano.
  $boundary = [guid]::NewGuid().ToString()
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($key in $Inputs.Keys) {
    $lines.Add("--$boundary")
    $lines.Add("Content-Disposition: form-data; name=`"$key`"")
    $lines.Add('')
    $lines.Add($Inputs[$key])
  }
  $lines.Add("--$boundary--")
  $body = $lines -join "`r`n"
  $resp = Invoke-RestMethod -Uri "$kestraBase/executions/$Namespace/$FlowId" -Method Post -Headers $Headers -ContentType "multipart/form-data; boundary=$boundary" -Body $body
  return $resp.id
}

function Wait-KestraExecution([string] $Id, [hashtable] $Headers) {
  # despacho_ssh reintenta hasta 3 veces con backoff exponencial (30s..2m);
  # el peor caso de la falla de credencial/tecnica ronda unos pocos minutos.
  for ($i = 0; $i -lt 90; $i++) {
    $exec = Invoke-RestMethod -Uri "$kestraBase/executions/$Id" -Headers $Headers
    if ($exec.state.current -notin @('CREATED', 'RUNNING', 'RETRYING')) { return $exec }
    Start-Sleep -Seconds 5
  }
  throw "La ejecucion $Id no llego a un estado terminal a tiempo."
}

function Save-KestraArtifacts([string] $Id, [string] $Label, [hashtable] $Headers) {
  $exec = Invoke-RestMethod -Uri "$kestraBase/executions/$Id" -Headers $Headers
  $exec | ConvertTo-Json -Depth 30 | Set-Content -Path (Join-Path $artifactDir "$Label.exec.json")
  $logs = Invoke-RestMethod -Uri "$kestraBase/logs/$Id" -Headers $Headers
  $logs | ConvertTo-Json -Depth 30 | Set-Content -Path (Join-Path $artifactDir "$Label.logs.json")

  # Si la falla disparo el subflow de alertas, sus outputs/logs tambien
  # deben quedar libres del centinela: se exportan aparte.
  $alerta = $exec.taskRunList | Where-Object { $_.taskId -in @('alertar_tecnica', 'alertar_credencial') -and $_.outputs.executionId }
  if ($alerta) {
    $alertaId = $alerta[0].outputs.executionId
    $alertaExec = Invoke-RestMethod -Uri "$kestraBase/executions/$alertaId" -Headers $Headers
    $alertaExec | ConvertTo-Json -Depth 30 | Set-Content -Path (Join-Path $artifactDir "$Label.alertas.exec.json")
    $alertaLogs = Invoke-RestMethod -Uri "$kestraBase/logs/$alertaId" -Headers $Headers
    $alertaLogs | ConvertTo-Json -Depth 30 | Set-Content -Path (Join-Path $artifactDir "$Label.alertas.logs.json")
  }

  return $exec
}

function Assert-Clasificacion([object] $Exec, [bool] $EsperaCredencial, [string] $Label) {
  $tarea = $Exec.taskRunList | Where-Object { $_.taskId -eq 'clasificar_y_alertar' }
  if (-not $tarea) { throw "$Label no genero la tarea clasificar_y_alertar." }
  $resultado = [bool]$tarea[0].outputs.evaluationResult
  if ($resultado -ne $EsperaCredencial) {
    throw "$Label clasifico evaluationResult=$resultado, se esperaba $EsperaCredencial."
  }
}

try {
  New-Item -ItemType Directory -Path $work | Out-Null
  New-Item -ItemType Directory -Path $artifactDir | Out-Null
  docker build -t $tag 'infra/kestra/fixtures/worker' | Out-Null
  docker build -t 'automation-platform-template/spec014-fixture-ssh:local' 'infra/kestra/fixtures/ssh-host' | Out-Null

  # Deriva solo la clave publica del secreto ya cargado por Kestra. La imagen
  # de Kestra no trae CLI de Docker, asi que la derivacion corre localmente:
  # se extrae la clave privada del contenedor a un archivo temporal del host
  # y ssh-keygen local calcula la publica sin persistir la privada en git.
  # Sin prefijo ENV_: secret() de Kestra lee directo las variables SECRET_*
  # del proceso (compose.yaml), a diferencia de envs.* que sí lo necesita.
  # Se captura solo el Base64 (una linea) y se decodifica en .NET: pasar el
  # contenido multilinea ya decodificado por el pipeline de PowerShell le
  # normaliza los saltos de linea a CRLF y corrompe el formato PEM.
  $keyFile = Join-Path $work 'orquestacion.key'
  $keyB64 = docker exec $kestra sh -c 'printf "%s" "$SECRET_ORQUESTACION_SSH_PRIVATE_KEY"'
  if ([string]::IsNullOrWhiteSpace($keyB64)) { throw 'Kestra no tiene una clave SSH de orquestacion utilizable.' }
  [IO.File]::WriteAllBytes($keyFile, [Convert]::FromBase64String($keyB64))
  # El cliente OpenSSH de Windows rechaza una clave privada con ACL heredada
  # ("bad permissions"); hay que restringirla al usuario actual, equivalente
  # a chmod 600.
  icacls $keyFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
  $publicKey = & ssh-keygen -y -f $keyFile
  Remove-Item -LiteralPath $keyFile -Force

  $headers = Get-KestraAuthHeader

  Invoke-Db "insert into public.organizaciones(id,nombre) values ('$orgX','fixture-014-x'), ('$orgY','fixture-014-y');" | Out-Null
  $pwX = (Invoke-DbComoSuperadmin "select password_rol from public.aprovisionar_servidor_organizacion('$orgX','host.docker.internal','fixture','no-usar',22041);")[0]
  $pwY = (Invoke-DbComoSuperadmin "select password_rol from public.aprovisionar_servidor_organizacion('$orgY','host.docker.internal','fixture','no-usar',22042);")[0]

  $credX = (Invoke-Db "select vault.create_secret('$sentinel','fixture-014-x');")[0]
  $credY = (Invoke-Db "select vault.create_secret('$sentinel','fixture-014-y');")[0]
  $credTecnica = (Invoke-Db "select vault.create_secret('$sentinel','fixture-014-tecnica');")[0]
  $credCredencial = (Invoke-Db "select vault.create_secret('$sentinel','fixture-014-credencial');")[0]
  $conX = [guid]::NewGuid().ToString(); $conY = [guid]::NewGuid().ToString()
  $conTecnica = [guid]::NewGuid().ToString(); $conCredencial = [guid]::NewGuid().ToString()
  Invoke-Db "insert into public.conexiones(id,organizacion_id,sistema_externo,credencial_vault_id) values ('$conX','$orgX','fixture-exito','$credX'),('$conY','$orgY','fixture-exito','$credY'),('$conTecnica','$orgX','fixture-tecnica','$credTecnica'),('$conCredencial','$orgX','fixture-credencial','$credCredencial');" | Out-Null

  # Sin -NoNewline: con un array de entrada, ese modificador no solo omite
  # el salto final sino que pega todas las lineas entre si sin separador.
  @("PGHOST=host.docker.internal", "PGPORT=5434", "PGDATABASE=postgres", "PGUSER=worker_$($orgX -replace '-','')", "PGPASSWORD=$pwX") | Set-Content (Join-Path $work 'x.env')
  @("PGHOST=host.docker.internal", "PGPORT=5434", "PGDATABASE=postgres", "PGUSER=worker_$($orgY -replace '-','')", "PGPASSWORD=$pwY") | Set-Content (Join-Path $work 'y.env')
  docker run -d --name spec014-ssh-x -p 127.0.0.1:22041:2222 -e PUBLIC_KEY="$publicKey" -e USER_NAME=fixture -e PASSWORD_ACCESS=false -v /var/run/docker.sock:/var/run/docker.sock -v "$(Join-Path $work 'x.env'):/opt/automation-platform/worker.env:ro" 'automation-platform-template/spec014-fixture-ssh:local' | Out-Null
  docker run -d --name spec014-ssh-y -p 127.0.0.1:22042:2222 -e PUBLIC_KEY="$publicKey" -e USER_NAME=fixture -e PASSWORD_ACCESS=false -v /var/run/docker.sock:/var/run/docker.sock -v "$(Join-Path $work 'y.env'):/opt/automation-platform/worker.env:ro" 'automation-platform-template/spec014-fixture-ssh:local' | Out-Null

  Publish-KestraFlow -Path 'infra/kestra/flows/plantilla-generico.yml' -Namespace 'platform.orquestacion' -FlowId 'plantilla-generico' -Headers $headers
  Publish-KestraFlow -Path 'infra/kestra/flows/plantilla-dedicado.yml' -Namespace 'platform.orquestacion' -FlowId 'plantilla-dedicado' -Headers $headers
  Publish-KestraFlow -Path 'infra/kestra/flows/alertas.yml' -Namespace 'platform.alertas' -FlowId 'alertas' -Headers $headers

  Write-Host 'Disparando escenario de exito (dos organizaciones)...'
  $idExito = Start-KestraExecution -Namespace 'platform.orquestacion' -FlowId 'plantilla-generico' -Inputs @{ sistema_externo = 'fixture-exito'; imagen = $tag } -Headers $headers
  $execExito = Wait-KestraExecution -Id $idExito -Headers $headers
  Save-KestraArtifacts -Id $idExito -Label 'exito' -Headers $headers | Out-Null
  if ($execExito.state.current -ne 'SUCCESS') {
    throw "El escenario de exito termino en $($execExito.state.current), se esperaba SUCCESS."
  }

  Write-Host 'Disparando escenario de falla tecnica...'
  $idTecnica = Start-KestraExecution -Namespace 'platform.orquestacion' -FlowId 'plantilla-dedicado' -Inputs @{ organizacion_id = $orgX; sistema_externo = 'fixture-tecnica'; imagen = $tag } -Headers $headers
  $execTecnica = Wait-KestraExecution -Id $idTecnica -Headers $headers
  $execTecnica = Save-KestraArtifacts -Id $idTecnica -Label 'falla-tecnica' -Headers $headers
  Assert-Clasificacion -Exec $execTecnica -EsperaCredencial $false -Label 'La falla tecnica'

  Write-Host 'Disparando escenario de falla de credencial (con reintento)...'
  $idCredencial = Start-KestraExecution -Namespace 'platform.orquestacion' -FlowId 'plantilla-dedicado' -Inputs @{ organizacion_id = $orgX; sistema_externo = 'fixture-credencial'; imagen = $tag } -Headers $headers
  $execCredencial = Wait-KestraExecution -Id $idCredencial -Headers $headers
  $execCredencial = Save-KestraArtifacts -Id $idCredencial -Label 'falla-credencial' -Headers $headers
  Assert-Clasificacion -Exec $execCredencial -EsperaCredencial $true -Label 'La falla de credencial'

  # Busca el centinela y su variante Base64 en el storage y los temporales
  # internos de Kestra (no solo en lo que la API devuelve) y vuelca el
  # resultado como un artefacto mas: si grep encuentra algo, el reporte
  # contendra el valor y test-secretos-orquestacion.ps1 lo va a detectar.
  $sentinelB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sentinel))
  docker exec $kestra sh -c "grep -rF -e '$sentinel' -e '$sentinelB64' /app/storage /tmp/kestra-wd 2>/dev/null; echo fin-busqueda" |
    Set-Content -Path (Join-Path $artifactDir 'kestra-internal-storage.txt')

  Write-Host 'Verificando cero apariciones del centinela sobre los artefactos reales...'
  $env:CREDENCIAL_CENTINELA = $sentinel
  $testScript = Join-Path $PSScriptRoot 'test-secretos-orquestacion.ps1'
  # Corre como proceso hijo (no `&` en el mismo runspace): su `exit 1` no
  # debe saltear el `finally` de este script y dejar el fixture sin limpiar.
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File $testScript -ArtifactDirectory $artifactDir
  if ($LASTEXITCODE -ne 0) {
    throw 'test-secretos-orquestacion.ps1 detecto una violacion sobre los artefactos reales (ver salida arriba).'
  }

  Write-Host 'OK: recorrido completo sin apariciones del centinela en ninguna ejecucion real.'
}
finally {
  Remove-Item Env:\CREDENCIAL_CENTINELA -ErrorAction SilentlyContinue
  foreach ($name in $containers) { docker rm -f $name 2>$null | Out-Null }
  if (Test-Path $work) { Remove-Item -LiteralPath $work -Recurse -Force }
  # Borra primero organizaciones; las FKs eliminan conexiones/servidores.
  Invoke-Db "delete from public.organizaciones where id in ('$orgX','$orgY');" | Out-Null
  Remove-WorkerRole -OrganizacionId $orgX
  Remove-WorkerRole -OrganizacionId $orgY
  $namesSql = ($vaultSecretNames | ForEach-Object { "'$_'" }) -join ','
  Invoke-Db "delete from vault.secrets where name in ($namesSql);" | Out-Null
}
