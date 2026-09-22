import fs from 'node:fs';
import process from 'node:process';

const reportPath = process.argv[2];
const exceptionsPath = process.argv[3];
if (!reportPath) {
  throw new Error('Uso: node scripts/validar-scan-worker.mjs <reporte.json>');
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const exceptions = exceptionsPath
  ? JSON.parse(fs.readFileSync(exceptionsPath, 'utf8')).exceptions ?? []
  : [];
const blocked = new Set(['CRITICAL', 'HIGH', 'critical', 'high']);
const findings = [];

function collect(value) {
  if (!value || typeof value !== 'object') return;
  if (blocked.has(value.severity)) findings.push(value);
  for (const child of Object.values(value)) collect(child);
}

collect(report);
const now = Date.now();
const unresolved = findings.filter((finding) => {
  const id = finding.id ?? finding.vulnerabilityId ?? finding.cve ?? finding.CVE;
  return !exceptions.some((exception) =>
    exception.id === id &&
    exception.approved_by &&
    exception.reference &&
    exception.justification &&
    Date.parse(exception.expires_at) > now,
  );
});

if (unresolved.length) {
  process.stderr.write(`El reporte contiene ${findings.length} vulnerabilidad(es) crítica(s)/alta(s).\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Scan sin vulnerabilidades críticas o altas.\n');
}
