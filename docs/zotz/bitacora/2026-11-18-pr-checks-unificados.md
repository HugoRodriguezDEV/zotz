# Checks unificados y release solo Zotz (`zotz/pr-checks-unificados`)

2026-11-18

- **Checks:** la franja de Zotz con el PR y sus checks salía arriba de Source Control y repetía el panel de Checks de upstream (PR, checks, comentarios, "Fix with AI"). Se quitó; el interruptor de Autofix vive ahora en el panel de Checks (`ZotzChecksAutofixToggle`, arriba de la lista). El Autofix sigue corriendo desde `useZotzPrChecksMonitor`, que también usa el chip del PR bajo la conversación. Se fueron con la franja: "Create PR" por el agente y el botón Merge de la franja (el panel de Checks de upstream ya tiene los suyos).
- **Release:** `zotz-stage-release-assets.mjs` publica cada instalador solo con su nombre `zotz-*` y reescribe los `latest*.yml` para que apunten a él (con su `.blockmap`). El build conserva los nombres `orca-*` porque el CI de upstream los lee. Los workflows de release de Orca (`release-cut`, `release-mac-build`, `release-policy`) no corren en el fork: se disparan a mano o tienen el guard `github.repository == 'stablyai/orca'`.
- El actualizador se apaga bajo `ORCA_E2E_USER_DATA_DIR` (ya en `main`): el D7 empaquetado de Windows fallaba porque el build viejo de la prueba se actualizaba al release real mientras arrancaba `serve`.
