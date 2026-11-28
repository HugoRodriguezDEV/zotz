# Flows, parte 0: contrato (`zotz/fase-10-flows-0-contrato`)

2026-11-28

- `src/shared/zotz/flows/`: esquemas zod `zotz-flow/v1` (flow, disparadores, nodos, puertos), tipos de corrida, parser de plantillas `{{ }}` y validación pura del grafo. Parámetros RPC `zotz.flows.*` en `src/shared/rpc-contract/zotz/zotz-flows-params.ts`; el catálogo generado no cambia hasta que la parte 1 registre los handlers.
- El nodo Agente reusa los esquemas zod de `automation-params.ts` (`TuiAgent`, `WorkspaceRunContext`, `AutomationCanonicalLaunchSetup`, `SetupDecision`, `ExecutionHostId`, `AutomationSchedule`).

## Decisiones no escritas en el spec

- Un nodo con varias entradas corre cuando todas sus entradas terminaron o se saltaron, y se salta si ninguna llegó; `join` solo hace falta para "esperar a la primera".
- Un flow puede tener varios nodos raíz: todos arrancan con el disparador. Un nodo sin ninguna conexión, cuando hay otros nodos, es error.
- El cuerpo de un `for_each` son los nodos con `parentId`; las aristas no cruzan el borde del bucle, el bucle entra a los nodos raíz del cuerpo y el cuerpo debe terminar en un solo nodo (la salida de cada vuelta).
- Una plantilla solo puede leer nodos que corren antes con seguridad (ancestros por aristas, más los ancestros de los bucles que lo contienen); ramas paralelas no cuentan.
- El nodo Comando no acepta plantillas en su texto: los valores van en `env` (`ZOTZ_FLOW_<NOMBRE>`).
- Puertos de Aprobación: `approved`, `rejected` y `timeout` (solo si tiene `timeoutSeconds`). Cualquier nodo con `onError: 'error_port'` suma el puerto `error`.
- `maxRunsPerHour` es un campo del flow (default 20). El token del webhook se guarda en el disparador y su ruta es `/zotz/flows/hooks/<id del disparador>`.
