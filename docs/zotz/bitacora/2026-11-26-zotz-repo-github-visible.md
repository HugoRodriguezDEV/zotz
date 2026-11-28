# Repo de GitHub visible en la barra lateral y la de estado (`zotz-repo-github-visible`)

2026-11-26

- **Problema:** en un grupo las filas decían el nombre de la carpeta del proyecto, que no siempre es el repo (la carpeta `avena-empresas` es `Avena-Health/avena-backoffice`), y todos los repos de una org llevan el mismo avatar. No había forma de saber en qué repo de GitHub estabas.
- **Barra lateral:** en un grupo, la fila muestra el nombre del repo de GitHub (owner/repo en el tooltip). El encabezado del proyecto suma una segunda línea con el repo cuando no coincide con la carpeta, y el ícono de GitHub (ahora visible siempre que hay remoto de GitHub) nombra owner/repo y lo abre en el navegador.
- **Barra de estado:** owner/repo del espacio activo, con clic para abrirlo en GitHub. Espacios de carpeta y repos sin remoto de GitHub no muestran nada.
- El repo sale del remoto `origin` (`github.repoSlug`, también por RPC en servidores emparejados), no de `gitRemoteIdentity`, que en un fork apunta al upstream. Se consulta una vez por repo y arranque (`src/renderer/src/components/zotz/repo-github/`).
- Verificado con fixtures (`zotz/sidebar/ZotzProjectSidebar:githubRepoInGroup`) en claro y oscuro. `server-hook-session-binding.test.ts` falla igual en `origin/main` en esta Mac; no es de este cambio.
