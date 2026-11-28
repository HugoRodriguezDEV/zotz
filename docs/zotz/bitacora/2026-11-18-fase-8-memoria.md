# Fase 8, parte 1 (`zotz/fase-8-memoria`)

2026-11-18

- **Cola (datos):** `src/shared/zotz/agent-queue/`. FIFO multinivel (manual › remota › automatización) con relleno y envejecimiento (10 min o 3 rebases), libro de picos (mediana de 20 corridas, topada en el máximo por agente), defaults según la RAM y nivel de presión. Persistencia en `zotz-agent-queue-store.ts` (hoy solo la usa el libro de picos).
- **Medición (8a/8b):** `ZotzMemoryGovernorService`.
  - Junta las filas de hooks (agente, estado, workspace) con los PTY locales y mide su árbol completo con `collectMemorySnapshot`. La memoria disponible sale de `collectHostMemory`.
  - Muestrea cada 15 s solo con agentes vivos o tareas en cola, y los cambios de estado de los agentes lo despiertan.
- **Admisión (8c):** `ZotzAgentLaunchQueue` espera en el `admission` de `runPtySpawn`, tanto en los spawns del renderer como en los del runtime, así que cubre UI, CLI, móvil, automatizaciones y orquestación.
  - Prioridad: el renderer cuenta como manual; `mobile` y `cli` como remota; lo demás como automatización.
  - Un remontaje del mismo pane se une a su entrada. Nunca retiene reattach ni restauraciones.
  - Solo admite con una muestra fresca (≤20 s) y presión `ok`.
- **UI (8g):**
  - "En cola" dentro de la pestaña (turno, motivo, Cancelar / Lanzar de todos modos).
  - Indicador en la barra de estado que abre el tablero: barra de RAM y columnas Backlog / In Progress / Review / Done.
  - Switch "Cola de agentes por memoria" en Ajustes → General. Al apagarlo arranca todo lo que esperaba.

**Pendientes (parte 2)**

- Responder pronto a los clientes remotos. Hoy el celular (30–90 s) y la CLI (60 s) marcan "no confirmado" si la tarea espera más, aunque arranque después.
- Persistir las tareas en cola entre reinicios.
- Retener también el chat nativo (`claimStructuredAgentSessionAgent`).
- 8d/8e: pausar con presión crítica (SIGSTOP / `NtSuspendProcess` vía el patch de node-pty) y topes por agente (Job Objects en Windows).
- 8f: Ajustes → Recursos con los límites editables.
- La reserva de un agente recién admitido dura 90 s y puede contarlo dos veces junto a su medición durante ese rato, así que admite de menos, nunca de más.
- Falta la prueba de punta a punta con agentes reales: en la MSI no hay Visual Studio C++ para correr Zotz desde el código.
