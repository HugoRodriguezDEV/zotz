# Spec — Nombre corto y enlaces entre conversaciones

Que dos o más conversaciones (de cualquier proyecto, en la Mac o en un servidor como la MSI) trabajen juntas y se escriban por un nombre corto (`salmon`, `albatross`), no por id. Rama: `zotz-comunicacion-entre-agentes`. Reglas del fork: [`PLAN.md`](../PLAN.md) (diff mínimo contra upstream, lógica nueva en archivos `zotz-*`, no renombrar RPC ni `ORCA_*`).

## 1. Lo que ya existe (verificado 2026-11-20)

- **Mensajería entre agentes:** `zotz orchestration send --to orca_session_id:<id> --subject … --body …` entrega a cualquier conversación del host, sin importar proyecto o worktree. Probado: el mensaje llega al chat como turno nuevo y trae el comando `orchestration reply --id …`. `--on <server>` lleva el correo a un agente de un servidor emparejado; la respuesta regresa sola.
- **Entrega en chats vivos:** `structured-mailbox-pointer-delivery.ts`, `structured-mail-source.ts` (`structuredMailMessage`), `send-agent-turn.ts`.
- **Direcciones de grupo** (`@all`, `@idle`, `@worktree:<id>`, `group-addressing.ts`): solo alcanzan miembros de un Run. Fuera de un Run, `@worktree:<id>` falla con `terminal_not_found`.

## 2. Problemas

1. **Solo por id.** No hay forma de decir "escríbele a salmon". El agente tiene que conocer `orca_session_id:claude_f89f…`.
2. **No hay listado.** Ningún comando ni RPC lista las conversaciones vivas con su dirección (no existe `agentSession.list`; `terminal list` solo ve terminales).
3. **El nombre corto no se ve.** La fila de `ZotzConversationRow` muestra título (`displayName`, lo pone la IA) y rama; el nombre de la carpeta (`salmon`) no aparece.
4. **No hay "enlazar".** Los agentes no saben con quién colaboran; el usuario tiene que pasar ids a mano.

## 3. Decisiones (Hugo, 2026-11-20)

- **Nombre corto = carpeta, editable.** Por default el basename de la ruta del worktree; se puede cambiar por un alias propio.
- **Enlazar = se conocen y hablan.** Al enlazar, cada agente recibe un aviso con sus compañeras y cómo escribirles. Ellos deciden cuándo hablar. Sin resúmenes automáticos.
- **Cada entorno habla dentro de sí mismo por default.** Una conversación de la Mac encuentra, lista y enlaza solo conversaciones de la Mac; una de la MSI, solo de la MSI. Nada cruza de entorno solo.
- **Cruzar de entorno es decisión de la persona, y está en v1.** Se puede enlazar `albatross` (Mac) con `tarpon` (MSI Server), pero solo si el usuario lo elige explícitamente (en el diálogo de enlazar o pidiéndoselo al agente). Un agente nunca usa `--on` por iniciativa propia.
- **Unidad de enlace = fila de la barra (worktree)**, no la sesión de chat: es lo que el usuario ve y lo que lleva el nombre corto. El mensaje se entrega a la conversación viva de ese worktree (§4.3).

## 4. Diseño

### 4.1 Nombre corto

- **Se guarda en un store propio de Zotz, no en `WorktreeMeta`.** Un campo nuevo en `WorktreeMeta` tendría que pasar por ~10 proyecciones de upstream (`mergeWorktree`, feed de la barra, filas de servidores, carpetas…). En su lugar, cada host guarda sus alias en `zotz-short-names.json` (userData), por **ruta** del worktree, que es igual en todos los clientes. Store: `src/main/zotz/zotz-short-name-store.ts`.
- RPC nuevas (solo se agregan, permiso `workspace`): `zotz.shortNames.list` y `zotz.shortNames.set` (`shortName` vacío vuelve al nombre de la carpeta). Capability `zotz.short-names.v1`; un servidor sin ella muestra nombres de carpeta y no se pueden editar. Local y remoto usan el mismo camino (`callRuntimeRpc`).
- Valor efectivo: alias propio o `slug(basename(path))`. Función pura `resolveZotzShortNames` en `src/shared/zotz/zotz-short-name.ts`; la usan la barra y, en la PR 2, el resolvedor de `wt:`.
  - Formato: minúsculas, `[a-z0-9-]`, 1–32 caracteres. Al editar se normaliza (`Mi Proyecto` → `mi-proyecto`).
  - Único **por host**. El alias propio gana; un nombre de carpeta repetido toma sufijo (`rodri-2`), ordenando por ruta para que todos los clientes coincidan. El servidor rechaza un alias que ya use otro alias; el diálogo además avisa si choca con un nombre de carpeta.
- CLI `zotz worktree set --short-name` y selector `short:<nombre>`: pasan a la PR 2, junto con `wt:`.

### 4.2 Que se vea

- `ZotzConversationRow.tsx`, segunda línea: `salmon · zotz/fase-9-tareas · 1 min`. La rama se omite si es igual al título (como antes) o si su último segmento es el nombre corto (`fix/login` en la carpeta `login`).
- Editar: opción "Short name…" en el menú de la fila (`ZotzConversationMenu`), que abre `ZotzShortNameDialog`. No se toca `WorktreeMetaDialog` de upstream.
- Filas enlazadas: ícono de cadena (`Link2` de lucide) junto al título; tooltip con las compañeras (`Enlazada con salmon, tarpon · MSI Server`).
- Textos visibles con default en inglés en el código, como el resto de `zotz.*`. Tokens y componentes de `STYLEGUIDE.md`.

### 4.3 Dirección por nombre

- Prefijo nuevo en `--to`: `wt:<nombre>`. **Se resuelve solo en el entorno de quien manda.** Si `salmon` existe en otro entorno pero no en el propio, el error lo dice ("salmon no existe aquí; está en MSI Server") y no se manda nada.
- Otro entorno solo con el `--on` existente, puesto a propósito: `--to wt:tarpon --on "MSI Server"`. El agente lo usa solo si la persona se lo pidió o si hay un enlace cruzado que ella creó (§4.5).
  - Se usa prefijo y no nombre pelón para no chocar con handles heredados ni con grupos (`@codex`).
- Resolución (`src/main/zotz/conversation-links/zotz-short-name-recipient.ts`, enganchada con pocas líneas en `send-methods.ts` antes de `prepareSessionRecipient`):
  1. Nombre corto → worktree del host.
  2. Worktree → sesiones de agente vivas en él (registros de `agent_session_records` con `location.workspaceId` igual + pestaña abierta).
  3. Una sola → `orca_session_id:<id>`. Varias → la de la pestaña activa del worktree; si no se puede decidir, error `recipient_ambiguous` que lista nombre y dirección de cada una. Ninguna → error `recipient_unreachable` que lo dice ("salmon no tiene una conversación abierta").
- `reply` no cambia: ya responde al remitente por id.

### 4.4 Listado

- RPC nueva `zotz.conversations.list` (solo se agrega; permiso `workspace`) en `src/main/runtime/rpc/methods/zotz/zotz-conversations.ts`. Devuelve por conversación: nombre corto, título, proyecto, agente, ocupada/libre, pestaña abierta, dirección (`orca_session_id:…`), enlaces.
- Capability `zotz.conversations.v1` para que la laptop sepa si el servidor la soporta.
- CLI `zotz agent list [--environment <server>] [--json]`. Sin `--environment` lista la máquina local; con él, ese servidor.

### 4.5 Enlaces (diseño final, 2026-11-21)

- **Dónde viven los grupos:** en la máquina con la UI donde se enlazan, en `GlobalSettings.zotzConversationLinks` (`{ id, members: [{ hostId, path }], createdAt }`). `hostId` es desde esa máquina (`local` o `runtime:<servidor>`).
- **Qué sabe cada host:** por cada worktree suyo, la lista de compañeras (`zotz.links.setPeers { path, peers }`, store `src/main/zotz/conversation-links/zotz-link-peer-store.ts`). La UI la empuja a cada máquina con miembros cuando un grupo cambia.
- **Cómo llega cada agente a sus compañeras** (`reach`), visto desde su propia máquina:
  - misma máquina → `direct`: `zotz orchestration send --to wt:<nombre>`.
  - la Mac hacia un servidor → `on-server`: `--to wt:<nombre> --on "<servidor>"`.
  - un servidor hacia la Mac → `reply-only`: el servidor no puede iniciar correo a la Mac (§5 confirmado), así que contesta con `orchestration reply` cuando le escriben.
  - Dos servidores distintos no van en el mismo grupo (no se pueden escribir); la UI lo bloquea con una explicación.
- **Aviso a los agentes:** `setPeers` deja en el buzón de la conversación viva un correo `status` con sus compañeras y cómo escribirles; con lista vacía avisa que el enlace terminó. Si la conversación arranca después (o tras `/clear`), recibe el aviso al iniciar, una vez por sesión.

### 4.6 Vista "Conversaciones enlazadas" (barra derecha)

- Pestaña `zotz-links` junto a Segundo plano (`src/renderer/src/components/zotz/links/`).
- Arriba, el grupo de la conversación abierta: cada miembro con su estado (trabajando, esperando, terminó), agente y máquina; clic abre ese chat; desenlazar por miembro o "Salir del grupo".
- En medio, los mensajes entre ellas en orden (`zotz.links.messages` en cada máquina con miembros, unidos por id).
- Abajo, todas las conversaciones agrupadas por máquina (esta y cada servidor emparejado) con "Enlazar" de un clic. Un servidor sin `zotz.links.v1` sale con "Actualiza Zotz en … para enlazar".
- Las filas enlazadas llevan un ícono de cadena en la barra lateral.

### 4.7 Compatibilidad y seguridad

- Campos y RPC nuevos opcionales y solo agregados. No se tocan nombres de RPC existentes ni la tabla móvil (`runtime-rpc-mobile-method-routing.ts`); móvil fuera de v1.
- Servidor sin las capabilities: sus conversaciones salen en el diálogo como "Actualiza MSI Server para enlazar" y no se pueden elegir.
- Las RPC nuevas exigen permiso `workspace`, como `orchestration.send`. No exponen contenido de conversaciones: solo nombre, título, agente, estado y dirección.

## 5. Riesgo por verificar primero

Solo aplica a enlaces cruzados (opt-in); dentro de un mismo entorno no hay riesgo.

**MSI → Mac sin pregunta previa.** `--on` lleva correo de la laptop al servidor y las respuestas regresan porque la laptop las recoge (`peer-mail-waiters.ts`, `held-peer-conversations.ts`). Falta confirmar que un agente en la MSI puede **iniciar** un mensaje a una conversación de la Mac (la Mac no es servidor). Primer paso de la PR 3: probarlo. Si no se puede, la MSI deja el correo en un buzón del grupo de enlace y la laptop lo jala con el mismo mecanismo de recogida.

## 6. Fases y PRs

1. **PR 1 — Nombre corto:** store y RPC por host, función pura, segunda línea de la fila, diálogo desde el menú.
2. **PR 2 — Dirección y listado local:** `wt:<nombre>`, `worktree set --short-name`, `zotz.conversations.list`, `zotz agent list`.
3. **PR 3 — Enlaces:** store, avisos, menú/diálogo, ícono; local y remoto (con la verificación de §5).
4. **PR 4 — Skill:** sección corta en la guía de orquestación: "Hablar con otra conversación" (`agent list`, `send --to wt:`, `reply`, `ask --wait`).

Cada PR pasa `pnpm check:changed` y sale a `main`.

## 7. Verificación

- Pruebas solo donde fallen al revertir: `zotz-short-name` (default por carpeta, normalización, sufijo por duplicado) y resolución `wt:` (una, varias, ninguna, existe solo en otro entorno → error sin enviar). Valores esperados fijos.
- Fixture `ZotzProjectSidebar` con nombre corto y fila enlazada (`pnpm fixtures:shot`).
- Manual: enlazar `albatross` ↔ `salmon` y mandarse mensajes en los dos sentidos; enlazar `albatross` ↔ `tarpon` (MSI) y lo mismo; desenlazar y comprobar el aviso.

## 8. Fuera de alcance

- Resúmenes automáticos al terminar cada turno.
- Enlazar desde la app móvil.
