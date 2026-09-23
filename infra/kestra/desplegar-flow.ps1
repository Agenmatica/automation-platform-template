[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$Source,

  [Parameter(Mandatory)]
  [string]$Namespace,

  [Parameter(Mandatory)]
  [string]$FlowId,

  [Parameter(Mandatory)]
  [string]$WebhookKeyEnv,

  [string]$KestraUrl = 'http://127.0.0.1:9082',

  [string]$Username = $env:KESTRA_BASIC_AUTH_USERNAME,

  [string]$Password = $env:KESTRA_BASIC_AUTH_PASSWORD
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
  throw 'Definí KESTRA_BASIC_AUTH_USERNAME y KESTRA_BASIC_AUTH_PASSWORD.'
}

$webhookKey = ([Environment]::GetEnvironmentVariable($WebhookKeyEnv)).Trim()
if ([string]::IsNullOrWhiteSpace($webhookKey)) {
  throw "No existe la variable de entorno $WebhookKeyEnv."
}

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$flow = [System.IO.File]::ReadAllText($sourcePath)
$pattern = '(?m)^(\s*key:\s+")\{\{\s*secret\(''[^'']+''\)\s*\}\}("\s*)$'
$rendered = [regex]::Replace($flow, $pattern, ('${1}' + $webhookKey + '${2}'), 1)

if ($rendered -eq $flow -or $rendered -notmatch '(?m)^\s*key:\s+"[0-9a-fA-F]+"\s*$') {
  throw 'No se encontró una clave webhook renderizable en el flow.'
}

$authBytes = [Text.Encoding]::ASCII.GetBytes("$Username`:$Password")
$auth = [Convert]::ToBase64String($authBytes)
$uri = "$($KestraUrl.TrimEnd('/'))/api/v1/main/flows/$Namespace/$FlowId"
$tempPath = Join-Path ([IO.Path]::GetTempPath()) ("kestra-flow-{0}.yml" -f [guid]::NewGuid())
[IO.File]::WriteAllText($tempPath, $rendered, [Text.UTF8Encoding]::new($false))

try {
  $responseText = & curl.exe -sS --max-time 60 -w "`n%{http_code}" -X PUT -H "Authorization: Basic $auth" -H 'Content-Type: application/x-yaml' --data-binary "@$tempPath" $uri
  $status = [int]($responseText[-1])
  $responseBody = ($responseText[0..($responseText.Count - 2)] -join "`n")

  if ($status -eq 404) {
    $responseText = & curl.exe -sS --max-time 60 -w "`n%{http_code}" -X POST -H "Authorization: Basic $auth" -H 'Content-Type: application/x-yaml' --data-binary "@$tempPath" "$($KestraUrl.TrimEnd('/'))/api/v1/main/flows"
    $status = [int]($responseText[-1])
    $responseBody = ($responseText[0..($responseText.Count - 2)] -join "`n")
  }

  if ($status -lt 200 -or $status -ge 300) {
    throw ("Kestra devolvió HTTP {0}: {1}" -f $status, $responseBody)
  }

  $response = $responseBody | ConvertFrom-Json
  Write-Output ("Desplegado {0}/{1}, revision {2}." -f $Namespace, $FlowId, $response.revision)
}
finally {
  Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  $webhookKey = $null
  $rendered = $null
}
