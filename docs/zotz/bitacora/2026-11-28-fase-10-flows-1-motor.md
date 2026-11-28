# Flows, parte 1: motor (`zotz/fase-10-flows-1-motor`)

2026-11-28

- `src/main/zotz/flows/`: guardado (`zotz-flows.json`, `zotz-flow-runs.json` con `SerialJsonWriter`, 200 corridas por flow), ejecutor del grafo (estados, reintentos, `onError`, timeout, cancelar, reintentar desde el nodo fallido, reanudar tras reinicio), concurrencia por flow, tope por hora, guarda de bucles, programador (`schedule`) y todos los nodos menos `chat_reply`. RPC `zotz.flows.*` en `src/main/runtime/rpc/methods/zotz/zotz-flows.ts` (capacidad `zotz.flows.v1`) y CLI `zotz flows list|run|runs|export|import`.
- Punto de entrada único: `startZotzFlowRun(flowId, trigger, origin, options?)` en `zotz-flow-runtime.ts`. La marca de origen se lee con `findZotzFlowOrigin({ chatSessionId, terminalPaneKey, terminalPtyId, workspaceId })`; la parte 3 la pasa como `{ source: 'event', causedBy }` y el motor rechaza el evento si el flow (o uno que lo llamó como subflow) lo causó.
- El nodo Agente lanza un registro de automatización **no guardado**: el runner no lo aceptaba para Chat en workspace nuevo (la verificación de procedencia busca la automatización guardada), así que `launchAutomationChatAgent` recibe `unsaved: true` y omite esa procedencia (cambio de pocas líneas). La corrección JSON va a la misma sesión por los caminos de reuso de sesión de las automatizaciones (chat y terminal).
- Cola de memoria: el nodo espera con prioridad de automatización (`queued`) y su timeout empieza al ser admitido; `ZotzAgentLaunchQueue.grantPass` deja pasar una vez el lanzamiento que sigue, para que no espere dos veces.

## Decisiones no escritas en el spec

- `subflow` devuelve la salida de los últimos pasos de nivel superior del flow llamado: si terminó uno, su salida tal cual; si varios, Markdown con `## nombre` y JSON con un objeto por nombre.
- `continue` sale por `main`, o por el puerto "negativo" si no hay `main` (`false`, `default`, `rejected`, `with_failures`).
- Un Comando con exit code distinto de 0 no falla: es un resultado que lee la Condición. HTTP fuera de 2xx sí falla (con el cuerpo a la vista). Las variables `env` llegan en mayúsculas: `ZOTZ_FLOW_<NOMBRE>`.
- Reintentar crea una corrida nueva (`resumedFromNodeId`) que conserva lo anterior al nodo y las vueltas ya terminadas de un bucle reiniciado.
- Corridas manuales y de subflow corren aunque el flow esté apagado; horario y eventos no. El tope por hora cuenta todas las corridas que no se saltaron.
- Notificar en un servidor sin escritorio deja el aviso solo en la salida del paso.
- Contrato: se agregó el código `duplicate_slug` a `ZotzFlowProblemCode` (el host lo devuelve al guardar).
