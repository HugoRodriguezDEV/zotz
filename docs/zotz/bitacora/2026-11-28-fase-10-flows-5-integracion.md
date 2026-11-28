# Flows, parte 5: integración y migración de automatizaciones (`zotz/fase-10-flows-5-integracion`)

2026-11-28

- **Integración:** merge (no rebase) de lienzo, eventos y chat sobre el motor. Conflictos: `PLAN.md` (casillas y bitácoras de cada parte, se quedan todas), `zotz-flow-startup.ts` (imports de eventos y chat juntos), `en.json`/`es.json` y `protected-copy-keys.json` (unión de las claves de cada parte, ordenadas). El catálogo de RPC se regeneró. Al juntar faltaban el texto de `duplicate_slug` en el lienzo y el driver de chat en la prueba de eventos.
- Sin el aviso "Zotz todavía no escucha esto" en los disparadores de evento y chat.
- **"Ver corrida"** de la tarjeta del chat abre esa corrida en la página Flows: `ZotzRootOverlays` registra el abridor y la página la toma cuando su máquina ya listó el flow (la corrida se pide aparte por si es más vieja que la página de 50).
- La página Flows usa como máquina de un flow la que lo listó: un servidor solo se conoce a sí mismo como `local`.
- **Migración** (`zotz-flow-automation-migration.ts`, `zotz-flow-from-automation.ts`): al arrancar, cada automatización de esta máquina pasa a un flow: disparador Programado con su rrule, zona y `dtstart`; si tenía chequeo previo, Comando (mismo comando, timeout y carpeta) → Condición `exit_code_zero` → Agente con el mismo agente, prompt, setup, workspace, rama, sesión y contexto de proyecto. El flow sigue desde el `nextRunAt` de la automatización y guarda `migratedFromAutomationId`; la original queda `enabled: false`.
  - Una sola vez por automatización: `zotz-flow-migrations.json` guarda las migradas (aunque después borres su flow) y a quién ya se avisó. También migra las que se creen después por otros caminos (móvil, RPC).
  - Corre en la máquina dueña: en el escritorio las `local_host_service`; en `zotz serve` también las `remote_host_service`, con `hostId` = el host del proyecto. Las réplicas de un servidor en el escritorio no se tocan.
  - **Sin migrar, con aviso** (notificación una vez y log): las de SSH (`ssh_bridge` o destino `ssh:`), porque un flow corre sus pasos en la máquina Zotz que lo guarda y un host SSH no tiene Zotz; y las de un plugin activo, porque el plugin las sigue editando por su RPC.
  - **Doble disparo:** `captureLegacyRunTarget` (el primer paso del tick y de "Run now") cancela en silencio una automatización con su flow encendido, y todas esperan mientras Flows carga. Para volver: apagar el flow y prender la automatización.
- **`zotz automations create`** crea la automatización y la convierte al momento con el RPC nuevo `zotz.flows.migrateAutomation` (dice el flow creado y cómo correrlo). Si la máquina no tiene Flows o es SSH, queda como automatización y lo dice. Los demás comandos de `automations` no cambian.
- **Automatizaciones oculta:** cualquier cosa que abra esa vista cae en Flows; en la barra de Orca su fila queda apagada y Flows ocupa su lugar (la barra simple ya solo tenía Flows).
- **Corridas anteriores:** en la pestaña Corridas de un flow migrado, la historia de su automatización (RPC existente `automation.runs` en la máquina del flow), solo lectura.
- Pasos Agente con proyecto de un servidor (`runtime:`) se lanzan como automatización `remote_host_service`, igual que una automatización del servidor; antes el destino los rechazaba.
- `zotzFlowSlugFromName` pasó a `src/shared/zotz/flows/zotz-flow-slug.ts` (con `uniqueZotzFlowSlug`) para usarlo en main.

**Verificado** en una instancia dev en segundo plano (CDP, capturas y salida de la CLI en `capturas/flows-integracion/`), con un repo de prueba local y Claude (Codex no está en el PATH de esta Mac):

- `revisar-pr` (chat `/revisar-pr` y PR abierto → Agente con JSON `{ riesgo, resumen }` → Condición riesgo = alto → Aprobación → Agente → nota): `/revisar-pr enfocate en seguridad` desde el chat; la tarjeta mostró cada paso, "View run" abrió el lienzo en la corrida #1 esperando aprobación, se aprobó desde el lienzo y terminó `done` con la nota en la tarjeta. El flow se importó por CLI y se revisó en el lienzo (no se armó nodo por nodo con el mouse).
- Migración: una automatización creada por el RPC viejo (cada 3 min, con chequeo) se volvió al reiniciar un flow Comando → Condición → Agente y quedó apagada. El flow corrió solo a la hora que tocaba la automatización y a la siguiente; la automatización, reencendida a mano y vencida, no corrió. Con su flow apagado, "Run now" de la automatización sí corrió, y esa corrida aparece como "Corridas anteriores".
- `zotz automations create` respondió con el flow creado y la automatización quedó apagada.

## Sorpresas / pendientes

- **Móvil** (lista de flows, correr, aprobar, ver corridas, `/flow` en su chat): pendiente por decisión de Hugo, va cuando se habilite el teléfono.
- Sin probar en un servidor real: la migración en `zotz serve` y los pasos Agente con proyecto `runtime:`.
- Un prompt de automatización con `{{` no pasa la validación de plantillas: esa automatización se queda sin migrar (se reintenta en cada arranque).
