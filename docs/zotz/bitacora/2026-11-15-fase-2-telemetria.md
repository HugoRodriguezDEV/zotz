# Fase 2 (`zotz/fase-2-telemetria`, PR #4)

2026-11-15

- Nuevo `src/shared/zotz/zotz-network-policy.ts`: features cloud permitidas (`telemetry`, `login`, `relay`, `share`, `connector`, `push`, `github-star`, `agent-state-rules`, `wsl-hosts-policy`). Solo `push` queda permitido mientras Hugo decide (Decisiones abiertas #1).
- Telemetría: `resolveEnvOverride()` siempre regresa `orca_disabled`; `deferStart()` no arma el cliente de PostHog. `mobile-client-telemetry`, `wsl-usage-reporter` y `plugin-install-telemetry` pasan por `track()`, que ya revisa el consent, así que no hizo falta otro guard. El renderer no habla con PostHog: todo pasa por IPC a `track()` en main.
- UI: se ocultan el switch "Share anonymous usage data" (Privacy, que se queda por los diagnósticos locales), el banner de primer arranque y las secciones de Settings `orca-account`, `artifacts` y `share-skills` (también en Cmd+J). `ArtifactPublishButton` no se pinta.
- `getOrcaCloudAuthConfig()` regresa `configured: false` y con eso caen login, relay, connector, artifacts y skills autenticados. Guards extra: relay (`main-process-relay-startup`), connector (`createDesktopConnectorCloud`) y descarga de skills compartidas sin login (`skill-cloud-package-service.withoutAuth`).
- Crashpad ya traía `uploadToServer: false` y no hay `submitURL`; no se tocó.
- Star-nag: al arrancar se marca `starNagCompleted` y ya no consulta a GitHub si diste estrella.
- `agent-state-rules` (bajaba de `github.com/stablyai/orca/releases` cada 4 h) y `wsl-hosts-policy` (igual, solo en Windows) ya no descargan; quedan las reglas incluidas en la app y los overrides locales.
- Tests: el setup de vitest `zotz-vitest-upstream-network-policy.ts` deja la política abierta para que los tests de upstream sigan probando el comportamiento de Orca sin tocarlos; `src/main/zotz/zotz-network-policy-guards.test.ts` la quita y prueba los guards reales (falla si se revierten).
- Pendiente "Listo cuando" (10 min con monitor de red): no se pudo correr aquí.

**Sorpresas / pendientes para Hugo**

- Upstream movió varios servicios a `orca.dev` (no `onorca.dev`). Siguen activos: el sistema de plugins (`pluginSystemEnabled: true` por default) clona `github.com/stablyai/orca-plugins` unos 15 s después de arrancar y, ya con plugins, baja `orca.dev/plugins/kill-list.json` cada 6 h y `orca.dev/plugins/stats.json` al abrir el catálogo. No se cortó porque `main-process-plugins.ts` está en el tope de 300 líneas y porque la kill-list sirve para bloquear plugins maliciosos; conviene decidirlo junto con el auto-update de plugins (Fase 3).
- Updater (`github.com/stablyai/orca` releases y atom, `orca.dev/changelog`, `orca.dev/whats-new/nudge.json`) es de Fase 3; no se tocó.
- Feedback y reportes de crash (`orca.dev/v1/feedback`) solo salen cuando el usuario los manda; se dejaron.
- `mobilePairingConnectionMode` sigue en `'automatic'` por default, pero sin login la UI marca el relay como no disponible y el pairing va local.
