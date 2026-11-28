# Spec — Fase 10: Flows (automatizaciones con nodos, estilo n8n)

**Estado:** propuesta (2026-11-27), por aprobar por Hugo.
**Reglas del fork:** [`PLAN.md`](../PLAN.md). Diff mínimo contra upstream, lógica nueva en archivos `zotz-*`, no renombrar RPC ni `ORCA_*`, no borrar features de upstream (se ocultan).
**Reemplaza:** la página de Automatizaciones de Orca como punto de entrada. Una automatización pasa a ser un flow de un solo nodo.

## 1. Objetivo

Un apartado **Flows** donde se arma, en un lienzo visual como el de n8n, una cadena de pasos que usa lo que ya hay en Zotz: sesiones de Claude Code, Codex y Antigravity, comandos, servidores, el tablero de tareas y los PRs.

Un flow:

- Arranca por uno o varios **disparadores**: a mano, desde un comando del chat, con un horario o ante un evento.
- Corre en la **máquina asignada** (la local o un servidor), aunque la laptop esté apagada.
- Pasa **datos de un nodo al siguiente**, como texto Markdown para otro agente o como JSON para una salida estructurada.
- Se **reusa**: el mismo flow puede tener varios disparadores y otros flows lo pueden llamar como subflow.

## 2. Decisiones de Hugo (2026-11-27)

1. **Lienzo visual desde la v1.** Nada de una lista de pasos provisional.
2. **Eventos de la v1:** agente terminó, PR abierto o mergeado, tarea cambió de columna y webhook. Además, **comandos en el chat** que disparan un flow con el contexto de esa conversación.
3. **Salida de cada nodo con switch:** _Markdown_ (texto para otro agente) o _JSON_ (salida estructurada con campos definidos).
4. **Las automatizaciones se vuelven flows de un nodo.** No quedan dos sistemas paralelos.
5. **Notificar avisa solo dentro de Zotz** en la v1. Cuando se habilite el teléfono, también llega ahí.
6. **Tope de 20 corridas por hora por flow** por defecto.
7. **Contexto del chat: 20 mensajes** de transcripción por defecto.
8. **Bucles en la v1.** El bucle no limita cuántos agentes arrancan: lo limita la cola de memoria (Fase 8), que hace esperar a los agentes sin matar a ninguno.

## 3. Qué existe en Orca (reusar, no duplicar)

| Pieza                         | Dónde                                                                                                                         | Para qué la usamos                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Modelo de automatización      | `src/shared/automations/automation-definition.ts`                                                                             | Agente, prompt, `launchSetup`, `runContext`, destino local/SSH, `workspaceMode`. El nodo Agente lo copia. |
| Horarios                      | `src/shared/automations/scheduling/*` (rrule, zona horaria, DST, corridas perdidas)                                           | El disparador Programado usa las mismas funciones.                                                        |
| Lanzar y observar una corrida | `src/main/automations/dispatch/automation-launch-runner.ts`, `observation/*` (chat y terminal), `AutomationRunOutputSnapshot` | El nodo Agente lanza y espera igual que una automatización y toma su salida final.                        |
| Chequeo previo                | `src/main/automations/dispatch/precheck-runner.ts`                                                                            | Base del nodo Comando (timeout, exit code, stdout).                                                       |
| Dueño del horario             | `schedulerOwner` (`local_host_service`, `ssh_bridge`, `remote_host_service`)                                                  | Decide en qué máquina vive y corre el flow.                                                               |
| Aprobaciones                  | `src/shared/orchestration/approvals`, `src/cli/orchestration/gates`, `native-chat/worker-approvals`                           | Nodo Aprobación, también desde el celular.                                                                |
| Estado de agentes             | `src/shared/agent-status/contracts/agent-status-types.ts` (`working`, `blocked`, `waiting`, `done`)                           | Evento "agente terminó".                                                                                  |
| PRs y relay                   | `src/main/zotz/github/*`, `src/main/zotz/tasks/zotz-task-relay-client.ts` (relay de webhooks de la Fase 9)                    | Eventos de PR al instante si el relay está prendido; si no, por consulta.                                 |
| Tablero de tareas             | `src/main/zotz/tasks/*` (sync de conectores y `move`)                                                                         | Evento "tarea cambió de columna".                                                                         |
| Comandos locales del chat     | `use-native-chat-side-chat-command.ts` (`/btw`, `/side`) y `native-chat-slash-commands`                                       | Patrón para `/flow`: el comando lo maneja Zotz y nunca llega al agente.                                   |
| Cola por memoria              | `src/main/zotz/memory-governor/zotz-agent-launch-queue.ts`                                                                    | Todo agente de un flow pasa por la cola, con prioridad de automatización.                                 |
| Archivos JSON                 | `src/main/zotz/zotz-json-file.ts` (`SerialJsonWriter`)                                                                        | Guardar flows y corridas.                                                                                 |

Lo que **no** existe y se construye: el grafo, el ejecutor de varios pasos, el paso de datos, los disparadores por evento, el lienzo y el comando `/flow`.

## 4. Modelo

### 4.1 Flow

```ts
type ZotzFlow = {
  id: string
  name: string
  slug: string // para /flow <slug> y la CLI
  description: string
  hostId: string // máquina asignada: 'local' o el id del servidor
  enabled: boolean
  triggers: ZotzFlowTrigger[]
  nodes: ZotzFlowNode[]
  edges: ZotzFlowEdge[] // { id, from: {node, port}, to: {node} }
  concurrency: { max: number; whenBusy: 'queue' | 'skip' } // default { 1, 'queue' }
  createdAt: number
  updatedAt: number
  migratedFromAutomationId?: string
}
```

Se guarda como `zotz-flows.json` en la máquina asignada (§7). El esquema vive en `src/shared/zotz/flows/zotz-flow-contract.ts` con zod y versión (`zotz-flow/v1`), para exportar e importar flows como archivo.

### 4.2 Disparadores

Todos entregan un objeto `trigger` que los nodos pueden leer.

| Disparador       | Configuración                                                       | Lo que entrega en `trigger`                                         |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Manual           | campos de entrada opcionales (nombre, tipo, requerido)              | `inputs`                                                            |
| Comando del chat | qué contexto pide (§6), campos de entrada                           | `chat.*`, `inputs`, `text` (lo escrito después del comando)         |
| Programado       | rrule + zona horaria, como las automatizaciones                     | `scheduledFor`                                                      |
| Agente terminó   | agente, proyecto, workspace, resultado (éxito, error, interrumpido) | `agent`, `workspace`, `lastMessage` (Markdown), `outcome`           |
| PR               | acción (abierto, mergeado), repo, rama base, label, autor           | `pr` (número, título, cuerpo, rama, autor, url, archivos cambiados) |
| Tarea cambió     | fuente, proyecto, columna de origen y de destino                    | `task` (id, título, cuerpo, campos, url), `from`, `to`              |
| Webhook          | ruta propia y token; método POST                                    | `body` (JSON), `headers` (sin el token)                             |
| Llamado por flow | campos de entrada                                                   | `inputs`                                                            |

Un flow puede tener varios disparadores; todos conectan al primer nodo y el nodo puede preguntar cuál fue (`trigger.kind`).

Un disparador de evento **no reacciona a lo que el mismo flow provocó** (por ejemplo, un agente lanzado por el flow que termina), para evitar bucles. Además, cada flow tiene un tope de 20 corridas por hora por defecto.

### 4.3 Nodos de la v1

| Nodo              | Qué hace                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agente            | Lanza Claude Code, Codex o Antigravity con un prompt con plantillas. Elige workspace existente, nuevo por corrida o el del chat; chat o terminal; reusar sesión o no. |
| Comando           | Corre un comando en la máquina asignada, con timeout. Salida: stdout, stderr y exit code.                                                                             |
| Condición         | Si/si no sobre un valor (`==`, `!=`, contiene, mayor/menor, existe, exit code = 0). Dos salidas.                                                                      |
| Switch            | Varias salidas según el valor de un campo.                                                                                                                            |
| Paralelo / Unir   | Abre ramas que corren a la vez; Unir espera a todas (o a la primera).                                                                                                 |
| Aprobación        | Pausa hasta que alguien apruebe o rechace desde Zotz o el celular. Timeout opcional con salida propia.                                                                |
| Esperar           | Pausa un tiempo fijo o hasta una hora.                                                                                                                                |
| HTTP              | Petición a una URL (método, headers, cuerpo). Respeta la política de red de Zotz.                                                                                     |
| Notificar         | Aviso dentro de Zotz. Al habilitar el teléfono, también llega ahí.                                                                                                    |
| Responder en chat | Solo si el disparador fue un comando del chat: deja el resultado en esa conversación (§6.3).                                                                          |
| Plantilla         | Arma un texto Markdown o un JSON a partir de otros nodos, sin llamar a ningún agente.                                                                                 |
| Subflow           | Llama a otro flow y espera su resultado.                                                                                                                              |

Cada nodo tiene además: nombre (único en el flow, se usa en las plantillas), timeout, reintentos (0 a 3) y **qué hacer si falla**: detener el flow, seguir, o salir por un puerto de error.

El **timeout de un nodo Agente empieza cuando el agente arranca**, no mientras espera en la cola de memoria. Esperar en la cola nunca hace fallar un nodo.

### 4.3.1 Nodo Para cada (bucle)

Repite un grupo de nodos una vez por cada elemento de una lista.

- **Lista de entrada:** un arreglo de una salida JSON (`{{listar.json.prs}}`), o las líneas de una salida Markdown (un elemento por línea no vacía).
- **En el lienzo** es un contenedor: los nodos que se arrastran adentro forman el cuerpo del bucle.
- **Dentro del cuerpo** se usan `{{item}}` (o `{{item.campo}}` si es JSON), `{{item.index}}` y `{{item.total}}`.
- **Vueltas en paralelo:** todas arrancan a la vez por defecto y la cola de memoria decide cuántos agentes corren. Opcionalmente se puede marcar _Una por una_ cuando el orden importa o una vuelta depende de la anterior.
- **Si falla una vuelta:** las demás siguen. Al final, el nodo sale por _Completo_ si todas salieron bien o por _Con fallas_ si alguna falló, con la lista de las que fallaron.
- **Salida:** un arreglo JSON con el resultado de cada vuelta, en el orden de la lista, y un Markdown con todos los resultados uno tras otro, para pasárselo a un agente que los resuma.
- **Tope de elementos:** 100 por defecto, configurable, para que una lista mal armada no lance cientos de agentes. Si la lista pasa el tope, el nodo falla antes de lanzar nada.
- **Anidar:** se permite un bucle dentro de otro.
- **Vista de corrida:** el contenedor muestra el avance (por ejemplo `7/10 · 1 falló`) y un selector para ver cada vuelta con sus nodos, entradas y salidas.

### 4.4 Salida de cada nodo: switch Markdown / JSON

Cada nodo que produce texto (Agente, Comando, HTTP, Plantilla) tiene el switch **Formato de salida**:

- **Markdown** (default): la salida es el texto final. Es lo natural para pasarlo como contexto a otro agente.
- **JSON**: se definen los campos esperados (nombre, tipo, requerido, descripción) en el inspector, o se pega un JSON Schema.
  - En el nodo Agente, Zotz agrega al final del prompt la instrucción de terminar con un bloque ` ```json ` que cumpla el esquema. Toma el último bloque de la respuesta y lo valida.
  - Si no cumple, pide una corrección una vez en la misma sesión. Si vuelve a fallar, el nodo falla con el texto recibido a la vista.
  - En Comando y HTTP se parsea stdout o el cuerpo de la respuesta.

### 4.5 Plantillas entre nodos

Sintaxis `{{ ... }}` en prompts, comandos, URLs y cuerpos:

- `{{trigger.text}}`, `{{trigger.pr.title}}`, `{{chat.lastAnswer}}`
- `{{revisar.output}}`: salida Markdown del nodo `revisar`
- `{{revisar.json.riesgo}}`: un campo de su salida JSON
- `{{revisar.status}}`, `{{build.exitCode}}`

El inspector ofrece un selector con lo que hay disponible antes de ese nodo, para no escribirlo a mano.

**Seguridad:** en el nodo Comando, los valores de plantilla **nunca se pegan como texto en el comando**. Se pasan como variables de entorno (`ZOTZ_FLOW_<NOMBRE>`) y el comando las lee. Así un título de PR o el cuerpo de un webhook no pueden inyectar comandos.

## 5. Ejecución

- **Corrida:** guarda el estado de cada nodo (`pending`, `running`, `waiting_approval`, `done`, `failed`, `skipped`), entradas resueltas, salida, duración, intentos y enlaces a la sesión del agente.
- **Persistencia:** `zotz-flow-runs.json` en la máquina asignada, con retención como la de `automation-run-retention.ts` (últimas 200 corridas por flow).
- **Reinicio de Zotz:** los nodos Agente se reenganchan con los observadores de automatizaciones (`retained-run-reconciliation.ts`). Lo que no se pueda reenganchar queda `failed` con "Zotz se reinició durante este paso"; la corrida se puede reanudar desde ese nodo.
- **Concurrencia:** por flow, según `concurrency`. Los agentes entran a la cola por memoria con prioridad de automatización (Fase 8).
- **Cancelar** detiene la corrida y los agentes que lanzó. **Reintentar** vuelve a correr desde el nodo que falló con las mismas entradas.
- **Probar un nodo** desde el lienzo: corre solo ese nodo con las entradas de la última corrida (como "Execute step" de n8n).

El ejecutor vive en `src/main/zotz/flows/` y lanza los agentes reusando el camino de las automatizaciones. **Por verificar en la parte 1:** si `automation-launch-runner.ts` acepta un registro que no esté guardado en la lista de automatizaciones; si no, se agrega un punto de entrada de pocas líneas.

## 6. Comandos del chat

### 6.1 Uso

En el composer del chat, `/flow` abre un menú con los flows que tienen el disparador _Comando del chat_. También cada flow puede registrar su propio atajo: `/revisar-pr`.

- `/flow revisar-pr enfócate en seguridad` corre el flow con ese texto en `trigger.text`.
- Si el flow pide campos de entrada, se abre un formulario corto antes de correr.
- El comando lo maneja Zotz, igual que `/btw`: **nunca se manda al agente**.

### 6.2 Contexto del chat

El disparador declara qué contexto necesita; solo eso se manda:

- `chat.text`: lo escrito después del comando.
- `chat.lastAnswer`: la última respuesta del agente, en Markdown.
- `chat.transcript`: los últimos N mensajes (N configurable, default 20).
- `chat.attachments`: archivos adjuntos del mensaje.
- `chat.workspace`, `chat.repo`, `chat.branch`, `chat.agent`, `chat.sessionId`.

El nodo Agente puede elegir **"Correr en esta conversación"**: en lugar de abrir otra sesión, manda el prompt a la sesión del chat que disparó el flow.

### 6.3 Resultado en el chat

Al disparar, el chat muestra una tarjeta del flow con su estado en vivo y un enlace a la corrida. El nodo _Responder en chat_ elige cómo dejar el resultado:

- **Nota**: aparece en el chat como tarjeta, sin mandarse al agente.
- **Mensaje al agente**: se manda como un mensaje nuevo a la sesión.

## 7. Máquinas, remotos y móvil

- **Asignación:** al crear un flow se elige la máquina (local o un servidor). El flow y sus corridas se guardan **en esa máquina** y su programador vive ahí, como `remote_host_service`. La laptop edita y ve los flows de los servidores por RPC.
- **RPC nuevo** bajo el espacio `zotz.flows.*` (list, get, save, delete, run, cancel, retry, runs, approve). No toca nombres de RPC existentes.
- **CLI:** `zotz flows list | run <slug> [--input k=v] | runs <slug> | export | import`.
- **Webhook:** `POST /zotz/flows/hooks/<id>` en el servidor que ya abre `zotz serve`, alcanzable por Tailscale, con token por flow en el header. Para recibir webhooks públicos se reusa el relay de la Fase 9 (parte 2 de esta fase). **Por verificar en la parte 3:** qué servidor HTTP de `serve` conviene usar.
- **Móvil:** lista de flows, correr a mano (con su formulario), aprobar y ver corridas. Editar el lienzo queda fuera.
- **Folder workspaces:** el nodo Agente funciona en carpetas sin git. "Workspace nuevo por corrida" solo se ofrece en repos git.
- **Multiplataforma:** el nodo Comando usa los wrappers de procesos existentes (PowerShell en Windows, el shell del usuario en macOS y Linux). Ver `docs/agents-md-refs/cross-platform-support.md`.

## 8. Migración de automatizaciones

- Al arrancar la primera vez con Flows, cada automatización se convierte en un flow:
  - Disparador Programado con su rrule y zona horaria.
  - Si tenía chequeo previo: nodo Comando → Condición (exit code = 0) → nodo Agente.
  - Nodo Agente con el mismo agente, prompt, setup, workspace y destino.
- La automatización original queda **apagada, no borrada** (`enabled: false`), con `migratedFromAutomationId` en el flow. Si algo sale mal se puede volver.
- La página de Automatizaciones se oculta; su entrada en la barra lateral abre Flows (regla 4 del plan).
- `zotz automations create` sigue funcionando y crea un flow de un nodo.
- El historial anterior de cada automatización se ve desde su flow como "Corridas anteriores".

## 9. Lienzo

- Librería: **React Flow** (`@xyflow/react`), versión fija. Se agrega a las dependencias.
- **Diseño:** sigue `docs/STYLEGUIDE.md` y los tokens de `src/renderer/src/assets/main.css`; primitivas shadcn de `components/ui`. Nada de colores nuevos.
- **Estructura de la página:**
  - Izquierda: lista de flows y, al editar, el panel de nodos para arrastrar.
  - Centro: el lienzo, con zoom, minimapa, deshacer/rehacer y auto-acomodo.
  - Derecha: inspector del nodo seleccionado (configuración, formato de salida, plantillas con selector, manejo de errores).
  - Arriba: nombre, máquina asignada, encendido, Guardar y Correr.
- **Vista de corrida:** el mismo lienzo con el estado de cada nodo en color y, al hacer clic, sus entradas y salida. Pestaña Corridas con el historial.
- **Validación** antes de guardar: ciclos, nodos sueltos, plantillas que apuntan a nodos que no existen o que vienen después, JSON Schema inválido.
- **Accesibilidad:** Hugo tiene problemas de vista. Texto legible, contraste del styleguide y todo el lienzo usable con teclado (seleccionar, mover, conectar).

## 10. Partes para trabajar en paralelo

Cada parte va en su rama y su PR. La parte 0 va primero porque fija el contrato que usan las demás.

| Parte | Qué                                                                                                                      | Depende de |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 0     | Contrato: tipos y zod de flow, nodos, disparadores, corridas y RPC `zotz.flows.*`                                        | —          |
| 1     | Motor: guardado, ejecutor, nodos (todos menos Responder en chat) con Para cada, plantillas, switch MD/JSON, horario, CLI | 0          |
| 2     | Lienzo: página Flows, editor, inspector, validación, vista de corrida                                                    | 0          |
| 3     | Disparadores por evento: agente terminó, PR, tarea cambió, webhook                                                       | 0, 1       |
| 4     | Chat: `/flow` y atajos, contexto del chat, "correr en esta conversación", tarjeta y Responder en chat                    | 0, 1       |
| 5     | Migración de automatizaciones, ocultar la página vieja y pantallas del móvil                                             | 1, 2       |

Las partes 1 y 2 corren en paralelo apenas se integre la 0. La 3 y la 4, después de la 1.

## 11. Fuera de la v1

- Webhooks públicos por el relay (parte 2 de la fase).
- Credenciales guardadas para el nodo HTTP.
- Editar el lienzo en el celular.
- Plantillas de flows listas para usar (galería).

**Listo cuando:** desde el chat, `/revisar-pr` dispara en la MSI un flow que lanza a Claude para revisar el PR (salida JSON con riesgo), si el riesgo es alto pide aprobación al celular, y luego lanza a Codex con el Markdown de la revisión. La tarjeta en el chat muestra cada paso y el resultado. El mismo flow también corre solo al abrirse un PR, y las automatizaciones que ya existían siguen corriendo como flows de un nodo.
