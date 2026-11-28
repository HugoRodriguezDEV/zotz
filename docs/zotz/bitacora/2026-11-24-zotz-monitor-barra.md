# Monitor del sistema, fase 4: barra de estado (`zotz-monitor-barra`)

2026-11-24

- **`CPU · MEM`** junto al segmento de la cola (`ZotzSystemStatusSegment`, enganchado dentro del segmento de la cola: no toca `StatusBarSurface`). Clic abre el tablero directo en la pestaña Sistema (el tablero ahora recuerda su pestaña en `zotz-agent-queue-drawer-open`). Tooltip con GB usados, total y libres.
- **Sin segundo muestreador de memoria** (`zotz-system-status-service.ts`): CPU de los contadores que Node ya lee (`os.cpus()`, sin lanzar procesos) cada 3 s; memoria, presión y piso libre son los del gobernador, al que se le pide una muestra si su lectura tiene más de 15 s. Solo corre mientras una ventana visible muestra la barra (se suelta al ocultarse).
- **Aviso de memoria** con el mismo límite del gobernador: punto naranja en `elevated`, texto en rojo y un aviso (toast) al entrar en `critical`, con botón para ver el sistema. Es el mismo umbral que frena agentes nuevos, así la barra y la cola nunca discrepan.
- El manejo de ventanas que miran un muestreador quedó en `zotz-window-watchers.ts`, compartido por el monitor y la barra.
- Verificado: `pnpm tc`, oxlint/oxfmt, fixtures del segmento (normal, justo, crítico) en claro y oscuro, y en la app dev por CDP: el segmento muestra CPU y MEM, el tooltip coincide con la memoria libre del segmento de la cola y el clic abre la pestaña Sistema. **Sin probar:** el aviso de memoria crítica en vivo (la máquina no cruzó el piso durante la prueba).
