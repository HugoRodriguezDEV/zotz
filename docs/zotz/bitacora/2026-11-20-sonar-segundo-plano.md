# Marca de segundo plano y sin archivar al hacer merge (`zotz/sonar-segundo-plano`)

2026-11-20

- **Marca propia para el segundo plano:** cuando el agente terminó y solo sigue un proceso en segundo plano (estado `monitoring`), la barra lateral mostraba la misma onda que con el agente trabajando. Ahora muestra `ZotzBackgroundSonar` (un punto con dos arcos de eco que pulsan). La onda queda solo para `working`, que siempre gana: si en la conversación el agente trabaja y además hay un proceso en segundo plano, se ve la onda.
- **Se quita `useArchiveOnMerge`:** una conversación ya no se archiva sola al mergear su PR; solo Hugo la archiva desde el menú. También salió la cadena `zotz.sidebar.archivedMerged`. La limpieza automática de upstream (`workspaceCleanup`) sigue apagada por defecto y no se tocó.
- Verificado con la fixture `ZotzWorkingRipple:backgroundOnly`; no se probó con un proceso real en segundo plano.
