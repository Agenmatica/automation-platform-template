import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function run(report, exceptions) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-scan-'));
  const reportPath = path.join(directory, 'report.json');
  const exceptionsPath = path.join(directory, 'exceptions.json');
  fs.writeFileSync(reportPath, JSON.stringify(report));
  fs.writeFileSync(exceptionsPath, JSON.stringify({ exceptions }));
  try {
    execFileSync('node', ['scripts/validar-scan-worker.mjs', reportPath, exceptionsPath], { stdio: 'pipe' });
    return 0;
  } catch (error) {
    return error.status;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const finding = { vulnerabilities: [{ id: 'CVE-FIXTURE', severity: 'HIGH' }] };
test('bloquea una vulnerabilidad sin excepción', () => assert.equal(run(finding, []), 1));
test('acepta únicamente una excepción aprobada y vigente', () => assert.equal(run(finding, [{
  id: 'CVE-FIXTURE', approved_by: 'security@example.test', reference: 'SEC-1',
  justification: 'fixture', expires_at: '2099-01-01T00:00:00Z',
}]), 0));
test('bloquea una excepción vencida', () => assert.equal(run(finding, [{
  id: 'CVE-FIXTURE', approved_by: 'security@example.test', reference: 'SEC-1',
  justification: 'fixture', expires_at: '2000-01-01T00:00:00Z',
}]), 1));
