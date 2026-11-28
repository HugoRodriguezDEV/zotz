# Fase 8: ver qué espera en la cola (`memory-limiter-backlog-indicador`)

2026-11-19

- Un chat nativo retenido por la cola no decía nada: el agente se quedó ~20 min en Backlog sin que se notara. Ahora el chat muestra la misma tarjeta "En cola" que la terminal, arriba del compositor (`ZotzQueuedChatNotice`, una línea en `NativeChatStructuredSession`). Se busca por la llave canónica de la sesión, sin importar qué pestaña la muestre.
- Barra lateral simple: la conversación con un agente en cola lleva un reloj de arena y "En cola · N min" en color de pendiente, por encima del estado de sus hilos.
- La tarjeta dice cuántos minutos lleva esperando.
- **Por qué esperó con RAM de sobra:** el tope de agentes simultáneos (4 con 32 GB, 2 con 16 GB) contaba a todos los agentes con sesión abierta, también los que esperaban respuesta. Con 4 chats abiertos, el quinto se quedaba en cola por `concurrency` aunque sobrara memoria.
- **Decisión (Hugo, 2026-11-19): solo decide la RAM.** Se quitaron el tope por cantidad (`maxConcurrentAgents`) y el presupuesto del 70 % para agentes (`agentBudgetBytes`). Un agente entra si, después de su costo estimado, quedan libres `minFreeGb` (max(2 GB, 15 %)) y la presión es `ok`; si no, espera y arranca solo cuando se libera memoria (muestra cada 15 s mientras haya cola). La memoria disponible la reporta el sistema, así que incluye los procesos en segundo plano de los agentes.
- Para que una ráfaga no llene la RAM: un agente admitido aparta durante 90 s lo que le falta de su estimación (estimación − lo medido), porque al arrancar mide poco. Antes la reserva se soltaba con la primera medición y el tope por cantidad tapaba el hueco.
