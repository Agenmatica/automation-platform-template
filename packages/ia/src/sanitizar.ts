const clavesProhibidas = /password|secret|token|cookie|authorization|session/i

export function sanitizarDato(valor: unknown, permitidos: readonly string[]): unknown {
  if (Array.isArray(valor)) return valor.map((item) => sanitizarDato(item, permitidos))
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>)
      .filter(([clave]) => permitidos.includes(clave) && !clavesProhibidas.test(clave))
      .map(([clave, dato]) => [clave, sanitizarDato(dato, permitidos)]))
  }
  return valor
}

export function redactarSecretos(texto: string, secretos: readonly string[]): string {
  return secretos.filter(Boolean).reduce((resultado, secreto) => resultado.replaceAll(secreto, '[REDACTADO]'), texto)
}

// Delimitador con nonce aleatorio por invocación, no una etiqueta de texto
// fija: un atacante que controla el contenido envuelto podría incluir una
// etiqueta fija dentro de su propio texto para falsificar dónde termina el
// dato y empieza una instrucción fabricada. Con un nonce que no conoce de
// antemano, no puede reproducir el delimitador real (research.md, spec
// saneamiento-contenido-ia). No es garantía absoluta — un modelo puede ser
// persuadido en lenguaje natural a ignorarlo igual — pero es la mitigación
// de delimitador recomendada frente a una etiqueta fija.
export function marcarContenidoNoConfiable(texto: string): string {
  const nonce = crypto.randomUUID()
  return `<datos-no-confiables nonce="${nonce}">${texto}</datos-no-confiables-${nonce}>`
}

export function clavesActivadas(clavesNoConfiables: readonly string[] | undefined, entrada: Record<string, unknown>): readonly string[] {
  if (!clavesNoConfiables) return []
  return clavesNoConfiables.filter((clave) => typeof entrada[clave] === 'string')
}
