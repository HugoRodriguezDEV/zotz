# Flows, parte 3: disparadores por evento (`zotz/fase-10-flows-3-eventos`)

2026-11-28

- `src/main/zotz/flows/zotz-flow-event-triggers.ts`: registro que arranca con el motor (`zotz-flow-startup.ts`) en la máquina donde viven los flows. Cada fuente corre solo mientras algún flow encendido la escucha y se rehace al guardar, apagar o borrar un flow. Todas inician por `service.startRun` con `{ source: 'event', causedBy }`; el tope por hora y la guarda de bucles los aplica el motor. Un evento da una sola corrida por flow aunque dos de sus disparadores lo acepten.
- **Agente terminó** (`zotz-flow-agent-finished-source.ts`): terminales por `runtime.agentTransitions` con `TerminalAgentTurnNews` (las mismas reglas que el aviso al celular); chats por `subscribeTurnCompletions` del host de chats, que se sigue aunque se instale tarde. `causedBy` sale de `findZotzFlowOriginMark` con el `terminalPaneKey` o el `chatSessionId` y el workspace. `lastMessage`: respuesta aceptada completa, si no la transcripción (`readNativeChatTranscriptTail`; en chats, la historia del journal), si no la vista previa.
- **PR** (`zotz-flow-pull-request-source.ts`): avisos `pull_request` del relay (el cliente del relay suma `onNotices` y hace long-poll mientras un flow escucha); con el relay apagado o fallando, consulta cada 2 min por GraphQL (`gh`) de los repos que piden los disparadores, o de los repos locales si uno no nombra repo. Dedupe en `zotz-flow-events.json` por `pr:<repo>#<n>:<acción>`; la primera lectura de un repo solo marca desde cuándo hay noticias y un evento de más de 24 h no dispara.
- **Tarea cambió**, feeds externos (`zotz-flow-task-moved-source.ts`): el servicio de conectores avisa cada documento nuevo (sync, import, `move`) con el anterior; se compara la columna `Status` de cada tarea. Primera carga, tareas nuevas y borradas no disparan. Con el tablero cerrado, los feeds URL se releen cada 5 min mientras un flow escucha.
- **Tarea cambió**, GitHub Projects v2 (`zotz-flow-project-moved-source.ts`): en main, sin depender del tablero. Lee cada 2 min los Projects del tablero (settings `zotzTaskBoardSources`) que nombra el filtro `source` del disparador (todos si no nombra ninguno; también acepta la clave `github.com/organization/acme/3`), y relee al instante con los avisos `projects_v2_item` del relay. Usa la misma lectura que el tablero: `readZotzBoardProjectTable` (movida a `src/shared/zotz/tasks/zotz-task-board-project-table.ts`, la usan el renderer y main) y la columna de `projectRowStatusName`. La última columna de cada tarea se guarda en `zotz-flow-events.json`: la primera lectura solo marca la base y cada cambio dispara una vez, también tras reiniciar (un cambio hecho con Zotz apagado se avisa una vez en la primera lectura).
- **Webhook** (`zotz-flow-webhook.ts`): `POST /zotz/flows/hooks/<id del disparador>` en el servidor HTTP del `WebSocketTransport` (el de `zotz serve` y del pareo del escritorio, puerto 6768 por defecto), enganchado con una línea en `ws-transport.ts`. Token en `X-Zotz-Flow-Token` (o `Authorization: Bearer`), comparado por digest con `timingSafeEqual`; cuerpo JSON de hasta 1 MB; responde `202 { runId, status }`. Hereda el filtro de origen de `serve` (solo la máquina y Tailscale).

## Decisiones no escritas en el spec

- Resultado del agente: `failure`, `interruption` y `unconfirmed` cuentan como `error`; `cancellation` y `superseded` como `interrupted`; sin veredicto, `success`. Un turno que se detuvo esperando al usuario no cuenta como terminado.
- Los filtros de texto aceptan el id o el nombre (sin mayúsculas): proyecto = id o nombre del repo (o de la carpeta), workspace = id, nombre o ruta, fuente = id del conector, id o nombre de la fuente, columna = id o nombre de la opción.
- `workspace.branch` sale de `showManagedWorktree` del runtime (sin `refs/heads/`); es `null` en folder workspaces y en HEAD separado.
- PR y tarea no traen sesión de Zotz, así que van con `causedBy: null`; el tope por hora acota un flow que abre PRs o mueve tareas.

## Sorpresas / pendientes

- Los repos remotos por SSH no se consultan para PRs de disparadores sin repo explícito.
