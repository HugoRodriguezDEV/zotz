# Hijos también desde `orchestration worker-start` (`zotz-hijos-worker-start`)

2026-11-24

- Las conversaciones que un agente crea con `zotz orchestration worker-start` no quedaban como hijas: ese camino crea el worktree con `createManagedWorktree` sin procedencia de CLI, así que nunca se guardaba `zotzParentWorktreeId`. Caso real: el orquestador de `avena-backoffice` creó `crear-panel-empresas` y `empresas-admin-backend` con `--worktree new-top-level --repo` y salieron sueltas en sus proyectos.
- `resolveWorkerWorktreeCreationTarget` ahora lleva la conversación que despacha (`zotzCreatorWorktreeId`, con `new-child` y `new-top-level`) y `recordZotzWorkerCreator` la escribe justo después de crear. Se escribe después y no al crear porque una creación `created-by-cli` fija el nombre generado y apagaría el renombrado por primer trabajo; por lo mismo guarda `displayNameIsPinned` explícito.
- Las conversaciones ya creadas antes del arreglo no se corrigen solas; se pueden arrastrar a un grupo.
- `pnpm check:changed`: solo fallan dos pruebas de `agent-launch-replay`, que fallan igual en `origin/main` (2c728b8cc2c) en esta Mac.
