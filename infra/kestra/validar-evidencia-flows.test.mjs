// Contrato estático de observabilidad de las plantillas de despacho y de la
// limpieza de evidencia (spec 20260925-133820). No reemplaza la ejecución real
// de validar-evidencia-e2e.mjs: fija las piezas que esa ejecución ejercita.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const plantillas = ['infra/kestra/flows/plantilla-dedicado.yml', 'infra/kestra/flows/plantilla-generico.yml'];
const leer = async (file) => (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');

// Devuelve el bloque YAML que empieza en la línea `- id: <id>` y termina en el
// siguiente elemento de la misma indentación o menor.
function bloqueTarea(content, id) {
  const lines = content.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^\\s*- id: ${id}$`).test(line));
  assert.notEqual(start, -1, `falta la tarea ${id}`);
  const indent = lines[start].indexOf('-');
  const end = lines.findIndex((line, index) => index > start && line.trim() && (line.search(/\S/) < indent || (line.search(/\S/) === indent && line.trimStart().startsWith('- '))));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

for (const file of plantillas) {
  test(`${file} publica los logs del despacho como output en éxito y error`, async () => {
    const content = await leer(file);
    assert.match(content, /-e KESTRA_EJECUCION_ID="\{\{ execution\.id \}\}"/);
    const finalDeFlow = content.slice(content.lastIndexOf('\nfinally:\n'));
    assert.ok(content.includes('\nfinally:\n'), 'falta el finally de flow');
    const logs = bloqueTarea(finalDeFlow, 'publicar_logs');
    assert.match(logs, /type: io\.kestra\.plugin\.core\.log\.Fetch/);
    assert.match(logs, /tasksId:\n\s+- despacho_ssh/);
    assert.match(logs, /allowFailure: true/);
    assert.match(logs, /allowWarning: true/);
  });
}
