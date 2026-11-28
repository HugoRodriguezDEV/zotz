# Aparatos pixelados para lo que no es agente (`zotz-procesos-pixel`)

2026-11-27

- **Problema:** comandos, monitores, programas OSC 7501 y workspaces sin agente salían como robot, igual que un agente.
- **Motor nuevo** junto al de los robots (`zotz/agent-sprite/zotz-process-sprite-*.ts`, `ZotzProcessSprite`): mismo hueco de 32×22, reloj compartido, tema y movimiento reducido. El ciclo del canvas pasó a `use-zotz-row-sprite-canvas.ts` y lo usan robots y aparatos.
- **Tareas en segundo plano** (Claude, Codex y Grok): comando = terminal, monitor = radar, flujo = tablita de pasos, desconocido = engrane, en la tira del chat, el panel de segundo plano, las filas hijas de la barra lateral y la línea de tarea del transcript. Las de tipo `agent` y la cola de memoria siguen con robot.
- **Workspace sin agente** (`StatusIndicator`): `active` = servidor con luces verdes, `inactive` = servidor apagado con luz ámbar; `monitoring` = radar, igual que la fila de conversación en `monitoring`.
- **Programas OSC 7501:** chip con núcleo, barra de progreso y candado / "?" / llave. Una fila es de programa si trae la faceta `programStatus` y su `agentType` no es un agente conocido (id del catálogo `TUI_AGENT_CONFIG`, su comando de arranque como `dsh-tui`, o `dsb`): el proyector ya traduce el `app` de los agentes conocidos a su id y los hooks siempre nombran el suyo. No cambia el protocolo ni lo que recibe la app móvil.
- Enganches de una línea (`zotzProcess`) en `AgentStateDot`, `AgentChildRowContent`, `NativeChatBackgroundTaskRun`, `worktree-card-compact-agent-row` y `DashboardAgentRow`.
- Verificado con fixtures en claro y oscuro (`zotz/agent-sprite/ZotzProcessSprite:*`, `zotz/background/ZotzBackgroundPanel:everyKind`, `zotz/sidebar/ZotzProjectSidebar:onlyProcessesLeft`; capturas en `capturas/procesos-pixel/`). **Sin probar en la app:** tareas reales de Codex/Grok y un programa real que emita OSC 7501.
