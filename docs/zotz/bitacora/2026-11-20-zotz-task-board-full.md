# El tablero de tareas como página (`zotz-task-board-full`)

2026-11-20

- El tablero dejó de ser un modal: es una página completa, como Inicio, en la vista nueva `zotz-board` (`ZotzBoardPage`). Ocupa todo el alto y las columnas crecen con la ventana.
- En la barra lateral simple, "Tareas" queda justo abajo de Inicio (`ZotzSidebarTopNav`). El botón de kanban del pie solo sigue en la barra lateral de Orca.
- `zotz-board-page-store` abre y cierra la página sobre `activeView` y recuerda la vista anterior; el atajo y el comando del Workspace board la alternan. Abrir un workspace o crear uno desde una tarea ya cambia a `terminal`, así que no cierran nada a mano.
- Enganches en upstream (una línea cada uno): `TopLevelView`, su lookup y su esquema de RPC, `UiViewHistory`, las vistas sin barra derecha y `AppWorkspaceShell`.
- Verificado con fixtures (`ZotzBoardPage:empty`, `ZotzTaskBoard:combined` y el nav) y `pnpm tc`. Sin verificar en la app real.
