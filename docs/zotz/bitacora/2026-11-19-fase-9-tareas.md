# Fase 9a: modal de tareas y agentes (`zotz/fase-9-tareas`)

2026-11-19

- Spec: [`TASKS-SPEC.md`](../specs/TASKS-SPEC.md).
- Un solo modal (`ZotzBoardModal`) con pestañas **Tareas** y **Agentes**, montado una vez desde `ZotzRootOverlays` en la raíz de la app. El botón de kanban de la barra lateral abre Tareas; el indicador de la cola en la barra de estado abre Agentes. Tareas todavía muestra un estado vacío hasta la 9b.
- El Workspace board de Orca queda oculto, no borrado: `useZotzWorkspaceBoardPanel` reemplaza a `useWorkspaceBoardPanel` en la barra lateral, deja el drawer siempre cerrado, apaga la vista previa al arrastrar y manda el atajo y el comando del board a la pestaña Tareas.
- Se borraron de los 11 idiomas los 3 textos del botón viejo (`auto.components.sidebar.SidebarToolbar.*`): el gate de localización no deja textos sin uso.
- Sorpresa: el store de la cola tronaba si `snapshot()` devolvía `undefined` (cliente web sin runtime). Ahora lo trata como vacío.
- Verificado con la fixture `zotz/tasks/ZotzBoardModal` (ambas pestañas, ambos temas) y `pnpm check:changed`. Sin verificar en la app real.
