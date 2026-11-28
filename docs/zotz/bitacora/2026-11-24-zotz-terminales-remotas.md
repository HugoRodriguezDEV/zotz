# Terminales remotas con color y subgrupo por máquina (`zotz-terminales-remotas`, PR #45)

2026-11-24

Sección C de la spec de monitor y remotos.

- **Color por máquina:** cada host que no es esta máquina (SSH, servidor Zotz, VM) toma uno de los 5 colores de `--git-graph-lane-*` (ya tienen valor claro y oscuro). Lo local, WSL y el servidor al que está pareado un cliente web no llevan color. La asignación (`assignZotzHostColorSlots`) parte de un hash del id del host y resuelve choques en orden de id, así que hasta 5 máquinas nunca comparten color y el mismo id cae igual en cada cliente. No se guarda nada.
- **Dónde se ve:**
  - Franja "Corre en <host>" arriba de la zona de pestañas del worktree (`ZotzHostStrip`).
  - Pestañas teñidas con línea arriba (`ZotzHostTabTint`, sobre el fondo de cada estado de la pestaña).
  - Punto de color en el chip de máquina de la barra lateral, en el encabezado de proyecto y en los subgrupos.
- **Grupo propio por máquina:** en Orca los grupos de pestañas son de un worktree y todas las terminales de un worktree corren en su host (la pestaña no tiene host propio; la terminal flotante siempre es local), así que ahí nunca se mezclan terminales locales y remotas y no hubo que tocarlos. Donde sí se mezclaban era en la barra lateral desde "proyectos entre máquinas". Ahora, dentro de cada proyecto, las conversaciones de esta máquina van arriba y las de cada máquina remota en su propia lista con nombre y color (`ZotzMachineSubgroups`). Las carpetas sueltas siguen la misma regla. Los Grupos con nombre del usuario no se tocan.
- **Ajuste:** "Agrupar conversaciones remotas por máquina" en Ajustes → General → Esta computadora (`zotzGroupRemoteByMachine`, encendido salvo `false`). Apagado vuelve a la lista mezclada con chips, ahora con punto de color.
- Enganches en upstream: dos líneas en `TabGroupPanel.tsx` (la franja y el contenedor de la tira de pestañas). `SortableTab.tsx` está en el tope de 400 líneas, por eso el tinte va en el contenedor y no en cada pestaña.
- **Sorpresa:** en la app, el host de una pestaña sale de `worktree.hostId` y de `activeWorkspaceExecutionHostId`, no del repo. Para simular un remoto en una instancia dev hubo que poner los tres.
- Verificado: `pnpm tc`, oxlint/oxfmt, test de la asignación de colores, fixtures (`zotz/host-color/ZotzHostStrip`, `ZotzProjectSidebar:projectByMachine` y `:projectByMachineOff`, ambos temas) y en una instancia dev con perfil copiado por CDP, con la MSI y un "Mac mini" simulados en el store en memoria: terminal real con pestaña teñida y franja, subgrupos, ajuste apagado, claro y oscuro. **Sin probar con un servidor real pareado**, ni el cliente web pareado. La app móvil no cambia (solo un campo opcional nuevo en los ajustes de Zotz).
