# README de Zotz y carpeta `~/zotz` (`zotz/readme-zotz`)

2026-11-20

- **README:** reescrito en español para Zotz, sin nombres, enlaces ni imágenes de Orca. Imágenes de las fixtures en `docs/assets/zotz/` y `social-preview.png` para la vista previa del repo (se sube a mano: GitHub no tiene API). Los README traducidos y los assets viejos de `docs/assets/` se quedan por el costo de sync.
- **Carpeta visible:** los worktrees nuevos van a `~/zotz/workspaces` y los proyectos nuevos a `~/zotz/projects` (antes `~/orca/...`). `getDefaultWorkspaceDir` y el espejo de WSL usan `ZOTZ_HOME_FOLDER_NAME` (`src/shared/zotz/zotz-home-folders.ts`). `~/.orca` sigue igual (decisión de Fase 1c).
- **Migración al cargar el perfil** (`src/main/zotz/zotz-workspace-dir-migration.ts`): si el ajuste guardado era el default viejo (o no existía), pasa a `~/zotz/workspaces` y `~/orca/workspaces` entra a `workspaceDirHistory`, así que los worktrees que ya están ahí conservan dueño y visibilidad. Una carpeta elegida a mano no se toca. La clasificación de WSL reconoce ambas raíces.
- **No se mueven los worktrees existentes:** git los registra por ruta absoluta y pueden tener agentes corriendo. Siguen en `~/orca/workspaces` hasta que se borren; cuando la carpeta quede vacía se puede borrar a mano.
