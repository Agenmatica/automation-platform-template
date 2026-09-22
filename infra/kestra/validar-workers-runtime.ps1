param([ValidateSet('static','execute')][string]$Mode = 'static')
$ErrorActionPreference = 'Stop'
& node scripts/validar-egress-workers.mjs
if ($LASTEXITCODE -ne 0) { throw 'La politica versionada de egress no es valida.' }
$flows = Get-ChildItem 'infra/kestra/flows' -Filter '*.yml' -Recurse | ForEach-Object { $_.FullName }
foreach ($flow in $flows) {
  $text = Get-Content -Raw $flow
  if ($text -notmatch 'docker run') { continue }
  foreach ($token in @('. /opt/automation-platform/worker.env','--read-only','--tmpfs /tmp','--cap-drop=ALL','--security-opt=no-new-privileges:true','--cpus','--memory','--network','timeout: PT30M')) {
    if ($text -notmatch [regex]::Escape($token)) { throw "$flow no contiene $token" }
  }
  if ($text -notmatch 'Red de egress no autorizada') { throw "$flow no valida la red de egress versionada" }
}
if ($Mode -eq 'execute') {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker no esta disponible.' }
  $fixture = (Resolve-Path 'infra/kestra/fixtures/worker-runtime/worker.sh').Path
  $fixtureImage = 'node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81'
  foreach ($scenario in @(@{ result = 'success'; runs = 34 }, @{ result = 'technical-failure'; runs = 33 }, @{ result = 'invalid-credential'; runs = 33 })) {
    $result = $scenario.result
    $expected = if ($result -eq 'success') { 0 } elseif ($result -eq 'technical-failure') { 42 } else { 43 }
    $shell = "i=1; while [ `$i -le $($scenario.runs) ]; do sh /fixture/worker.sh >/dev/null 2>/dev/null; actual=`$?; [ `$actual -eq $expected ] || exit `$actual; i=`$((i + 1)); done"
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop=ALL --security-opt=no-new-privileges:true --network none -e "FIXTURE_RESULT=$result" -v "${fixture}:/fixture/worker.sh:ro" $fixtureImage sh -c $shell 1>$null 2>$null
    $actual = $LASTEXITCODE
    $ErrorActionPreference = $previous
    if ($actual -ne 0) { throw "Fixture $result fallo: se esperaban $($scenario.runs) ejecuciones con codigo $expected, recibido $actual" }
  }
  & docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop=ALL --security-opt=no-new-privileges:true --network none $fixtureImage node -e 'setTimeout(() => process.exit(124), 2000)' 1>$null 2>$null
  if ($LASTEXITCODE -ne 124) { throw "El fixture de timeout debia devolver 124 y devolvio $LASTEXITCODE" }
  $cancelName = "worker-runtime-cancel-$PID"
  $cancelId = (docker run -d --rm --name $cancelName --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop=ALL --security-opt=no-new-privileges:true --network none $fixtureImage sh -c 'sleep 30').Trim()
  Start-Sleep -Milliseconds 300
  docker kill $cancelId | Out-Null
  $cancelled = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker inspect $cancelId 1>$null 2>$null
    $inspectExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previous
    if ($inspectExitCode -ne 0) {
      $cancelled = $true
      break
    }
    Start-Sleep -Milliseconds 250
  }
  if (-not $cancelled) {
    docker rm -f $cancelId 1>$null 2>$null
    throw 'El fixture de cancelacion dejo un contenedor activo.'
  }
  & docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop=ALL --security-opt=no-new-privileges:true --network none $fixtureImage node -e "fetch('https://example.com', { signal: AbortSignal.timeout(3000) }).then(() => process.exit(1)).catch(() => process.exit(0))" 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'El fixture de egress pudo alcanzar una red externa con --network none.' }
  Write-Host 'Fixture Docker ejecutado 100 veces, con timeout, cancelacion y sin red externa.'
} else { Write-Host "Contrato estatico OK para $($flows.Count) flows (Windows Docker Desktop/WSL2 o Linux Engine)." }
