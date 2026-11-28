# La app como la landing: proyectos entre máquinas y servidores en la barra de estado (`zotz-tours-al-dia`)

2026-11-21

- **Un proyecto, varias máquinas**: la barra lateral agrupa por `getProjectIdentityKey` (GitHub owner/repo o el remoto git), así la misma repo en esta Mac y en cada servidor es una sola sección. Si el proyecto está en más de una máquina, cada conversación muestra su chip de máquina (`Local Mac`, `MSI Server`) y el `+` abre el compositor sin fijar host para elegir dónde. Con una sola máquina remota se queda el chip en el encabezado, como antes.
- **Barra de estado**: con uno o dos hosts conectados nombra las máquinas ("MSI Server · Mac mini") en vez de contar "N hosts"; con más sigue el conteo.
- Verificado: `pnpm tc`, oxlint/oxfmt, 46 archivos de tests, fixture `ZotzProjectSidebar:projectAcrossMachines` y la barra lateral cargada en la app real. La agrupación entre máquinas no se probó con datos reales: hoy ninguna repo está a la vez en la Mac y en la MSI.
