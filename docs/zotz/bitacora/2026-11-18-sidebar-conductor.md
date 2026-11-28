# Barra lateral simple estilo Conductor (`zotz/sidebar-conductor`)

2026-11-18

- Nuevo default `zotzSidebarLayout` (≠ `'orca'`): arriba Inicio / Crear / Buscar; debajo cada proyecto con su `+` (abre el creador de workspaces de upstream con el proyecto elegido) y solo las conversaciones del usuario: sin el checkout principal salvo que tenga pestañas abiertas, sin lo creado por automatizaciones ni por la CLI, salvo lo que la CLI crea arrancando un agente (`--agent`, p. ej. una entrega a otro agente), que es una conversación nueva. Las carpetas sueltas (`~`) salen solo con pestañas abiertas.
- Enganche: un `if` en `components/sidebar/index.tsx`; el resto vive en `components/zotz/sidebar/`. Ajustes → General → "Barra lateral simple" regresa a las tarjetas de Orca.
- Pendiente: el switch "sin worktree" al crear (conversación directa en la carpeta del proyecto), marcar como "propias" las conversaciones abiertas desde Zotz para ocultar agentes externos dentro del mismo worktree, y "Conectar a mi servidor" en modo personal.
- `server-hook-session-binding.test.ts` y `journal-writer-operation-expiry.test.ts` ya fallaban en `main` antes de esta rama.
- Misma rama: cada conversación muestra el `AgentStateDot` de upstream (trabajando, pregunta, error, terminado, sin leer); los proyectos sin ícono toman el avatar de GitHub del dueño. Fase 8: el gobernador mide los chats nativos (pid del dueño en el lease de la sesión) y la cola también los retiene antes de arrancar (`zotz-structured-agent-start-hold.ts`, enganchado en `runStart`).
