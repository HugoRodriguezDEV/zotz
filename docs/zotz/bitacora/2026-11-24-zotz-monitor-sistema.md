# Monitor del sistema, fases 1 y 2 (`zotz-monitor-sistema`)

2026-11-24

Spec: [`SPEC-monitor-y-remotos.md`](../specs/SPEC-monitor-y-remotos.md) §A. Lectores y parsers portados de `pblobp.os-vitals` 1.0.0 (MIT, crédito en el encabezado de cada archivo portado); el plugin no se instala.

- **Medidor en main** (`src/main/zotz/system-monitor/`): CPU total y por núcleo (deltas de `os.cpus()`), carga, uptime; memoria con las funciones del gobernador (`collectZotzHostMemory` y su lector de presión, que ahora también entrega el swap de macOS sin leer `sysctl` dos veces); red, disco (E/S y espacio del disco de arranque con `statfs`), GPU, batería y procesos. Muestra cada 2 s **solo mientras una ventana mira la pestaña** (IPC `zotzSystemMonitor:watch/unwatch`, se suelta al cerrar o recargar la ventana); historial en memoria de 10 min con huecos donde nadie miraba.
- **Por plataforma:** macOS `netstat`/`route`/`ioreg`/`pmset`/`ps`; Linux `/proc` y `/sys` (+ `nvidia-smi` si existe); Windows **un solo PowerShell vivo** mientras se mira, con clases CIM de rendimiento (no dependen del idioma, a diferencia de `typeperf`), que se cierra solo si Zotz muere. En Windows no hay carga ni usuario de proceso ni totales desde el arranque.
- **Contrato** (`src/shared/zotz/system-monitor/zotz-system-monitor-contract.ts`): ya trae la lista de procesos (mitad más CPU + mitad más memoria, con PID, padre, usuario, comando) para la fase 3, y es serializable para la fase 5 (servidores).
- **Pestaña "Sistema"** en el tablero de la cola (pestañas Cola / Sistema): seis tarjetas con gráfica de historial y vista de detalle por tarjeta (núcleos, procesos que más CPU o memoria usan, interfaces, disco de arranque). Solo tokens existentes (`chart-2`, `muted-foreground`, `destructive`); textos en `en` + `es`.
- Enganches en upstream: una línea cada uno en `preload/index.ts` y `preload/api-types.ts`; el arranque cuelga del gobernador (`zotz-memory-governor-startup.ts`).
- Verificado: `pnpm tc`, oxlint/oxfmt, pruebas de parsers (netstat, diskstats, swap de Linux, línea del muestreador de Windows), el muestreador de macOS contra esta Mac, fixtures `zotz/system-monitor/ZotzSystemMonitorPanel` en claro y oscuro y la pestaña en una instancia dev por CDP (capturas en `capturas/monitor-sistema/`). **Sin probar en hardware:** Windows (el script de PowerShell/CIM) y Linux.
- **Sorpresa:** `typeperf` traduce los nombres de contadores en Windows en español, por eso se descartó para la MSI.
- **Sorpresa 2:** en desarrollo React monta dos veces (watch, unwatch, watch) y el segundo muestreo nunca arrancaba: un `return` dentro del `try` se saltaba la reprogramación. Ahora se reprograma en el `finally`, con prueba.
