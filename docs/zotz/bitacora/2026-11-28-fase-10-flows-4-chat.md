# Flows, parte 4: chat (`zotz/fase-10-flows-4-chat`)

2026-11-28

- **Composer:** `/flow` y el atajo de cada flow (`/revisar-pr`) en el chat nativo estructurado, con el patrón de `/btw` (`src/renderer/src/components/zotz/flow-chat/`). Zotz consume el borrador y nunca llega al agente. `/flow` solo abre un menú; `/flow <slug> texto` y `/<atajo> texto` ponen el texto en `trigger.text`. Si el disparador pide campos, un formulario corto antes de correr. Un atajo que choca con un comando del agente o una skill queda solo por `/flow`. Lógica pura en `src/shared/zotz/flows/zotz-flow-chat-command.ts`.
- **Máquinas:** el menú lista los flows encendidos con disparador `chat_command` de la máquina del chat (`runtimeEnvironmentId` de la sesión) y de esta máquina, en ese orden y agrupados si son distintas; un slug en las dos resuelve al de la máquina del chat. La corrida va por `zotz.flows.run` a la máquina del flow.
- **Contexto:** solo lo que pide el disparador (`lastAnswer`, últimos N mensajes, adjuntos del borrador, workspace/repo/rama/agente). `chat.sessionId` va siempre: es la dirección de vuelta de la tarjeta, de "correr en esta conversación" y de `chat_reply`. `chat.workspace` también va si un nodo Agente usa el workspace del chat. En folder workspaces `repo` y `branch` van en null.
- **Motor:** `runInChatSession` manda el prompt a la sesión del chat (con su propio agente, sin cola de memoria) por el camino de reuso de sesión de las automatizaciones y toma su respuesta como salida, incluido el modo JSON. `workspaceSource: 'chat'` lanza en el workspace del chat. `chat_reply`: _Nota_ deja su texto como salida del paso (la tarjeta la muestra); _Mensaje al agente_ lo manda a la sesión con un id de operación estable. Si el disparador no fue `chat_command`, se salta con nota (`chat_reply_no_chat`). Dependencia nueva `chat` en `ZotzFlowExecutorDeps` (`zotz-flow-chat-driver.ts`).
- **Tarjeta:** cada corrida que disparó el chat entra a la transcripción como fila con hora (mismo mecanismo que las aprobaciones de workers), con el estado en vivo de cada paso (`zotz.flows.subscribe`, una suscripción por máquina), las notas y "Detener flow". RPC nuevo `zotz.flows.chatRuns` para leer las corridas de una conversación al abrirla.

## Decisiones no escritas en el spec

- "Correr en esta conversación" y el mensaje al agente solo funcionan si el flow vive en la misma máquina que el chat: un servidor no puede alcanzar la sesión de la laptop. Si no, el paso falla con un mensaje claro (`chat_elsewhere`). Las notas sí funcionan entre máquinas porque las pinta la tarjeta.
- Cancelar una corrida nunca cierra el chat del usuario. La guarda de bucles cuenta la conversación del usuario como "causada por el flow" solo mientras corre ese paso y 60 s después.
- "Ver corrida" va detrás de `registerZotzFlowRunOpener` (`zotz-flow-run-opener.ts`): la página Flows (parte 2) no expone cómo abrir una corrida; al integrar, la página registra su abridor (`{ hostId, flowId, runId }`, `hostId` como `local` o `runtime:<id>`) y la acción aparece sola.

## Sorpresas / pendientes

- `NativeChatStructuredSession.tsx` está en el tope de 400 líneas del lint: el enganche reemplaza la línea del aviso de cola por `ZotzStructuredChatAddons` y las tarjetas entran por `NativeChatWorkerApprovalTimeline`.
- El chat del móvil todavía no tiene `/flow`.
