# Spec — Grupos de conversaciones, hijos y arrastrar

Un **grupo** es una tarea en conjunto que cruza proyectos y máquinas: "Agenda de citas" junta la conversación del panel, la del backend y la de móvil, que trabajan juntas y se escriben. Los **proyectos** no cambian: siguen sirviendo para ver un solo repo. Rama: `zotz-grupos`. Reglas del fork: [`PLAN.md`](./PLAN.md).

## 1. Lo que ya existe (verificado 2026-11-23)

- **Los enlaces ya son grupos.** `settings.zotzConversationLinks: ZotzLinkGroup[]` guarda grupos de miembros `{ hostId, path }`; una conversación está en un solo grupo (`findZotzLinkGroup`). Al cambiar un grupo, `commitZotzLinks` avisa a cada miembro con `zotz.links.setPeers` y los agentes aprenden a escribirse ([`SPEC-enlaces-entre-conversaciones.md`](./SPEC-enlaces-entre-conversaciones.md)).
- **Los mensajes guardan remitente y destinatario.** `zotz.links.messages` devuelve los correos del grupo; el panel de Enlaces ya los lista.
- **Orca ya registra padre e hijo** (`worktreeLineageById`, `--parent-worktree`, inferencia por cwd o sesión). Pero la guía de la CLI (`orca skills get orca-cli`, "Full Handoffs") manda usar `--no-parent` en cada entrega, así que hoy no queda nada: `marca-avena-pagina`, creada por el agente de `tautog`, tiene `cliProvenance.startupAgent` y ningún padre.
- **La barra de Zotz no arrastra.** `ZotzProjectSidebar` no tiene drag; el de upstream (`worktree-list/drag/`) es de la barra de Orca.

## 2. Decisiones (Hugo, 2026-11-23)

- **Nada se duplica.** Una conversación que está en un grupo sale solo en el grupo, no en su proyecto.
- **Un solo grupo por conversación.**
- **Los hijos entran solos al grupo del padre.**
- **Todo se arrastra.** Las conversaciones se pueden agarrar y soltar donde se quiera; soltar sobre un grupo la agrega.

## 3. Diseño

### 3.1 Grupo = enlace con nombre

- `ZotzLinkGroup` gana `name: string` y `order: number` (opcionales para leer settings viejos; un grupo sin nombre se muestra como "Grupo sin nombre"). Un grupo puede existir con un solo miembro o vacío recién creado.
- Estar en el grupo = estar enlazado. Agregar o quitar un miembro pasa por `commitZotzLinks`, así que los agentes se enteran igual que hoy.
- Se guarda en el mismo setting, en la máquina del usuario. Los miembros de un servidor siguen funcionando como en los enlaces cruzados.

### 3.2 Barra lateral

- Sección **Grupos** arriba de **Proyectos**, con botón `+` "Nuevo grupo" (pide nombre).
- Cada grupo: encabezado con nombre, menú (Renombrar, Eliminar grupo: los miembros vuelven a su proyecto y se desenlazan) y sus conversaciones, con la etiqueta del proyecto en la segunda línea (`tautog · avena-argos`).
- `buildZotzProjectSections` deja fuera a quien esté en un grupo.
- Grupo vacío: texto "Arrastra conversaciones aquí".

### 3.3 Hijos

- **Registrar quién creó a quién.** En `cliProvenance.zotzParentWorktreeId` del worktree nuevo (viaja con su metadata a todas las ventanas, sin store ni RPC nuevos). Se escribe al crear un worktree desde la CLI cuando la llamada trae `ORCA_AGENT_SESSION_ID` (la sesión del agente que crea) y esa sesión vive en otro worktree del mismo host. Es independiente del linaje de Orca: `--no-parent` sigue significando "rama no apilada", y el hijo se registra igual.
- **Se ve colgando del padre**, con sangría y una línea guía, dentro del grupo o del proyecto donde esté el padre. Un hijo de otro proyecto también cuelga del padre (no sale en su proyecto). Archivar al padre no archiva a los hijos; si el padre deja de verse, el hijo vuelve a su lugar normal.
- **Herencia de grupo.** Si el padre está en un grupo, el hijo entra al grupo al crearse, con `commitZotzLinks`.
- **Crear directo en un grupo.** El agente puede crear una conversación en el grupo por nombre: `zotz worktree create … --group "Agenda de citas"` (flag nuevo, enganche mínimo en el comando). Sin flag, aplica la herencia.

### 3.4 Arrastrar

- Cualquier fila de conversación se agarra (pointer drag, con indicador de destino del styleguide).
- Destinos:
  - Encabezado o lista de un grupo → entra a ese grupo (sale del anterior si tenía).
  - Su propio proyecto → sale del grupo.
  - Otra posición dentro de un grupo → reordena (`members`). Los grupos también se reordenan arrastrando su encabezado (`order`). Los proyectos siguen ordenados por actividad reciente.
  - Otro proyecto → no se permite (el worktree es de su repo); el indicador lo marca y el tooltip lo explica.
- Los hijos se mueven con su padre.
- Teclado: el menú de la fila gana "Mover a grupo…" para lo mismo sin arrastrar.

### 3.5 Vista del grupo (quién habla con quién)

- El panel derecho de Enlaces, con una conversación de un grupo abierta, muestra el grupo como mapa: un nodo por conversación (nombre corto, proyecto, estado del agente) y una línea por par que se ha escrito, más gruesa con más mensajes.
- La línea se anima unos segundos cuando llega un mensaje nuevo; clic en una línea filtra la lista de mensajes a ese par. Debajo sigue la lista actual.
- Los hijos se dibujan unidos a su padre con línea punteada.

## 4. Fases (un PR cada una)

1. [x] **Grupos con nombre** (3.1, 3.2) y "Mover a grupo…" en el menú.
2. [x] **Arrastrar** (3.4).
3. [x] **Hijos** (3.3): registro en el create, anidado, herencia y `--group`.
4. [x] **Vista del grupo** (3.5).
5. [x] Arrancar un grupo de un jalón: una tarea, varios proyectos, una conversación por proyecto ya agrupadas (diálogo de "Nuevo grupo").

## 5. Preguntas abiertas

- ¿Los grupos deben verse también desde el teléfono (app móvil)? Por ahora no: el setting es de la máquina.
