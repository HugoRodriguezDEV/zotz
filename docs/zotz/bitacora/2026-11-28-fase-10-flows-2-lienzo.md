# Flows, parte 2: lienzo (`zotz/fase-10-flows-2-lienzo`)

2026-11-28

- Página **Flows** (vista `zotz-flows`) con entrada en las dos barras laterales: junto a Automatizaciones en la de Orca y bajo Tareas en la simple (la simple es la default de Zotz y no tiene Automatizaciones). Componentes en `src/renderer/src/components/zotz/flows/`.
- Lienzo con `@xyflow/react` **12.12.1** (versión exacta; las 13.x tenían menos de dos semanas). Tema por variables de React Flow mapeadas a tokens; estados de corrida con `status-success`, `agent-working`, `agent-question`, `destructive` y `muted`.
- Editor: lista de flows a la izquierda (agrupada por máquina) que cambia a paleta de pasos al editar; lienzo con zoom, minimapa, deshacer/rehacer (⌘Z / Ctrl+Z) y auto-acomodo; inspector a la derecha; arriba nombre, máquina, encendido, Guardar y Correr (si hay cambios, "Guardar y correr").
- Inspector por tipo con los campos del contrato. Nodo Agente reusa `AutomationAgentLaunchPicker`, `AutomationEditorPromptEditor`, `AutomationProjectCombobox`, `AutomationWorkspaceField`, `AutomationSessionField` y `buildAutomationRunContextForRepo` con un adaptador nodo ↔ `AutomationDraft` (`zotz-flow-agent-draft.ts`); el disparador Programado reusa `AutomationSchedulePicker` (presets y cron); la máquina usa `HostCombobox`. No hubo que generalizar ningún componente de automatizaciones.
- Switch Markdown/JSON con editor de campos o JSON Schema pegado. Selector de plantillas con el **mismo alcance** que la validación; en Comando las plantillas van en `env` y la ayuda muestra `$ZOTZ_FLOW_X` / `$env:ZOTZ_FLOW_X`.
- `for_each` es un contenedor (nodo padre): soltar un paso dentro asigna `parentId`; meter o sacar un paso quita sus conexiones porque no pueden cruzar el borde.
- Validación en vivo con `validateZotzFlow` más el esquema zod (campos vacíos o slugs inválidos): marca nodo, arista o disparador y lista los problemas; Guardar se bloquea con errores. El conflicto de `save` ofrece cargar la versión guardada.
- Vista de corrida: mismo lienzo en solo lectura, color por estado, avance del bucle (`8/10 · 1 falló`) con selector de vuelta, detalle de entradas y salida, aprobar/rechazar, cancelar y reintentar (también desde un paso). Pestaña Corridas con el historial. Todo se actualiza con `zotz.flows.subscribe`.
- Teclado: Tab llega a nodos, aristas y disparadores; Enter selecciona; flechas mueven; Suprimir borra; Esc deselecciona; la paleta agrega después del paso seleccionado (o dentro del bucle seleccionado) y conecta la primera salida libre; el inspector conecta salidas y mete pasos a un bucle. Verificado armando el flow de ejemplo solo con teclado.
- Fixtures: `zotz/flows/ZotzFlowEditor` (`example`, `agentSelected`, `loopSelected`, `empty`) y `zotz/flows/ZotzFlowRunView` (`halfway`, `failedItem`).

## Cambios al contrato

- `createZotzFlowTemplateScope()` exportado desde `zotz-flow-validation.ts` (misma lógica que ya usaba la validación, sin cambiar resultados) para que el selector de plantillas no duplique el alcance.
- Las formas de respuesta y el evento del stream de `zotz.flows.*` las agregó el coordinador en la rama base (cb5db8558ad) a pedido de esta parte.

## Sorpresas / pendientes

- Los disparadores de evento y de chat muestran "Zotz todavía no escucha esto"; hay que quitar ese aviso cuando lleguen las partes 3 y 4.
- Cambiar la máquina de un flow ya guardado está bloqueado: moverlo entre máquinas necesita borrar y guardar en otra, que no está en el contrato.
- Legibilidad primero: al abrir, en la vista de corrida y después de Acomodar, el flow se encuadra entero solo si cabe entre 80 % y 100 %; si no, queda a 80 % desde su esquina superior izquierda (los disparadores) y el resto se ve moviendo el lienzo. A 80 % el texto de los nodos mide lo mismo que el del inspector. "Ajustar a la vista" (abajo a la izquierda, junto a acercar y alejar) sí encuadra todo sin mínimo. Los paneles de pasos e inspector se pliegan y se recuerdan por usuario (`localStorage`).
- `AutomationWorkspaceField` ofrece "Nueva corrida" también en carpetas sin git; queda como en automatizaciones.
- Dormir un workspace desde la barra lateral deja a Zotz sin workspace activo (oráculo `sleep-quit-resume`, falla igual en la rama del contrato); se agregó una excepción en `tests/e2e/workspace-layout-oracle-known-on-main.ts`. Investigar y quitar la excepción al arreglarlo.
