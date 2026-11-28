# Crear conversación en un servidor desde la laptop (`zotz/crear-conversacion-remota`)

2026-11-20

- **Problema:** en "Create workspace", con un proyecto que solo existe en la Mac (carpeta o repo sin remote, id `repo:<id>`), la fila "MSI Server" decía "Project location not set" y no hacía nada. Upstream oculta "Set project location" para esos proyectos porque no puede ligarlos a otra máquina.
- **Cambio:** para hosts locales y de runtime (no SSH), la fila ahora ofrece "Set project location". En ese caso la carpeta elegida se agrega como **proyecto propio** del servidor y el composer cambia a ese proyecto: _Browse folder_ (explorador de archivos del servidor) o _Carpeta nueva_ (crea `<home>/zotz/projects/<nombre>` con `repo.create`).
- Lógica en `zotz-host-folder-project-target.ts`, `components/zotz/project-location/`; ganchos cortos en `project-host-setup-options.ts`, `SetProjectLocationDialog.tsx` y `target-change-actions.ts` (busca el proyecto del setup nuevo).
- Sin RPC nuevas: el servidor no necesita este release. No se verificó con la MSI real.
