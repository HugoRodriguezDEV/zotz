# Sesiones flash bajo cada conversación (`zotz-sesiones-flash`)

2026-11-28

- **Problema:** un orquestador con subagentes, workflows, comandos o monitores en segundo plano solo los mostraba en la pestaña Segundo plano del chat abierto; en la barra lateral no se veía nada. Los hijos con sangría solo existían para conversaciones (worktrees) que un agente creó.
- **Sesiones flash** (`ZotzFlashSessions`): bajo cada conversación (y carpeta), con sangría y línea punteada, una fila por trabajo vivo de cualquiera de sus agentes: subagente (su robot), workflow, comando o monitor (ícono), con nombre y lo que está haciendo. Aparecen al arrancar y se van al terminar. Más de 4: "+N más".
- **Clic:** abre la conversación; un subagente se abre en su vista (chat o panel de Claude, igual que las filas de upstream); lo demás abre la pestaña Segundo plano.
- **Fuente:** los `children` que cada agente ya publica en el estado de agentes (chat nativo y CLI), vía `useWorktreeAgentRows` + `buildSubagentChildRows`. Upstream solo listaba `agent`; ahora acepta `kinds` opcional (por defecto igual que antes).
- Verificado: `pnpm tc`, oxlint/oxfmt, pruebas de las piezas tocadas y fixtures `zotz/sidebar/ZotzFlashSessions` (`running`, `many`) en claro y oscuro. **Sin probar con un chat real** corriendo subagentes o monitores.
