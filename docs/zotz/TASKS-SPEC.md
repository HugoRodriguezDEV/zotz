# Spec — Fase 9: Tablero de tareas (GitHub Projects + conectores externos)

**Estado:** propuesta (2026-11-19), por aprobar por Hugo. Rama sugerida: `zotz/fase-9-tareas`.
**Reemplaza:** el Workspace board de Orca como punto de entrada del botón de kanban de la barra lateral.
**Modelo base:** GitHub Projects (v2). El tablero de Zotz funciona como un Project de GitHub: columnas por un campo, vistas guardadas, filtros con su sintaxis y archivado. Lo que no viene de GitHub (fuentes externas, línea de PR) se acomoda a ese modelo.
**Referencia de producto:** el tablero de Avena (`avena-pm.vercel.app/operacion/tablero`), para cómo enseñar los PRs de cada tarea.

## 1. Objetivo

Un solo tablero en Zotz con **las tareas de todos los proyectos**:

- Las de **GitHub** (Projects v2 e issues de repos) que Hugo elija, con la marca de GitHub, la organización o cuenta dueña (logo y nombre) y el proyecto.
- Las de **servicios externos** (gestores de tickets propios, otros equipos que usen Zotz) que manden sus tareas en un formato que define Zotz.
- En cada tarea, **sus PRs**: abiertos, integrados y los que la mencionan sin estar ligados.

Y que ese tablero viva junto a la cola de agentes y la memoria, en un solo modal.

Fuera de alcance en v1: editar tareas de GitHub desde Zotz, el relay (§8) y la app móvil. La vista roadmap, _Slice by_ y las sumas de campos entraron después de v1 (ver el estado en §11).

## 2. Decisiones de Hugo (2026-11-19)

1. **GitHub es de solo lectura en Zotz.** Cada tarjeta trae el enlace al item en GitHub para editarlo allá rápido. Las tareas avanzan con el flujo normal de GitHub (sus workflows, PR mergeado, issue cerrado), no arrastrándolas en Zotz.
2. **Tareas externas:** cada fuente declara qué acciones acepta (§7.4). Zotz solo habilita lo declarado y comprobado; lo demás es solo lectura.
3. **Selección explícita de fuentes.** Nada de GitHub entra por defecto: se eligen organizaciones (o la cuenta personal) y, dentro de cada una, los Projects y repos que entran al tablero.
4. **El Workspace board se oculta, no se borra** (regla 4 del plan). Su botón en la barra lateral pasa a abrir el modal nuevo.
5. **Done se limpia solo con el botón** "Archivar terminadas". No hay regla automática.
6. **Los PRs van ligados a la tarjeta.** En GitHub el enlace lo hace GitHub; en tareas externas, el proveedor **debe** exponer el endpoint `link-pr` tal como lo define §7.5.
7. **v1 sin relay.** Zotz consulta a GitHub cada pocos minutos (§6.2). El relay propio (§8) queda para la **parte 2** y se alojaría en Vercel: GitHub no puede alojarlo (GitHub Pages solo sirve archivos estáticos y GitHub Actions no es un servidor que se quede escuchando).
8. **El tablero se basa en GitHub Projects** (§3).
9. **Columnas por defecto con Backlog:** Backlog · In Progress · In Review · Done (editables).
10. **Parte 2:** relay, vista roadmap, _Slice by_ y sumas de campos.

## 3. Cómo funciona GitHub Projects (lo que copiamos)

Resumen de la documentación oficial (docs.github.com → _Planning and tracking with Projects_ y _Webhook events_), leída el 2026-11-19.

| GitHub Projects                                                                                                                                                                              | En Zotz                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Columnas** = un campo _single select_ o _iteration_ ("Column by"). Status es el default. Al arrastrar se cambia ese campo.                                                                 | Igual. Columnas del campo elegido en la vista; el default es **Status**. Arrastrar solo en fuentes que lo permitan (§7.4).                                                                                                                      |
| Cada opción de single select tiene **nombre, color y descripción**.                                                                                                                          | La columna muestra color y descripción.                                                                                                                                                                                                         |
| Las columnas visibles se eligen por vista; existe la columna **"No Status"** para lo que no tiene valor.                                                                                     | Igual (Orca ya la arma en `buildBoardColumns`).                                                                                                                                                                                                 |
| **Límite por columna** por vista: se resalta al pasarse, no bloquea.                                                                                                                         | Igual.                                                                                                                                                                                                                                          |
| **Group by** (carriles horizontales) por cualquier campo menos título, labels, reviewers y PRs ligados.                                                                                      | Igual, más agrupar por **fuente**, **org** y **proyecto**.                                                                                                                                                                                      |
| **Slice by**: panel lateral con los valores de un campo.                                                                                                                                     | Igual. Se elige por vista: asignado, label, estado, proyecto, fuente, repo o un single select / iteración de la fuente. "Todos" arriba, conteo por valor; un clic filtra el tablero y se combina con el filtro escrito.                         |
| **Sort**: con orden activo no se reacomoda a mano.                                                                                                                                           | Igual. Sin orden, se respeta el orden de GitHub.                                                                                                                                                                                                |
| **Sumas** de campos numéricos y conteo arriba de cada columna.                                                                                                                               | Igual. La vista elige un campo numérico (de un Project o de un servicio, por nombre) y cada columna y cada grupo muestra conteo + suma.                                                                                                         |
| **Campos en la tarjeta**: se eligen por vista (_View → Fields_).                                                                                                                             | Igual, por vista.                                                                                                                                                                                                                               |
| **Vistas** guardadas por proyecto: layout (tabla, board, roadmap), filtro, orden, agrupación. Hay indicador de cambios sin guardar.                                                          | Vistas guardadas del tablero de Zotz: **board**, **tabla** y **roadmap**. Mismo indicador y "Guardar cambios".                                                                                                                                  |
| **Tipos de item**: issue, PR y borrador (_draft issue_, sin repo).                                                                                                                           | Igual. El borrador muestra "Borrador" y enlaza al item del Project.                                                                                                                                                                             |
| **Status por defecto** de un Project nuevo: Todo, In Progress, Done.                                                                                                                         | Zotz arranca con Backlog · In Progress · In Review · Done (decisión 9), editables.                                                                                                                                                              |
| **Workflows integrados**: issue o PR cerrado → Done y PR mergeado → Done (activos por defecto); auto-add desde repos con filtro; auto-archive.                                               | Corren en GitHub y Zotz solo los refleja. Zotz no tiene workflows propios en v1.                                                                                                                                                                |
| **Archivar**: a mano o automático; los archivados guardan sus campos y se ven en "Archived items", de donde se restauran.                                                                    | Lo archivado en GitHub no aparece. Zotz tiene su archivo **local** (botón, §5.5) con su vista "Archivadas" y "Restaurar".                                                                                                                       |
| **Filtros**: `assignee:@me`, `-status:done`, `has:`/`no:`, `repo:`, `is:open/closed/merged/issue/pr/draft`, `reason:`, `updated:@today-1w`, `iteration:@current`, rangos `1..3`, comas = OR. | Misma sintaxis (subconjunto en §5.3) más `source:` y `project:`.                                                                                                                                                                                |
| **Límites**: 50,000 items por Project (activos + archivados), 50 campos, 50 opciones por single select.                                                                                      | Paginamos con el filtro de la vista aplicado en GitHub (`items(query:)`); tope local configurable, default 1,000 por Project.                                                                                                                   |
| **Roadmap**: barras por un campo de fecha de inicio y uno de fin (o una iteración), zoom, línea de hoy.                                                                                      | Igual, de solo lectura. La vista guarda los campos de inicio y fin (si no elige, se toman por nombre: _Start_/_Target_, o la primera iteración) y el zoom mes/trimestre. Las tareas sin fecha van en una lista aparte; un clic abre el detalle. |
| **Webhooks** `projects_v2_item` (created, edited, archived, restored, converted, reordered, deleted): **solo proyectos de organización**, vía **GitHub App**, en _public preview_.           | v1: consulta periódica. Después, el relay (§8) como GitHub App; en proyectos personales seguirá siendo consulta.                                                                                                                                |

Pendiente de confirmar en la doc: el detalle de la columna "No Status" y la lista completa de workflows integrados (la página no la enumera entera).

## 4. Qué existe en Orca (reusar, no duplicar)

| Pieza                                    | Dónde                                                                | Uso en esta fase                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Columnas como en GitHub                  | `src/shared/github/projects/project-board-columns.ts`                | `resolveBoardColumnField` (Column by, cae a Status) y `buildBoardColumns` (opciones, borradas, "No"). |
| Vistas de un Project                     | `GitHubProjectView` en `src/shared/github/projects/project-types.ts` | Ya trae `filter`, `fields`, `groupByFields`, `sortByFields` y `verticalGroupByFields`.                |
| Descubrir Projects v2 del usuario y orgs | `src/main/github/project-view/project-view-discovery.ts`             | Selector de fuentes (`listAccessibleProjects`). No trae `avatarUrl`: hay que pedirlo.                 |
| Items de un Project con todos sus campos | `src/main/github/project-view/project-view-items.ts`                 | `fetchAllItems` da `GitHubProjectRow` con repo, asignados, labels, PRs ligados y sub-issues.          |
| PRs ligados a un item del Project        | `linkedPullRequests` en `project-view-item-normalization.ts`         | Hoy solo trae número, título y URL. Se completa con estado y merge (§6.4).                            |
| Timeline de un issue                     | `src/main/github/issues/issue-work-item-details.ts`                  | Referencias cruzadas: PRs que mencionan la tarea sin ligarla.                                         |
| Tablero, tarjeta y celdas de Project     | `src/renderer/src/components/github-project/`                        | Base visual del tablero y del detalle; reusar `cells/` para pintar campos.                            |
| Issues de un repo                        | `src/renderer/src/components/task-page/github/`                      | Fuente "repo sin Project".                                                                            |
| Modal de la cola de agentes              | `src/renderer/src/components/zotz/agent-queue/`                      | `ZotzAgentQueueStatusSegment` abre un `Dialog`; se vuelve pestaña "Agentes" del modal nuevo.          |
| Botón de kanban de la barra lateral      | `src/renderer/src/components/sidebar/SidebarToolbar.tsx`             | Se redirige al modal nuevo (pestaña "Tareas").                                                        |
| Issue ligado a un workspace              | `Worktree.linkedIssue` / `linkedPR` (`src/shared/worktree/types.ts`) | Enlazar tarea ↔ workspace/agente (9e).                                                                |
| Secretos                                 | `src/main/host/electron-secret-store.ts`                             | Tokens de conectores y del relay.                                                                     |
| Validación y formatos                    | `zod`, `yaml`, `smol-toml` (ya en `package.json`)                    | Contrato externo en JSON, YAML o TOML.                                                                |

## 5. Interfaz

### 5.1 Modal unificado

- Un `Dialog` con dos pestañas: **Tareas** y **Agentes** (el tablero actual de la cola, con la barra de RAM).
- Se abre desde:
  - El botón de kanban de la barra lateral → pestaña **Tareas**.
  - El indicador de la cola en la barra de estado → pestaña **Agentes**.
- El atajo y el comando de Orca que abrían el Workspace board ahora abren la pestaña **Tareas**.
- En la ventana web pareada (`isPairedWebClientWindow`) se comporta igual que el indicador de la cola hoy: no se muestra.

### 5.2 Vistas

- Pestañas de vistas arriba del tablero, como en GitHub. Vista inicial **"Todas"**: layout board, sin filtro, columnas por Status.
- Cada vista guarda: nombre, layout (board/tabla/roadmap), filtro, Column by, Group by, Sort, columnas visibles, límites por columna, campos visibles en la tarjeta, campo sumado, _Slice by_ y, en roadmap, los campos de inicio y fin y el zoom.
- Cambios sin guardar → punto en la pestaña y botones "Guardar" / "Descartar".
- **Espejo de un Project:** al crear una vista se puede elegir "Igual que un Project de GitHub" + una de sus vistas. Zotz copia su filtro, Column by, Group by, Sort y campos visibles, y muestra **exactamente** sus columnas. Esa vista se resincroniza con GitHub (si cambian la vista allá, cambia aquí).
- Se guardan en el setting `zotzTaskBoardViews`.

### 5.3 Columnas y filtros

- **Vista espejo:** las columnas son las opciones del campo de ese Project, con su color y descripción, más "No Status".
- **Vista combinada** (varias fuentes): las columnas son las opciones del **Status del tablero de Zotz** (default Backlog / In Progress / In Review / Done, editables en Ajustes con nombre, color y descripción, igual que un single select de GitHub). Cada opción de cada fuente se mapea a una columna:
  1. por nombre normalizado (`in progress` = `In Progress`);
  2. si no casa, por `category` de la fuente externa (§7.1) o por sinónimos (`todo`/`ready`/`new` → Backlog, `doing` → In Progress, `review`/`qa` → In Review, `closed` → Done);
  3. si no casa, a mano en Ajustes; mientras tanto cae en "No Status".
- **Filtros** con la sintaxis de GitHub. v1 soporta: `is:open|closed|merged|issue|pr|draft`, `status:`, `assignee:` (con `@me`), `label:`, `repo:`, `has:`/`no:`, negación con `-`, `updated:` con `@today-Nd`, `iteration:@current|@previous|@next`, comas como OR, y los propios `source:` y `project:`. En vistas espejo el filtro se manda a GitHub tal cual (`items(query:)`); en las combinadas se evalúa en Zotz.

### 5.4 Tarjeta

- Arriba: marca de la fuente (logo de GitHub o el logo del conector), avatar de la org/cuenta y `org / proyecto`.
- **Línea de PR** (solo si tiene PRs, toma el más avanzado):
  - `→ main · PR abierto · repo#123` (o `borrador`)
  - `PR integrado en main · repo#123`
  - `PR cerrado sin integrar · repo#123`
  - `+2 PRs` si hay más de uno.
- Título, `#número` y repo (`owner/repo`) si aplica; "Borrador" para draft issues.
- Campos visibles según la vista (asignados, labels, iteración, prioridad, etc.).
- Botón ↗ que abre el item en su sitio (GitHub o la URL del conector) en el navegador del sistema.
- Si un workspace tiene esta tarea ligada: chip con su estado de agente ("En cola #2", "Corriendo", "Review").
- **PRs como items:** un PR que es item del Project se muestra como tarjeta, igual que en GitHub. Si ya aparece ligado a un issue del mismo tablero, se oculta (dedup) y queda solo en la línea de PR del issue.

### 5.5 Archivar (solo con botón)

- Botón **"Archivar terminadas"** en la columna Done (en vistas combinadas, la columna mapeada a Done; en espejo, la opción que GitHub usa en sus workflows: "Done").
- Archiva **en Zotz** lo que está en esa columna en ese momento; no toca GitHub ni al proveedor. También se puede archivar una tarjeta suelta desde su menú.
- **Archivadas:** lista con búsqueda, fecha de archivado y "Restaurar", como _Archived items_ de GitHub. Se guarda en el setting `zotzTaskBoardArchived`, por clave estable (la URL del issue, o la del Project + el id del item).
- Si una tarea archivada se reabre (sale de Done), vuelve al tablero sola.
- Lo que GitHub archive (a mano o con su auto-archive) desaparece del tablero sin pasar por "Archivadas" de Zotz.

### 5.6 Detalle de la tarea

- Drawer de solo lectura.
- GitHub: lo mismo que muestra el item en el Project: todos sus campos, cuerpo en markdown, asignados, labels, milestone, issue padre y progreso de sub-issues. Botón principal **"Abrir en GitHub"**.
- Externa: título, cuerpo, campos de la fuente con su tipo y `url`. Botón **"Abrir en <fuente>"**.
- **Desarrollo** (como la sección _Development_ de GitHub, todas las fuentes):
  - PRs ligados: `repo#N ↗`, estado, rama base, autor, `+adds −dels · N archivos`, commit de merge `abc1234 ↗` y fecha de merge.
  - Ramas ligadas al issue (`linkedBranches` de GitHub).
  - Primeros 5 archivos tocados y "y N más".
  - **Lo mencionan (sin ligar):** PRs que nombran la tarea pero no la cierran. Botón "Ligar en GitHub" (abre el PR para agregar `Closes #N`) o "Ligar" (externas, manda `link-pr`).
  - Despliegues, si el repo usa GitHub Deployments: último ambiente con ese commit.
  - Estado de la sincronización: "Verificado en GitHub hace 3 min" o "Sin verificar en GitHub".
- **Historial** (solo lo que Zotz ve): entró al tablero, cambió de columna, se ligó un PR, se archivó.
- Acción de Zotz (todas las fuentes): "Crear workspace con esta tarea" (9e).

## 6. GitHub

### 6.1 Selección de fuentes (Ajustes → Tareas → Tablero de Zotz)

Árbol de tres niveles con casillas:

```
☐ Cuenta personal (@usuario)
   ☐ Project: Roadmap personal
   ☐ Repo: usuario/dotfiles           (issues sin Project)
☐ Organización: acme
   ☐ Project: Producto 2026
   ☐ Repo: acme/api
```

- Nivel 1: dueños (cuenta personal + organizaciones de `listAccessibleProjects` y de `viewer.organizations`).
- Nivel 2: los **Projects v2** de ese dueño y sus **repos**. Un repo marcado aporta sus issues abiertos aunque no estén en ningún Project.
- Si un issue llega por dos caminos (Project y repo), se muestra **una sola tarjeta**, con los datos del Project.
- Se guarda en el setting `zotzTaskBoardSources` (lista de `{ kind: 'github-project' | 'github-repo', owner, ownerType, number | repo, host? }`).

### 6.2 Sincronización

- Usa las credenciales de GitHub que Orca ya tiene; no pide token nuevo.
- Se actualiza al abrir el modal, cada 5 min mientras está abierto y con "Actualizar". Cerrado, no consulta nada.
- Para no gastar el límite de la API: las consultas REST van con `ETag` (si nada cambió, GitHub responde `304` y no cuenta contra el límite) y las de GraphQL se piden solo para los Projects cuyo `updatedAt` cambió.
- Con el relay (§8) activo: cada aviso relee solo lo afectado y la consulta completa baja a cada 30 min como red de seguridad. Si el relay falla, vuelve sola a cada 5 min.
- La última lectura se guarda en disco para que el modal abra al instante con datos viejos y una marca "actualizado hace X".
- La consulta de dueños pide además `avatarUrl`. Se hace en una consulta propia en `src/main/zotz/tasks/`, sin tocar `project-view-discovery.ts`.

### 6.3 Columnas de los repos sin Project

Un repo suelto no tiene Status. Se le da uno derivado, como harían los workflows por defecto de GitHub: issue abierto → Todo; issue abierto con PR ligado abierto → In Progress; cerrado → Done.

### 6.4 PRs ligados

**GitHub ya liga PRs con issues** (palabras clave como `Closes #12` o la sección _Development_). Zotz solo lee:

- **Ligados:** `closedByPullRequestsReferences` del issue (el campo _Linked pull requests_ del Project da lo mismo para items de Project). Por PR: estado, `isDraft`, rama base, autor, `additions`/`deletions`/`changedFiles`, `mergeCommit` y `mergedAt`.
- **Ramas ligadas:** `linkedBranches` del issue.
- **Lo mencionan:** eventos `CROSS_REFERENCED_EVENT` del timeline del issue cuyo origen es un PR que no está ligado.
- **Despliegue (opcional):** GitHub Deployments del `mergeCommit`, si el repo los usa.

Si un PR no está ligado y debería, el arreglo se hace **en GitHub**: "Ligar en GitHub" abre el PR. Zotz no edita el texto del PR.

## 7. Conector externo — contrato `zotz-tasks/v1`

### 7.1 Formato

JSON es el formato oficial, con un JSON Schema publicado en `docs/zotz/schemas/zotz-tasks-v1.schema.json`. YAML y TOML se aceptan con la misma estructura y se convierten antes de validar. La fuente se describe **como un Project de GitHub**: sus campos y sus opciones de Status.

```json
{
  "schema": "zotz-tasks/v1",
  "source": {
    "id": "acme-helpdesk",
    "name": "Acme Helpdesk",
    "logoUrl": "https://helpdesk.acme.dev/logo.png",
    "url": "https://helpdesk.acme.dev",
    "taskIdPattern": "HD-[0-9]+",
    "fields": [
      {
        "name": "Status",
        "type": "single-select",
        "options": [
          { "id": "new", "name": "Nuevo", "color": "GRAY", "category": "todo" },
          { "id": "doing", "name": "En curso", "color": "YELLOW", "category": "in-progress" },
          {
            "id": "qa",
            "name": "QA",
            "color": "PURPLE",
            "category": "in-progress",
            "description": "Esperando validación"
          },
          { "id": "done", "name": "Resuelto", "color": "GREEN", "category": "done" }
        ]
      },
      { "name": "Prioridad", "type": "number" },
      {
        "name": "Sprint",
        "type": "iteration",
        "iterations": [{ "id": "s12", "title": "S12", "startDate": "2026-11-17", "duration": 14 }]
      },
      { "name": "Entrega", "type": "date" },
      { "name": "Cliente", "type": "text" }
    ]
  },
  "capabilities": {
    "actionsUrl": "https://helpdesk.acme.dev/zotz/actions",
    "actions": ["link-pr", "move"]
  },
  "tasks": [
    {
      "id": "HD-142",
      "type": "issue",
      "title": "Login falla en Safari",
      "state": "open",
      "project": { "id": "web", "name": "Web App", "avatarUrl": "https://…" },
      "url": "https://helpdesk.acme.dev/HD-142",
      "assignees": [{ "login": "ana", "name": "Ana", "avatarUrl": "https://…" }],
      "labels": [{ "name": "bug", "color": "d73a4a" }],
      "body": "markdown…",
      "fieldValues": {
        "Status": "doing",
        "Prioridad": 1,
        "Sprint": "s12",
        "Entrega": "2026-11-28",
        "Cliente": "Avena"
      },
      "pullRequests": [{ "repo": "acme/web", "number": 534 }],
      "createdAt": "2026-11-18T09:00:00Z",
      "updatedAt": "2026-11-19T10:00:00Z"
    }
  ]
}
```

### 7.2 Reglas del contrato

- **Obligatorios:** `schema`, `source.id`, `source.name`, `source.fields` con un campo `Status` de tipo `single-select` y, por tarea, `id`, `title`, `state` y `fieldValues.Status`.
- Tipos de campo: `text`, `number`, `date` (ISO `YYYY-MM-DD`), `single-select` (valor = `id` de la opción) e `iteration` (valor = `id` de la iteración). Son los de GitHub Projects; con ellos funcionan igual Column by, Group by, filtros y sumas.
- Colores: los de GitHub (`GRAY`, `BLUE`, `GREEN`, `YELLOW`, `ORANGE`, `RED`, `PINK`, `PURPLE`). Zotz los pinta con los tokens del styleguide.
- `category` (`todo` | `in-progress` | `done`) es opcional; ayuda a mapear en vistas combinadas (§5.3).
- `state` ∈ `open` | `closed`; `type` ∈ `issue` | `draft` (default `issue`). Así funcionan `is:open`, `is:closed` e `is:draft`.
- Hasta 50 campos y 50 opciones por single select, como en GitHub.
- `id` es único dentro de la fuente; `source.id` es un slug `[a-z0-9-]{1,64}`.
- `taskIdPattern`: expresión regular (sintaxis RE2) con la que Zotz reconoce la tarea en ramas, títulos y cuerpos de PRs (§7.5). Si falta, Zotz busca el `id` literal.
- Un valor inválido rechaza **esa tarea**, no el lote completo.
- Cada envío es una **foto completa** de la fuente: reemplaza lo anterior. Lo que no viene desaparece.
- Límites: 2 MB por envío, 2,000 tareas, títulos ≤ 300 caracteres, `body` ≤ 64 KB, 50 PRs por tarea. El error dice qué campo y cuánto.
- Versionado: un cambio incompatible es `zotz-tasks/v2`; Zotz rechaza versiones que no conoce con un mensaje claro.

### 7.3 Cómo llegan las tareas

1. **Feed por URL (pull):** URL, intervalo (≥ 1 min, default 5) y token opcional (`Authorization: Bearer …`, guardado en `electron-secret-store`). No requiere abrir puertos.
2. **Push por el relay** (§8): el proveedor manda el documento al relay y Zotz lo recoge.
3. **CLI:** `zotz tasks push <archivo> [--format json|yaml|toml]` y `zotz tasks push -` (stdin). `zotz tasks validate <archivo>` solo valida.
4. **Importar archivo** desde Ajustes (para probar el formato).

### 7.4 Acciones (lo que se puede y no se puede hacer)

- `link-pr` es **obligatoria** (§7.5). `move` es opcional; futuras: `comment`, `assign`.
- Al agregar el conector, Zotz **comprueba** cada acción con `POST actionsUrl` y `"dryRun": true`. Debe responder `200` con `{ "ok": true }` sin cambiar nada. Si falla, la acción queda apagada y Ajustes dice por qué. Sin `link-pr` funcional la fuente entra en **modo solo lectura** con el aviso "No recibe PRs".
- Sobre de toda acción, con el token del conector:

```json
{ "schema": "zotz-tasks/v1", "action": "<acción>", "taskId": "HD-142", "dryRun": false, "...": "…" }
```

- Respuesta: `2xx` con `{ "ok": true }`, o `4xx` con `{ "ok": false, "error": "texto para el usuario" }`. Zotz reintenta solo con `5xx` o error de red (3 veces, espera exponencial) y guarda en cola lo que no pudo entregar.
- `move`: agrega `"field": "Status", "value": "qa"` (id de la opción). Arrastrar solo se habilita en fuentes con `move`; la tarjeta se mueve de forma optimista y regresa si falla.

### 7.5 Endpoint obligatorio `link-pr`

Zotz busca PRs de las tareas externas en los repos elegidos en §6.1. Hay coincidencia si `taskIdPattern` (o el `id`) aparece en:

1. el nombre de la rama del PR (ej. `hd-142-login-safari`);
2. el título del PR;
3. el cuerpo del PR o el mensaje de un commit del PR.

Rama o título → se liga solo. Cuerpo o commit → queda como "Lo mencionan (sin ligar)", igual que en GitHub, y el usuario decide con "Ligar". Los workspaces creados desde una tarea (9e) usan su `id` en el nombre de rama, así que sus PRs se ligan solos.

Al ligar, y cada vez que el PR cambia de estado, Zotz manda:

```json
{
  "schema": "zotz-tasks/v1",
  "action": "link-pr",
  "taskId": "HD-142",
  "dryRun": false,
  "pullRequest": {
    "repo": "acme/web",
    "number": 534,
    "url": "https://github.com/acme/web/pull/534",
    "title": "Fix login en Safari",
    "state": "open | merged | closed",
    "isDraft": false,
    "baseRef": "main",
    "headRef": "hd-142-login-safari",
    "author": "ana",
    "mergeCommit": "9e82b5b…",
    "mergedAt": "2026-11-11T18:20:00Z",
    "link": "linked | mentioned | unlinked"
  }
}
```

- **Idempotente** por `taskId + repo + number`: el proveedor guarda la última versión y no duplica.
- El proveedor decide qué hacer (mostrarla, mover su ticket, etc.). En su siguiente envío debe incluir el PR en `tasks[].pullRequests`; si no lo hace, Zotz lo sigue mostrando porque lo detectó él.

### 7.6 Seguridad

- Todo lo que llega es dato no confiable: se valida con `zod` y nunca dispara nada en Zotz (ni comandos ni prompts a agentes) por sí solo.
- El markdown se pinta con el renderer seguro que ya usa el detalle de issues; enlaces solo `http(s)`.
- Logos y avatares solo por `https`, cargados al mostrarse.
- `taskIdPattern` con tope de 200 caracteres y sin backtracking catastrófico.
- Los tokens nunca van a logs ni al archivo de settings.

## 8. Relay propio (webhooks) — parte 2

Implementado (2026-11-20). Guía de puesta en marcha y API: [`RELAY.md`](./RELAY.md).

### 8.1 Por qué relay y no Tailscale Funnel

- **Funnel** abre un puerto de la máquina a internet. En Zotz esa máquina corre agentes con acceso total (Fases 4 y 7): un fallo en el endpoint sería una puerta a todo. Además solo sirve en modo servidor y depende de configurar Funnel en el tailnet.
- **Relay**: un servicio pequeño en internet que recibe los webhooks y del que Zotz **jala** con conexiones salientes. Nada de Zotz queda expuesto, funciona en escritorio y en servidor, detrás de NAT, y guarda los eventos mientras Zotz está apagado.
- **Costo:** hay que operarlo. Para que no rompa la regla de "cero phone home" (Fase 2): es infraestructura de Hugo, opcional (apagado por defecto) y desplegable por cualquiera con su propio código.

### 8.2 Diseño

- **GitHub App privada "Zotz Relay"** (de Hugo), instalada en la cuenta personal y en las orgs elegidas. Es la única forma de recibir `projects_v2_item`, que GitHub solo emite para proyectos de **organización** y por GitHub App (en _public preview_).
  - Permisos de solo lectura: Metadata, Issues, Pull requests, Contents (para `push`) y, en orgs, Projects.
  - Eventos: `issues`, `pull_request`, `push`, `projects_v2_item` (orgs) y `installation`.
  - La App **solo** recibe webhooks. Zotz sigue leyendo la API con las credenciales del usuario, no con las de la App.
- **El relay guarda solo avisos, no contenido:** `{ cursor, installationId, repo, kind, number?, projectItemNodeId?, action, at }`. Nada de títulos, cuerpos ni código. Retención 7 días.
- **Verificación:** `X-Hub-Signature-256` con el secreto de la App; lo que no valida se descarta.
- **Zotz se conecta así:** `GET /v1/events?cursor=…` con long-poll (o SSE) y un token de dispositivo. Con cada aviso relee solo esa tarjeta de GitHub (§6.2). Si el relay no responde, vuelve solo a la consulta periódica.
- **Proveedores externos:** `POST /v1/sources/<sourceId>/push` con su token. Este documento **sí** lleva contenido, así que el relay lo entrega una vez y lo borra al confirmar (o a las 24 h). Así el proveedor no necesita llegar a la máquina de Zotz.
- **Dónde vive:** función serverless en **Vercel** (plan gratuito) con almacenamiento clave-valor, en un repo aparte (`zotz-relay`). GitHub no sirve para esto: Pages solo publica archivos estáticos y Actions corre trabajos sueltos, no un servidor que reciba avisos.
- **Personal vs org:** en proyectos personales no llega `projects_v2_item`. Ahí los cambios de campos del Project (mover de columna en GitHub) se ven por la consulta periódica; los de issues, PRs y pushes sí llegan por el relay.

### 8.3 Cómo quedó

- **Servicio** (`zotz-relay`): una sola función de Vercel (`api/index.ts`) con Upstash Redis del Marketplace (Vercel KV ya no existe). Rutas en [`RELAY.md`](./RELAY.md#api).
  - El aviso guarda además `owner` (dueño del repo o de la org) y `projectNodeId` (para saber qué Project releer). Sigue sin contenido.
  - **Cursor** = número del aviso. El relay responde `reset` si el dispositivo no trae cursor, si se borraron avisos que no vio (7 días) o si el almacenamiento se vació; Zotz entonces recarga todo.
  - Los tokens de dispositivo y de proveedor se configuran como hashes SHA-256 en variables de entorno; el relay nunca guarda tokens.
  - Los webhooks repetidos (`X-GitHub-Delivery`) se guardan una vez. `push` de tags y `ping` se ignoran.
  - Una GitHub App privada solo se instala en su dueño: para orgs, una App privada por org (el relay acepta varios secretos) o una App pública con `ZOTZ_RELAY_ALLOWED_OWNERS`.
  - Del documento de un proveedor se guarda solo el último por fuente.
- **Zotz:**
  - _Ajustes → Tareas → Relay para avisos al instante_: URL + token de dispositivo, cifrado con el `SecretStore` en `zotz-task-relay-secrets.json`. Se prueba antes de guardar. Apagado por defecto (setting `zotzTaskRelay`).
  - `ZotzTaskRelayClient` (main, sin Electron) hace long-poll de 25 s **solo mientras algún tablero está abierto**. Cerrado, consulta cada 10 min para recoger documentos de proveedores. El cursor se guarda en `zotz-task-relay.json`.
  - Qué se relee por aviso: `planZotzRelayReload` (tabla en [`RELAY.md`](./RELAY.md#cómo-funciona)). Los avisos se juntan 1.5 s antes de aplicarse.
  - Los documentos de proveedores entran por `pushZotzTasksDocument`, como `zotz tasks push`, solo si su `source.id` coincide con el `sourceId` autenticado.
  - La barra del tablero dice "En vivo" o "Relay caído".

### 8.4 Pendiente

- Desplegarlo: repo, Vercel, Upstash y la GitHub App los crea Hugo (o los crea el agente cuando Hugo lo apruebe).
- Un documento de proveedor lo consume el primer dispositivo que lo confirma; no hay entrega por dispositivo.

## 9. Ciudadanos de primera clase

- **Multiplataforma:** todo vive en main/renderer de Electron y la CLI; no hay comandos de sistema. Caché, vistas y archivadas salen de `app.getPath('userData')`.
- **Hosts remotos:** el tablero es de la app de escritorio y usa las credenciales locales. El chip de agente (§5.4) debe ver workspaces de hosts emparejados.
- **Móvil:** fuera de v1. El contrato queda listo para exponerlo después.
- **Carpetas sin git:** "Crear workspace con esta tarea" debe ofrecer carpeta además de worktree.

## 10. Archivos nuevos (todo `zotz-*`, enganches de pocas líneas)

- `src/shared/zotz/tasks/` — modelo `ZotzTask`, schema `zod` del contrato, mapeo de opciones a columnas, parser de filtros, detección por `taskIdPattern` y parser JSON/YAML/TOML. Reusa `project-board-columns.ts` y `project-group-sort.ts`.
- `src/main/zotz/tasks/` — agregador de GitHub (reusa `project-view` e `issues`), PRs y ramas ligadas, sondeo de feeds, cliente de acciones con cola de reintentos, cliente del relay, archivo de archivadas, caché en disco e IPC `zotzTasks:*`.
- `src/renderer/src/components/zotz/tasks/` — modal unificado, vistas, tablero, tabla, tarjeta con línea de PR, drawer, archivadas y sección de Ajustes.
- CLI: comando `tasks` junto a los demás de `src/cli/`.
- Repo aparte `zotz-relay`: GitHub App + función serverless.
- Enganches en código de upstream: `SidebarToolbar.tsx` (el botón abre el modal nuevo) y `ZotzAgentQueueStatusSegment.tsx` (su `Dialog` pasa a ser la pestaña Agentes).

## 11. Fases

- **9a — Modal unificado.** Pestañas Tareas (vacía, con CTA a Ajustes) y Agentes; botón de kanban redirigido; Workspace board oculto.
- **9b, parte 1 — GitHub Projects.** Selector de organizaciones y Projects, tablero combinado, vista espejo de cada Project (reusa `ProjectBoard` de Orca en solo lectura), tarjetas con marca y org, búsqueda, "Actualizar", detalle de solo lectura, "Archivar terminadas" y Archivadas.
- **9b, parte 2 — Repos y vistas.** Issues de repos sueltos, vistas guardadas (board/tabla, filtro con la sintaxis de GitHub, Column by, Group by, Sort, campos) y actualización cada 5 min con el modal abierto.
- **9c — PRs de GitHub.** Línea de PR en la tarjeta y sección Desarrollo del detalle.
- **9d, parte 1 — Conector externo.** Contrato `zotz-tasks/v1` con campos tipo Project (JSON, YAML, TOML), feed por URL con token cifrado, importar archivo, tareas en el tablero combinado, vista propia del servicio y detalle.
- **9d, parte 2.** JSON Schema publicado, CLI `zotz tasks push`/`validate`, detección por `taskIdPattern` y endpoint `link-pr` (depende de 9c).

`capabilities` es opcional: sin `actionsUrl` (o sin `link-pr` funcional) la fuente entra en modo solo lectura, como dice §7.4.

**Estado (2026-11-20):** 9a a 9f implementadas. Diferencias con lo escrito arriba:

- _Column by_ no se elige por vista. El combinado usa el Status de Zotz; la vista de un Project usa la columna de su vista en GitHub.
- Los issues de repos sueltos se leen de GitHub (los 100 más recientes), no de clones locales.
- Development no muestra despliegues ni en qué otras ramas cayó un merge.
- "Crear workspace con esta tarea" no pone el cuerpo como primer prompt (el composer de Orca no lo acepta). El chip no puede decir "En cola" porque la cola no guarda el workspace.
- El relay (§8) llegó después, en su propio PR; ver §8.4.
- **Sumas, _Slice by_ y roadmap** (2026-11-20, después de 9a–9f) entraron como en GitHub, con estas diferencias: los campos se casan por nombre entre fuentes (el "Estimate" de dos Projects y de un servicio se suman juntos); el valor elegido en el panel de _Slice by_ no se guarda en la vista, solo el campo; el roadmap tiene zoom mes y trimestre (no año) y no se arrastran barras.
- La pestaña "Agentes" del modal se quitó: desde el PR #33 la cola de memoria tiene su propio panel lateral con todas las máquinas, que abre el indicador de la barra de estado. El modal es solo el tablero de tareas.

- **9e — Tarea ↔ agente.** Chip de estado de agente en la tarjeta y "Crear workspace con esta tarea" (rama con el id de la tarea, `linkedIssue` en GitHub y el cuerpo como primer prompt).
- **9f — Acción `move`** para fuentes externas, con comprobación previa.
- **Parte 2 (después de 9a–9f):** relay (GitHub App + Vercel), vista roadmap, _Slice by_ y sumas de campos. Roadmap, _Slice by_ y sumas ya están; falta el relay.

## 12. Pruebas

Unit tests solo para lógica pura, con valores escritos a mano:

- Validación del contrato: lote válido, tarea con opción de Status inexistente (se descarta solo esa), límites excedidos, fuente sin `actionsUrl` o sin campo Status.
- Parser: el mismo lote en JSON, YAML y TOML produce el mismo resultado.
- Mapeo de opciones a columnas combinadas (nombre, `category`, sinónimos, "No Status") y deduplicación Project/repo y PR/issue.
- Parser de filtros: los ejemplos de §5.3 contra un conjunto fijo de tareas.
- Sumas, slices y posiciones del roadmap: un Project y un servicio con campos fijos (suma por nombre, asignados múltiples, opciones con color, iteraciones por fecha, barras de fechas invertidas e iteraciones).
- Detección por `taskIdPattern`: rama y título ligan; cuerpo y commit solo mencionan.
- Relay: verificación de `X-Hub-Signature-256` y cursores (en `zotz-relay`); qué recargar por cada aviso (`zotz-task-relay-reload.test.ts`).

Sin tests de copy, de estilos ni de la UI del modal.

## 13. Decisiones abiertas

Ninguna por ahora. Lo pospuesto está en la decisión 10 y al final de §11.
