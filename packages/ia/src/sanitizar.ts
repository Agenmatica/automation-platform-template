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
