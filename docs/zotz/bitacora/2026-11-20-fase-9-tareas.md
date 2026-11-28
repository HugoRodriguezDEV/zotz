# Fase 9b, parte 1: tablero con GitHub Projects (`zotz/fase-9-tareas`)

2026-11-20

- **Ajustes → Tareas → Tablero de tareas de Zotz:** lista los Projects de tu cuenta y de tus orgs (`listAccessibleProjects` de Orca), agrupados por dueño con su avatar. Hay casilla por org (marca todos sus Projects) y por Project. Se guarda en `zotzTaskBoardSources`.
- **Pestaña Tareas:**
  - "Todos los proyectos" junta los Projects en Backlog / In Progress / In Review / Done. Cada opción de Status cae en su columna por nombre o sinónimo (`Todo`, `Ready` → Backlog; `QA`, `Review` → In Review); lo que no casa va a "Sin estado".
  - Al elegir un Project se ve tal cual en GitHub con el `ProjectBoard` de Orca, sin arrastre.
  - Un issue que está en dos Projects sale una vez, y un PR ligado a un issue del tablero no sale como tarjeta aparte.
- **Datos:** usa `fetchProjectViewTable` (y su caché) con la vista por defecto del Project; si es roadmap, toma la primera vista board o tabla. Se cargan al abrir la pestaña y con "Actualizar"; la actualización cada 5 min queda para la parte 2.
- **Detalle de solo lectura:** campos del Project, asignados, labels, issue padre, sub-issues, PRs ligados y "Abrir en GitHub". El cuerpo del issue no viene en las filas del Project; leerlo queda pendiente.
- **Archivar terminadas** guarda en `zotzTaskBoardArchived` (setting, no archivo aparte). Una tarea archivada vuelve sola si sale de Done.
- Avatares de dueños: `https://github.com/<login>.png`, sin llamada extra a la API; si no cargan, se ocultan.
- Test de la lógica pura en `zotz-task-board-columns.test.ts` (mapeo, duplicados, PR ligado, archivado). Verificado con fixtures (`ZotzTaskBoard:combined`, `:detail`, `ZotzTaskBoardSourcesSetting:picker`) y `pnpm check:changed`. Sin verificar con GitHub real ni en la app.
