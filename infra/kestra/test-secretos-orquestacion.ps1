[CmdletBinding()]
param(
    [string[]] $FlowPath = @(
        'infra/kestra/flows/plantilla-generico.yml',
        'infra/kestra/flows/plantilla-dedicado.yml'
    ),

    # Directorio de artefactos de una ejecución local de Kestra. Si se indica,
    # CREDENCIAL_CENTINELA debe existir solo en el entorno que invoca el arnés.
    [string] $ArtifactDirectory
)

$ErrorActionPreference = 'Stop'

function Get-SecretVariants {
    param([Parameter(Mandatory)][string] $Value)

    $urlEncoded = [uri]::EscapeDataString($Value)
    $base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value))
    return @($Value, $urlEncoded, $base64) | Select-Object -Unique
}

function Find-SecretVariant {
    param(
        [Parameter(Mandatory)][string] $Directory,
        [Parameter(Mandatory)][string[]] $Variants
    )

    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
        throw "No existe el directorio de artefactos: $Directory"
    }

    $matches = foreach ($file in Get-ChildItem -LiteralPath $Directory -File -Recurse) {
        foreach ($variant in $Variants) {
            if (Select-String -LiteralPath $file.FullName -SimpleMatch -Quiet -Pattern $variant) {
                $file.FullName
                break
            }
        }
    }

    return @($matches | Select-Object -Unique)
}

$violations = [System.Collections.Generic.List[string]]::new()
foreach ($path in $FlowPath) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "No existe el flow a verificar: $path"
    }

    $content = Get-Content -LiteralPath $path -Raw
    # El contrato no permite que Kestra obtenga ni transporte la credencial.
    # Estas aserciones fallan contra las plantillas vulnerables de spec 013.
    if ($content -match '(?m)^\s*- id: obtener_credencial_') {
        $violations.Add("${path}: Kestra todavía tiene una tarea de obtención de credencial")
    }

    if ($content -match '(?m)^\s*-e\s+CREDENCIAL=') {
        $violations.Add("${path}: el comando docker recibe CREDENCIAL")
    }

    if ($content -notmatch '(?m)^\s*set -a\s*$' -or $content -notmatch '(?m)^\s*\. /opt/automation-platform/worker\.env\s*$') {
        $violations.Add("${path}: el host SSH no carga la configuracion local del worker")
    }

    # Docker corre en el daemon del servidor remoto; --env-file se resolvería
    # allí y no dentro de la sesión SSH. Se heredan solo nombres de variables
    # ya exportadas: el valor secreto nunca aparece en el comando de Kestra.
    foreach ($variable in @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD')) {
        if ($content -notmatch "--env\s+$variable(?:\s|\\)") {
            $violations.Add("${path}: el worker no hereda $variable desde el entorno local del host")
        }
    }

    if ($content -match '--env-file\s+/opt/automation-platform/worker\.env') {
        $violations.Add("${path}: --env-file no es seguro para un daemon Docker remoto")
    }

    if ($content -match '\{\{\s*outputs\.obtener_credencial_') {
        $violations.Add("${path}: una expresión referencia un output de credencial")
    }

    if ($content -match '(?m)^\s*password:\s*\{\{\s*outputs\.') {
        $violations.Add("${path}: SSH recibe una contraseña desde un output")
    }

    if ($content -notmatch 'privateKey:\s*"\{\{\s*secret\(''ORQUESTACION_SSH_PRIVATE_KEY''\)\s*\}\}"') {
        $violations.Add("${path}: SSH no usa el secreto estático de orquestación")
    }

    if ($content -match '(?m)^\s*motivo:\s*"?\{\{\s*errorLogs\(\)\s*\}\}"?') {
        $violations.Add("${path}: errorLogs() todavía se envía como motivo persistible")
    }

    if ($content -notmatch '(?m)^\s*motivo_sanitizado:\s*(?:"CREDENCIAL_INVALIDA:|FALLA_TECNICA_SANITIZADA)') {
        $violations.Add("${path}: el handler no recibe un motivo sanitizado explícito")
    }
}

if ($ArtifactDirectory) {
    $sentinel = $env:CREDENCIAL_CENTINELA
    if ([string]::IsNullOrWhiteSpace($sentinel)) {
        throw 'Definí CREDENCIAL_CENTINELA solo en el entorno local antes de inspeccionar artefactos.'
    }

    $leaks = Find-SecretVariant -Directory $ArtifactDirectory -Variants (Get-SecretVariants -Value $sentinel)
    if ($leaks.Count -gt 0) {
        $violations.Add("Hay variantes de la credencial centinela en $($leaks.Count) artefacto(s) de Kestra.")
    }
}

if ($violations.Count -gt 0) {
    $violations | ForEach-Object { [Console]::Error.WriteLine($_) }
    exit 1
}

Write-Host 'OK: no se detectaron canales persistibles ni variantes de la credencial centinela.'
