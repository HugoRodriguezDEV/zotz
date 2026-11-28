# Cola de memoria de los servidores, acciones (`zotz/cola-servidores-acciones`)

2026-11-20

- Spec: [`SPEC-servidores-cola-y-archivar.md`](../specs/SPEC-servidores-cola-y-archivar.md), Parte B, fase 3. Desde la laptop se puede cancelar un arranque en cola de un servidor o pulsar _Launch anyway_.
- **Servidor:** llamadas RPC nuevas `zotz.agentQueue.cancel`, `forceStart` y `dismissCanceled` (permiso `workspace`, id de 1 a 1024 caracteres, igual que el IPC de la ventana) y la capability `zotz.agent-queue-control.v1`, aparte de la de lectura porque un servidor que publica su cola puede no tener todavía estas llamadas. En un servidor sin limitador no hacen nada ni fallan.
- **Cliente:** `zotz-host-agent-queue-actions.ts` llama al servidor y, si falla, avisa con el nombre del servidor; no actualiza nada a mano porque el flujo de la cola del servidor reporta el resultado. Los botones del aviso del chat de un servidor salen solo si declara la capability de control.
- **Sin cubrir todavía:** tarjetas sobre terminales de un servidor (falta comprobar que la clave de panel coincide) y el tablero por máquina. No se verificó con la MSI real.
