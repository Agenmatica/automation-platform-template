[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$Source,

  [Parameter(Mandatory)]
  [string]$Output,

  [ValidateRange(1, 1000)]
  [int]$Concurrencia = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Concurrencia -eq 0) {
  if ([string]::IsNullOrWhiteSpace($env:KESTRA_ORQUESTACION_CONCURRENCIA)) {
    throw 'Definí KESTRA_ORQUESTACION_CONCURRENCIA o pasá -Concurrencia.'
  }

  if (-not [int]::TryParse($env:KESTRA_ORQUESTACION_CONCURRENCIA, [ref]$Concurrencia) -or $Concurrencia -lt 1 -or $Concurrencia -gt 1000) {
    throw 'KESTRA_ORQUESTACION_CONCURRENCIA debe ser un entero entre 1 y 1000.'
  }
}

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$flow = Get-Content -LiteralPath $sourcePath -Raw
$replacement = "    concurrencyLimit: $Concurrencia"
$rendered = [regex]::Replace($flow, '(?m)^    concurrencyLimit: \d+$', $replacement, 1)

if ($rendered -eq $flow) {
  throw 'No se encontró el campo concurrencyLimit esperado para renderizar.'
}

$outputPath = [System.IO.Path]::GetFullPath($Output)
$outputDirectory = Split-Path -Parent $outputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

[System.IO.File]::WriteAllText($outputPath, $rendered, [System.Text.UTF8Encoding]::new($false))
