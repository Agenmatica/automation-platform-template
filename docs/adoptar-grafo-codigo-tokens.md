# Adoptar grafo de código Graphify (ahorro de tokens)

`graphify-out/graph.json` es el mapa consultable del código: nodos = símbolos
(funciones, clases, tablas, índices), aristas = imports/calls con confianza
`EXTRACTED`/`INFERRED`. Los agentes lo consultan en vez de releer archivos.

## Instalar (una vez por máquina)

```powershell
uv tool install "graphifyy[sql]"  # CLI + tree-sitter SQL
graphify install                   # skill global (Claude Code, Codex, OpenCode)
graphify hook install              # auto-rebuild en commit/checkout (por clon)
graphify claude install            # nudge always-on Claude Code (soft)
graphify codex install             # nudge always-on Codex (AGENTS.md)
graphify opencode install          # plugin always-on OpenCode
```

## Generar (por repo, local, 0 tokens)

```powershell
graphify extract . --code-only --no-viz        # solo código, sin LLM
graphify cluster-only . --no-label --no-viz    # GRAPH_REPORT.md sin costo
```

`.gitignore` ya excluye `node_modules/` (se respeta solo); `.graphifyignore`
agrega generados. `graphify-out/` nunca se commitea.

## Usar

```powershell
graphify query "donde se valida X" --budget 1000  # subgrafo acotado (~1k tokens)
graphify path "PaginaRefine" "FlowKestra"         # trazabilidad punta a punta
graphify explain "simbolo"                        # nodo + vecinos
```

Regla en `AGENTS.md`/`CLAUDE.md` ("Mapa memory-first"): orientar por mapa y
`graphify query` antes que `grep` masivo; re-extraer tras `git pull` con
`graphify update .`.
