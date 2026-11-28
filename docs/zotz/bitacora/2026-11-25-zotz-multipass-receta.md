# Receta de Multipass incluida (`zotz-multipass-receta`)

2026-11-25

Sección B de la spec de monitor y remotos.

- **Plugin incluido `zotz.zotz-multipass`** (`resources/plugins/launch/zotz.zotz-multipass`): copia de `multipass-recipes` 2.0.1 de `stablyai/orca-plugins` (MIT, licencia en el plugin), para que funcione con el catálogo de Orca apagado. Cambios contra upstream: llave SSH en `${XDG_STATE_HOME:-$HOME/.local/state}/zotz/multipass/`, comentario de la llave y archivo temporal `zotz-multipass`, id de receta `zotz-multipass-ubuntu-lts` (no choca con la de Orca) y, si falta `multipass`, create sale con 127 y dice cómo instalarlo (`brew install --cask multipass` en macOS, `sudo snap install multipass` en Linux).
- **Incluida pero pendiente, como en upstream:** el manifiesto declara `execution: declarative`, así que el arranque la instala pero no la aprueba sola (solo los plugins de datos se aprueban solos). Hugo la aprueba una vez en Ajustes → Plugins → Multipass VM Recipes → Review → Enable plugin, después de ver los comandos create/suspend/resume/destroy.
- **Para usarla** también hay que encender Ajustes → Experimental → Cloud VM (`experimentalEphemeralVms`, apagado por defecto en upstream); ahí aparece en "Recipes" con "Use in workspace" para cada repo git local.
- **Windows:** la receta es `sh` y Windows corre las recetas con cmd.exe, así que no se ofrece: el índice de incluidos la filtra en win32 (`isBundledPluginOfferedOnPlatform` en `src/main/zotz/zotz-multipass-recipe.ts`, enganchado en una línea de `plugin-bundled-bootstrap.ts`).
- Verificado: `pnpm tc`, oxlint/oxfmt, hash del índice con `verify-packaged-plugin-resources`, y en una instancia dev con perfil nuevo por CDP: tras arrancar queda `pending`; la revisión muestra los cuatro comandos; tras aprobar queda encendida y la receta sale en el catálogo de VMs del repo (capturas en `capturas/multipass/`). El paso create con un PATH sin `multipass` imprime el aviso y sale con 127. **Sin probar:** crear una VM real (esta Mac no tiene Multipass), Linux y que Windows no la muestre.
