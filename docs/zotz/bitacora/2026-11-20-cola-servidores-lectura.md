# Cola de memoria de los servidores, lectura (`zotz/cola-servidores-lectura`)

2026-11-20

- Spec: [`SPEC-servidores-cola-y-archivar.md`](../specs/SPEC-servidores-cola-y-archivar.md), Parte B. La laptop ahora ve la cola de memoria de cada servidor emparejado.
- **Servidor:** llamadas RPC nuevas `zotz.agentQueue.snapshot` y `zotz.agentQueue.subscribe` (permiso `workspace`) y la capability `zotz.agent-queue.v1`. El constructor del snapshot salió del IPC de Electron (`zotz-agent-queue-snapshot-builder.ts`) y el limitador se registra en `zotz-agent-queue-source.ts`, para que un servidor sin escritorio también pueda atenderlo. Solo se agregan llamadas.
- **Cliente:** `zotz-host-agent-queue-store.ts` sigue la cola de cada servidor que declare la capability y olvida el que se desconecta; lo que llega de otra máquina se valida entrada por entrada (`zotz-agent-queue-remote-snapshot.ts`). Se monta en `use-app-shell-services.ts`.
- **Interfaz:** el aviso de cola del chat de un servidor sale con "En {servidor}" y sin botones (cancelar y _Launch anyway_ son la PR 3); la barra lateral une la cola local con la de los servidores para el reloj de arena y "En cola · N min".
- **Compatibilidad:** un servidor sin la capability no muestra cola y no da errores. Para ver la cola de la MSI, la MSI debe tener este release.
- **Sin cubrir todavía:** tarjetas sobre terminales de un servidor y tablero por máquina. No se verificó con la MSI real.
