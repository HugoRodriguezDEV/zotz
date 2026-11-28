# Monitor del sistema, fase 5: servidores (`zotz-monitor-servidores`)

2026-11-24

- **Por el mismo camino que la cola de los servidores:** métodos del runtime `zotz.systemMonitor.subscribe` (stream: snapshot y luego una actualización por muestra), `processes`, `processCommand` y `closeProcess`, leídos de `zotz-system-monitor-source.ts` como la cola lee `zotz-agent-queue-source.ts`. Enganche de una línea en `rpc-method-registry.ts`.
- **Capacidades nuevas** `zotz.system-monitor.v1` (leer) y `zotz.system-monitor-control.v1` (cerrar procesos), separadas porque cerrar es un poder mayor. Un servidor viejo no aparece; uno sin la segunda se ve sin el botón de cerrar.
- **Selector de máquina** en la pestaña Sistema (solo si hay servidores que lo publican): esta máquina y cada servidor emparejado. El servidor muestrea **solo mientras el stream está abierto**, igual que una ventana local; un watcher remoto usa ids por encima de 1 000 000 000 para no chocar con los de las ventanas.
- La vista de procesos y el diálogo de cerrar reciben un "cliente" (`zotz-system-monitor-client.ts`): IPC para esta máquina, runtime RPC para un servidor. Mismas advertencias y misma confirmación.
- Verificado: `pnpm tc`, oxlint/oxfmt, prueba del método de suscripción (snapshot, actualización, se suelta al salir el cliente), fixtures de servidor en claro y oscuro, y en la app dev llamando los métodos por el despacho del runtime (`window.api.runtime.call/subscribe`): capacidades anunciadas, stream con snapshot y actualizaciones, 1 122 procesos, línea de comando y cierre de un `sleep` de prueba. **Sin probar:** con un servidor emparejado de verdad (la MSI necesita esta versión), ni el selector en la app real (el perfil dev no tiene servidores).
