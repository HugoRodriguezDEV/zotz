# Fase 4 (`zotz/fase-4-agentes`)

2026-11-17

- Permisos: no hizo falta código. Un perfil nuevo trae `agentPermissionDefault: 'full-access'` y en cada lanzamiento se convierte en flags (`claude`/`agy` → `--dangerously-skip-permissions`, `codex` → `--dangerously-bypass-approvals-and-sandbox`) o en política de chat (Codex `never` + `danger-full-access`; Claude con skip-permissions; Antigravity por ACP en modo `yolo`). El `'own'` de `agent-launch-profile.ts:161` solo arma vistas del selector, no pisa el lanzamiento.
- Workspace trust: tampoco hizo falta código. Orca pre-confía la carpeta para Claude (`~/.claude.json`), Codex (`config.toml`) y Antigravity (`~/.gemini/antigravity-cli/settings.json`) justo antes de cada lanzamiento, en cualquier modo de permisos y también en workspaces de carpeta (`agentWorkspaceTrustEnabled`, default `true`).
- Agentes visibles: `applyZotzVisibleAgents` se engancha en los defaults y al cargar el perfil. Guarda en `zotzSeenTuiAgents` qué agentes del catálogo ya vio, así que los que agregue upstream en un sync nacen ocultos y lo que Hugo active o desactive a mano se respeta.

**Sorpresas / pendientes**

- Casos en que un agente sí puede preguntar: Claude cuando la carpeta es la raíz de un disco o el home (`isTooBroadToPreTrust`); Antigravity si arranca en una subcarpeta del workspace (solo confía rutas exactas); escribir `claude`/`codex`/`agy` a mano en una terminal (no pasa por el pre-trust); Codex en WSL; hosts SSH con relay viejo. Para el nodo: abrir cada proyecto como su propio workspace, nunca `C:\` ni la carpeta del usuario.
- Un perfil guardado con `agentYoloDefaultsMigrated: true` pero sin `agentPermissionDefault` cae en `'own'` (sin flags). No pasa con perfiles nuevos de Zotz.
- Antigravity, aun en `yolo`, a veces hace preguntas o pide revisiones administrativas (lo dice su propio spec en `antigravity-acp-launch-spec.ts`).
- La MSI (Katana 15, 16 GB) solo tiene `claude` en el PATH. Falta instalar `codex` y `agy` para cerrar el "Listo cuando".
