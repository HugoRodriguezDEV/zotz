# Monitor del sistema, fase 3: procesos (`zotz-monitor-procesos`)

2026-11-24

- **Vista Procesos** (séptima tarjeta de la pestaña Sistema, y clic en un proceso desde los detalles de CPU o Memoria): todos los procesos, con filtro (nombre, PID, usuario, comando o agente), orden por columna y detalle (padre, usuario, CPU, memoria, línea de comando completa, a quién pertenece). Muestra 200 filas; el filtro encuentra el resto.
- **Dueños** (`zotz-system-process-owners.ts`): subiendo por los padres, el primer árbol de agente que conoce el gobernador (`listZotzAgentProcessRoots`) marca el proceso con su agente y conversación; si no, los PIDs de Zotz (main, helpers de Electron, daemon de terminales) lo marcan como **Zotz** o "en Zotz" (algo que Zotz inició).
- **Cerrar proceso** (`zotz-system-process-control.ts`): diálogo de confirmación; advertencia en rojo si es Zotz o un agente vivo. Primero SIGTERM (Windows: `taskkill` sin `/F`, que pide cerrar); si a los 3 s sigue vivo, el diálogo ofrece **Forzar cierre** (SIGKILL / `taskkill /F`). Se niega si el PID ya es de otro programa (reuso de PID) y nunca toca PID 0, 1 ni 4.
- La lista completa vive en main (la toma el mismo muestreo de la pestaña); el renderer la pide cuando main lee procesos, sin timer propio.
- Verificado: `pnpm tc`, oxlint/oxfmt, pruebas (dueños y la carrera del servicio), fixtures `processes` y `closeAgentProcess` en claro y oscuro, y en la app dev por CDP: un `sleep` se cerró con SIGTERM y uno que ignora SIGTERM ofreció "Forzar cierre" y se cerró; los procesos de la instancia salen como Zotz con su advertencia. **Sin probar:** Windows (`taskkill`, línea de comando vía `windows-process-table`) y la marca de agente con un agente real (la instancia dev no tenía agentes; cubierto con fixture y prueba).
