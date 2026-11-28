# Zotz — Plan de trabajo

Zotz es un fork de [stablyai/orca](https://github.com/stablyai/orca) para correr en una MSI con Windows encendida 24/7 como **nodo remoto de agentes**. Hugo le manda tareas a distancia por **Tailscale** y los agentes (**Claude Code, Codex y Antigravity**) trabajan con acceso total a la máquina, sin que Orca ni ningún servicio externo se meta.

> Mascota y logo: un murciélago (_zotz_ en maya). Trabaja de noche, se orienta solo en la oscuridad y le gusta a los devs nocturnos.

---

## Reglas para quien ejecute este plan

1. **Lee `AGENTS.md` antes de tocar nada.** Sus reglas de gates, estilo y multiplataforma aplican aquí.
2. **Una fase por rama/PR**: `zotz/fase-N-<tema>`. No mezcles fases.
3. **Diff mínimo contra upstream.** Vamos a seguir jalando cambios de Orca, así que:
   - Cambia **configuración, defaults y textos visibles**, no renombres identificadores internos en masa.
   - **No renombres** variables `ORCA_*`, paquetes `@orca/*`, nombres de RPC ni el protocolo de pairing. (La Fase 1c renombra solo lo que choca con Orca o se ve: CLI, `~/.orca`, procesos; ver `RENAME-SPEC.md`.) Si lo haces, se rompe la compatibilidad con la app móvil oficial de Orca y cada sync con upstream va a ser un infierno.
   - Si necesitas lógica nueva, ponla en archivos nuevos con nombre `zotz-*` y engánchala con un cambio de pocas líneas en el código existente.
4. **No borres features de upstream**: desactívalas desde un default o un guard. Así hacer rebase es barato.
5. Antes de cada push: `pnpm check:changed`. Nunca `--no-verify`.
6. Apps lanzadas por agentes: `ORCA_BACKGROUND_LAUNCH=1`.
7. **Cada cambio anota su bitácora en un archivo propio**: `bitacora/AAAA-MM-DD-<rama>.md` (qué cambió, cómo se verificó, sorpresas). No agregues entradas a este archivo ni edites la de otro PR: así dos PRs abiertos nunca chocan. Ver [`README.md`](./README.md).
8. **Cada spec va en `specs/`** (`specs/SPEC-<tema>.md`) y cada guía de uso u operación en `guias/`. Este archivo solo guarda reglas, fases y decisiones; al cerrar una fase, marca aquí su checklist.

---

## Fase 0 — Setup del repo

- [x] Agregar el remote upstream: `git remote add upstream https://github.com/stablyai/orca.git`.
- [x] Documentar en `docs/zotz/guias/SYNC.md` cómo sincronizar: `git fetch upstream && git rebase upstream/main` (o merge) en una rama `zotz/sync-YYYY-MM-DD`, resolver conflictos y correr los gates.
- [x] `LICENSE`: **dejar intacto** el copyright de StablyAI (MIT lo exige) y agregar debajo `Copyright (c) 2026 Hugo Rodríguez (Zotz modifications)`.
- [x] README: agregar arriba una sección corta "Zotz es un fork de Orca" con link al original. El resto del README se queda. (Reemplazado el 2026-11-20: el README es de Zotz, sin nombres ni enlaces de Orca; el crédito queda en `LICENSE`.)
- [x] Revisar `.github/workflows`: desactivar los workflows de release/publish que apunten a stablyai o requieran sus secrets (renombrar a `.disabled` o agregar `if: github.repository == 'stablyai/orca'`). Los de CI (lint/test) se quedan.

**Listo cuando:** CI corre verde en el fork y ningún workflow intenta publicar.

---

## Fase 1 — Rebrand a Zotz

Archivos clave:

| Qué                      | Dónde                                                                                      | Cambio                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre del paquete y CLI | `package.json` → `name`, `bin`                                                             | `name: "zotz"`, `bin: { "zotz": "./out/cli/index.js" }`. Quitar el bin `orca` para no chocar con una instalación de Orca.                           |
| App ID                   | `config/electron-builder.config.cjs:126`                                                   | `const appId = 'dev.hugorodriguez.zotz'`                                                                                                            |
| Nombre visible           | mismo archivo, `productName` (≈ línea 254)                                                 | `'Zotz'`                                                                                                                                            |
| Protocolo de links       | mismo archivo, `protocols` (≈ línea 255)                                                   | `[{ name: 'Zotz', schemes: ['zotz'] }]`                                                                                                             |
| Ejecutables              | mismo archivo, `executableName` (≈ líneas 562 y 705)                                       | `'Zotz'` / `'zotz'`                                                                                                                                 |
| Publisher de Windows     | mismo archivo (≈ línea 568)                                                                | quitar `SignPath Foundation`; sin firma por ahora                                                                                                   |
| Feed de publish          | mismo archivo, `publish` (≈ línea 787)                                                     | `owner: 'HugoRodriguezDEV'`, `repo: 'zotz'`                                                                                                         |
| Directorio de datos      | `src/cli/runtime/profile/metadata.ts` (`getPlatformUserDataPath`) y su contraparte en main | Debe resolver a una carpeta `Zotz`, separada de la de Orca. Confirmar que la CLI y la app de Electron resuelven **la misma** ruta.                  |
| Íconos                   | `resources/build/` (icon.icns, .ico, .png), `resources/tray/`, `resources/app-icons/`      | Reemplazar por el murciélago (ver Fase 1b). Mismos nombres y tamaños de archivo.                                                                    |
| Textos visibles          | menús, título de ventana, tray, ayuda de la CLI, onboarding                                | "Orca" → "Zotz" **solo en strings visibles al usuario** y solo en el locale base (`en`) + `es` si existe. No toques los demás idiomas en esta fase. |

- [x] Aplicar la tabla.
- [x] `grep -rn "'Orca'\|\"Orca\"" src/main src/renderer src/cli` para encontrar strings visibles que se hayan escapado. Cambiar solo las visibles.
- [x] Verificar que `zotz --help` y `zotz serve --help` muestran "zotz".

**Fase 1b — Logo:** murciélago pixelado frente a la luna. Las cuadrículas viven en `resources/icon-source/zotz-bat-pixel.mjs` y `pnpm build:icons` (`generate.sh` → `render-zotz-icons.mjs` + `iconutil`) regenera todos los íconos pixel exactos.

**Listo cuando:** un build de Windows instala como "Zotz", con ícono de murciélago, convive con Orca instalado y guarda datos en su propia carpeta.

---

## Fase 1c — Nombres internos y CLI `zotz`

Spec en [`RENAME-SPEC.md`](./specs/RENAME-SPEC.md). Va después de la Fase 3b para que llegue por el actualizador.

- [ ] CLI `zotz` en el PATH global; `orca` solo como alias dentro de las terminales de Zotz.
- [ ] `~/.orca` → `~/.zotz`, procesos `zotz-*.exe`, etiquetas de launchd, sidecar de macOS y ejecutable de Linux, con migración.
- [x] Alias `ZOTZ_*` → `ORCA_*` al arrancar cada proceso.
- [ ] **No** se renombran protocolo/RPC/pairing (app móvil oficial) ni `ORCA_*`/`@orca/*` en el código (costo de sync).

---

## Fase 2 — Cero telemetría y cero "phone home"

Hoy Orca manda eventos a PostHog y se conecta a varios dominios de `onorca.dev`.

### 2a. Telemetría

- [x] `src/main/telemetry/consent.ts` → `resolveEnvOverride()`: hacer que siempre regrese `{ effective: 'disabled', reason: 'orca_disabled' }` (reutiliza la razón existente para no tocar tipos). Un cambio de una línea al inicio de la función.
- [x] `src/main/telemetry/posthog-client-start.ts`: guard para que nunca arranque el cliente.
- [x] `src/main/telemetry/mobile-client-telemetry.ts` y `wsl-usage-reporter.ts`: confirmar que respetan el consent; si no, mismo guard.
- [x] Ocultar en Settings el toggle y el banner de telemetría (no tiene caso mostrarlo).
- [x] `src/main/crash-reporting/capture/crashpad-capture.ts`: confirmar que no sube nada (`uploadToServer: false`). Los dumps locales se quedan.
- [x] `src/main/star-nag`: desactivar (es el aviso de "danos una estrella en GitHub").

### 2b. Endpoints de `onorca.dev`

Encontrados en `src/`: `share.`, `push.`, `relay.`, `relay-c1.`, `c2.relay.`, `login.`, `connector.`, `www.onorca.dev`.

- [x] Centralizar en un archivo nuevo `src/shared/zotz/zotz-network-policy.ts` una lista de features cloud permitidas (por default **ninguna**) y usarla como guard en cada punto donde se usan esos dominios.
- [x] **relay**: desactivado. El pairing va directo por Tailscale (ver Fase 5); no se usa `--relay`.
- [x] **share / connector / login**: desactivados y ocultos en la UI.
- [ ] **push**: ver _Decisiones abiertas_. No lo desactives hasta que Hugo decida.

**Listo cuando:** al arrancar la app y usarla 10 minutos con un agente corriendo, el monitor de red (`read_network_requests` o Wireshark/Resource Monitor) **no muestra** tráfico a `posthog`, `onorca.dev` ni `stablyai` (salvo `push` si se decidió dejarlo).

---

## Fase 3 — Updates bajo control

Un auto-update del Orca original pisaría el fork o reiniciaría la app a media tarea.

- [x] `src/main/updater/updater-service.ts`: hacer que `checkForUpdates()` y la revisión automática no hagan nada, salvo que `ZOTZ_ENABLE_UPDATER=1`. Dejar `checkForUpdatesFromMenu` mostrando un mensaje de "Zotz se actualiza con git pull + build".
- [x] `src/main/updater/serve-update-handoff.ts`: confirmar que el modo `serve` no se auto-actualiza.
- [x] Plugins: default de `ORCA_PLUGIN_AUTO_UPDATE` en `src/main/startup/plugin-startup/main-process-plugins.ts` → apagado.
- [x] Ocultar los nudges de update (`src/main/updater/nudges`).
- [x] Escribir `docs/zotz/guias/UPDATE.md`: cómo actualizar Zotz en la MSI (`git pull`, `pnpm install`, `pnpm build`, reiniciar el servicio).

**Listo cuando:** la app corre 24 h sin pedir ni instalar updates.

---

## Fase 3b — Updates desde los releases de Zotz

Reemplaza la regla "Zotz no se auto-actualiza" de la Fase 3: el actualizador de Orca se reapunta a `HugoRodriguezDEV/zotz`. Spec completo en [`UPDATES-SPEC.md`](./specs/UPDATES-SPEC.md).

- [x] CI publica releases versionados `v1.4.<parche×100 + build>` (estables, con `latest*.yml`, `.blockmap` y `zip` de macOS) en vez de `desktop-latest`.
- [x] El actualizador usa `ZOTZ_RELEASE_REPO` en lugar de `stablyai/orca`; changelog y nudges de `orca.dev` apagados; solo canal estable.
- [x] Encendido por default con switch en Ajustes; revisa cada 6 h y descarga en segundo plano; nunca reinicia sola.
- [x] Modo servidor: instala solo tras 10 min sin agentes corriendo ni en cola.
- [x] macOS sin firma: solo aviso con enlace al `.dmg`.
- [ ] Única instalación manual de la primera versión versionada; borrar `desktop-latest`.

**Listo cuando:** un cambio mergeado a `main` llega a la MSI como "Hay una versión nueva", se instala al reiniciar y, en modo servidor, nunca interrumpe a un agente.

---

## Fase 4 — Agentes: Claude Code, Codex y Antigravity con acceso total

Orca ya trae casi todo:

- Default global de permisos: `src/shared/default-global-settings.ts:262` → `agentPermissionDefault: 'full-access'`. **Ya está en full-access**; confirmar que un perfil nuevo lo hereda y que `src/shared/agent-launch/choices/agent-launch-profile.ts:161` (`'own'`) no lo pisa en el perfil por defecto.
- Flags por agente: `src/shared/agent-launch/permissions/tui-agent-permissions.ts` (`YOLO_TUI_AGENT_ARGS`).
  - Claude Code (`claude`): `--dangerously-skip-permissions`
  - Codex (`codex`): la receta de full-access de ese archivo
  - Antigravity (`agy`): `--dangerously-skip-permissions` (línea 21)
- Comandos de detección: `src/shared/agent-launch/catalog/tui-agent-config.ts` (`claude`, `codex`, `agy`).

Tareas:

- [ ] Verificar en Windows que los tres CLIs se detectan (`where claude`, `where codex`, `where agy`) y arrancan en full-access desde terminal **y** desde chat. (Código revisado: un perfil nuevo lanza los tres en full-access en terminal y chat. En la MSI solo está `claude`; faltan instalar `codex` y `agy` y probarlos a mano.)
- [x] Codex: confirmar que full-access implica `--sandbox danger-full-access` y sin aprobaciones, también en `src/shared/agent-launch/permissions/codex-permission-policy.ts`.
- [x] Workspace trust: confirmar que `agent-workspace-trust-decision.ts` / `workspace-pretrust-scope.ts` no frenan a ningún agente con un prompt de "¿confías en esta carpeta?". Si lo hacen, pre-confiar las carpetas de trabajo de la MSI.
- [x] ~~Setting nuevo `zotzVisibleAgents`~~ Reemplazado: se reusa `disabledTuiAgents` de upstream (ya oculta agentes del selector y del auto-launch sin borrarlos del catálogo); `src/shared/zotz/zotz-visible-agents.ts` deja visibles solo `claude`, `codex` y `antigravity`. **No borres** los demás agentes del catálogo; solo ocúltalos.

**Listo cuando:** desde el móvil o la laptop, por Tailscale, lanzas una tarea a cada uno de los tres agentes y la completan sin pedir ninguna aprobación.

---

## Fase 5 — Nodo 24/7 en Windows

Hoy `orca serve service` **no existe en Windows**: `src/cli/server/serve-service.ts:57` lanza _"not available on Windows yet"_. Linux y mac usan `src/cli/runtime/serve/supervision/serve-service-unit.ts`.

### 5a. `zotz serve service` para Windows

- [x] Implementar la variante de Windows en `serve-service-unit.ts`, siguiendo el patrón de las otras plataformas: `install`, `status` y `uninstall`. (Vive en `src/cli/server/zotz-windows-serve-service.ts`, enganchada desde `serve-service.ts`; el XML de la tarea en `src/shared/zotz/zotz-windows-scheduled-task.ts`.)
- [x] Mecanismo: **Tarea programada de Windows** (`schtasks` o `Register-ScheduledTask` vía PowerShell), **no** un servicio de Windows. Un servicio corre en la sesión 0, sin escritorio, y entonces computer use y el navegador no funcionan.
  - Disparador: _al iniciar sesión_ del usuario dedicado.
  - Reiniciar si falla: cada 1 min, intentos ilimitados. (RestartOnFailure llega a 999 como máximo y no vigila la salida del proceso, así que el disparador se repite cada minuto con `IgnoreNew` como watchdog.)
  - Sin límite de tiempo de ejecución.
  - "Ejecutar aunque esté con batería".
- [x] Usar `runProcess` de `@orca/process-host` (ya importado), no `child_process` directo. Leer `docs/agents-md-refs/cross-platform-support.md` antes.

### 5b. Que Windows no se duerma

`src/main/power/` solo tiene asserts de mac (`macos-system-sleep-assertion.ts`) y Linux (`linux-lid-sleep-assertion.ts`).

- [x] Agregar `windows-system-sleep-assertion.ts` con `powerSaveBlocker.start('prevent-app-suspension')` de Electron (o `SetThreadExecutionState` si hace falta más fuerza), y conectarlo en `agent-awake-service.ts`. En modo serve debe estar activo **siempre**, no solo mientras haya un agente corriendo.

### 5c. Script de preparación de la MSI

Crear `resources/win32/zotz/zotz-node-setup.ps1` (el plan decía `scripts/windows/`, pero el guard de la raíz no admite carpetas nuevas) (idempotente, requiere admin, cada paso imprime qué hizo):

- [x] `powercfg`: nunca suspender ni hibernar con corriente, y que cerrar la tapa no haga nada.
- [x] Windows Update: horas activas 0–23 y sin reinicio automático con sesión iniciada (`NoAutoRebootWithLoggedOnUsers`). (Windows acepta máximo 18 h de horas activas: quedan 6:00–24:00, parametrizables.)
- [x] Inicio de sesión automático del usuario dedicado (vía Sysinternals Autologon; documentarlo, no guardar la contraseña en texto plano).
- [x] Instalar y habilitar **OpenSSH Server**, solo con llave (`PasswordAuthentication no`).
- [x] Regla de firewall: el puerto de `zotz serve` y el 22 **solo** desde la interfaz de Tailscale (`100.64.0.0/10`).
- [x] ~~Llamar a `zotz serve service install --bind <IP-tailscale>`.~~ Reemplazado: el script registra la tarea `\Zotz\Server`, que arranca la **app de escritorio en modo servidor** (computer use y navegador necesitan el escritorio; ver `docs/zotz/guias/NODE-SETUP.md`), y no se fija a la IP de Tailscale porque cambia.
- [x] Nota para Hugo, no automatizable: en el BIOS de la MSI, activar _Restore on AC Power Loss_ (o equivalente).

### 5d. Asistente de primer arranque (personal vs. servidor remoto)

La primera vez que se abre Zotz (y después desde Ajustes) pregunta el **modo de la máquina**. Decisiones de Hugo (2026-11-16): se pregunta **al primer arranque**, no en el instalador; en modo servidor se configura **todo de forma automática con un solo permiso de administrador**; si falta Tailscale se **guía e instala**; el autologon **solo se documenta**.

- [x] Setting nuevo `zotzMachineMode: 'unset' | 'personal' | 'server'` (default `'unset'`). Mientras sea `'unset'`, se muestra el asistente. Cambiable en Ajustes.
- [x] **Personal**: no toca el sistema; Zotz se comporta como hoy.
- [x] **Servidor remoto**: detecta el SO y ejecuta los pasos de esa plataforma, mostrando cada uno con su estado (hecho / omitido / falló + por qué). Idempotente: re-ejecutarlo no duplica nada.
  - **Tailscale**: detectar si está instalado y con sesión. Si falta, ofrecer instalarlo (Windows `winget install Tailscale.Tailscale`, macOS `brew install --cask tailscale` o link, Linux script oficial) y esperar a que tenga IP `100.x`. Tomar la IP de Tailscale como dirección de pairing.
  - **Firewall** solo desde `100.64.0.0/10` al puerto del servidor (Windows `New-NetFirewallRule`; Linux `ufw` si está activo; macOS no requiere).
  - **No dormirse**: Windows `powercfg` (sin suspensión/hibernación en corriente, tapa sin acción) + bloqueo de suspensión de 5b; macOS `pmset`/assertion; Linux inhibidor de systemd.
  - **Arranque automático y reinicio si falla**: Windows tarea programada de 5a; macOS LaunchAgent; Linux unidad systemd de usuario (ya existen en `serve-service-unit.ts`).
  - **Exposición de red permanente** en la IP de Tailscale (hoy solo se abre al pulsar "Compartir este equipo").
  - **Enlace de acceso / QR** generado al final, listo para pegar en la laptop o escanear con el móvil.
  - **Autologon (Windows)**: solo instrucciones + link a Sysinternals Autologon; Zotz nunca pide ni guarda la contraseña.
- [x] Todo lo que requiere admin en Windows se agrupa en **un** script (`zotz-node-setup.ps1` de 5c) lanzado con **una** elevación UAC; macOS/Linux usan el diálogo de privilegios del sistema (`osascript … with administrator privileges` / `pkexec`) solo donde haga falta.
- [x] Lógica nueva en archivos `zotz-*` (main: orquestador por plataforma; renderer: pantalla del asistente usando primitivas shadcn de `components/ui` y `docs/STYLEGUIDE.md`); textos en `en` + `es`.

Verificación en hardware real (pendiente; nada de esto se pudo probar desde la Mac de desarrollo, pasos en `docs/zotz/guias/NODE-SETUP.md`):

- [ ] Windows (MSI): el asistente pide una sola UAC y deja ✓ en cada paso; la tarea relanza Zotz al cerrarlo; el enlace/QR conecta desde la Mac y el móvil.
- [ ] Windows: `orca serve service install|status|uninstall` (perfil por defecto).
- [ ] macOS: `pmset` solo pide contraseña si hace falta; el LaunchAgent abre Zotz al iniciar sesión.
- [ ] Linux: regla `ufw` con `pkexec` y la unidad `zotz-server.service` al iniciar sesión.
- [ ] "Listo cuando" de abajo (corte de corriente con Autologon y _Restore on AC Power Loss_).

**Listo cuando:** desconectas y reconectas la corriente, la MSI prende sola, inicia sesión, Zotz levanta en modo serve y en menos de 2 minutos puedes mandarle una tarea por Tailscale.

---

## Fase 6 — Acceso remoto por Tailscale

- [x] ~~`zotz serve` escucha **solo** en la IP de Tailscale de la MSI (`--bind`)~~ Reemplazado: en modo servidor Zotz escucha en todas las interfaces pero **solo admite** loopback y tailnet (`zotz-tailnet-source-guard.ts`), y el firewall de Windows limita el puerto a `100.64.0.0/10` (ver `docs/zotz/guias/REMOTE.md`).
- [x] Pairing directo por la tailnet, sin relay: enlaces/QR del asistente con la IP de Tailscale, o `orca pair --address <IP-100.x>` (ver `src/cli/server/pair.ts`).
- [ ] Probar el pairing desde: (1) la laptop de Hugo con Zotz u Orca, (2) la app móvil oficial de Orca. Si la app móvil oficial no puede parear sin relay, anotarlo en _Decisiones abiertas_.
- [x] Documentar en `docs/zotz/guias/REMOTE.md` cómo conectarse: Tailscale, pairing, SSH de respaldo.

---

## Fase 7 — Higiene de seguridad (acceso total ≠ acceso a todo)

Los agentes tienen acceso total **a la MSI**; que esa máquina no tenga nada que no deba perderse.

- [ ] Usuario de Windows dedicado (`zotz`), sin la sesión de Chrome personal de Hugo y sin datos de negocios ni de clientes. (Pasos en `SECURITY.md` §1; falta hacerlo en la MSI, que hoy corre como `rodri`.)
- [ ] Tokens con alcance mínimo y revocables: GitHub fine-grained, solo con acceso a los repos que el nodo trabaja. (Guía y plan de revocación en `SECURITY.md` §2; lo crea Hugo.)
- [ ] Respaldo: punto de restauración de Windows antes de la primera puesta en marcha y backup semanal de la carpeta de datos de Zotz. (Comandos listos en `SECURITY.md` §3; falta correrlos en la MSI.)
- [x] Documentar todo en `docs/zotz/guias/SECURITY.md`.

---

## Fase 8 — Gobernador de memoria (que Zotz no funda la máquina)

**Objetivo:** Zotz decide **cuántos agentes pueden correr según la memoria real del equipo**. Antes de lanzar un agente mide si cabe; si no cabe, lo pone **en cola** y lo arranca solo cuando otro termine o se libere memoria. Además, cada agente tiene un tope y, si la máquina entra en presión, Zotz **regula**: primero pausa, nunca mata sin permiso.

### Lo que Orca ya trae (reutilízalo, no lo dupliques)

| Pieza                          | Dónde                                                                                                                                                   | Qué hace hoy                                                                                                                                                                                                 | Qué le falta                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Admisión de spawns             | `src/main/daemon/admission/terminal-spawn-gate.ts` + `src/shared/terminal/pty/admission/`                                                               | Limita trabajo **automático**: `automaticConcurrency: 3`, `maxLiveAutomatic: 8` (`DEFAULT_SPAWN_ADMISSION_LIMITS`). Ya tiene **cola de espera** (`terminal-spawn-waiters.ts`, `TerminalSpawnDeferredError`). | Cuenta procesos, no memoria. No aplica a agentes lanzados a mano. |
| Nivel de presión               | `HostPressureLevel = 'ok' \| 'elevated' \| 'critical' \| 'unknown'` en `spawn-admission-contract.ts`, alimentado por `daemon-process-growth-monitor.ts` | Detecta "tormentas" de procesos (descendientes/seg).                                                                                                                                                         | **No mira la RAM.**                                               |
| Pausa por presión              | `AutomaticWorkMode` `{ kind: 'paused', reason: 'pressure' }` en `daemon-automatic-work-guard.ts`                                                        | Pausa trabajo automático cuando hay presión.                                                                                                                                                                 | Se dispara solo por crecimiento de procesos.                      |
| Tope por terminal              | `src/main/daemon/process-scopes/terminal-memory-limits.ts` (`ORCA_TERMINAL_MEMORY_MAX`)                                                                 | Tope duro vía **cgroups**, opt-in, **solo Linux**.                                                                                                                                                           | Nada en Windows ni macOS; no hay UI.                              |
| Árbol de procesos por terminal | `process-growth-breaker.ts` (scopes por terminal)                                                                                                       | Ya agrupa descendientes por terminal.                                                                                                                                                                        | Solo cuenta procesos, no RSS.                                     |

### Decisiones de diseño (2026-11-17)

- **Cola:** FIFO multinivel con relleno y envejecimiento.
  - Tres niveles: manual › remota › automatización. Dentro de cada nivel, orden de llegada.
  - Si la cabeza no cabe, puede entrar el primero de atrás que sí quepa (relleno). Cuando la cabeza lleva 10 min o la rebasaron 3 veces, se le reserva la memoria (envejecimiento).
  - "Pedir cambios" regresa la tarea al frente de su nivel.
  - La cola se guarda en disco y sobrevive reinicios. FIFO puro se descartó: la cabeza bloquea la fila aunque haya memoria para otros, y no tiene prioridades.
  - Estructura de datos en `src/shared/zotz/agent-queue/` y `src/main/zotz/zotz-agent-queue-store.ts`.
- **Las tareas en cola no abren terminal:** la terminal se crea cuando la tarea entra. Así no aplica el límite de 5 min de `createOrAttach` del daemon.
- **Tablero de la cola**, distinto del kanban de agentes de Orca, con columnas por ciclo de vida de la tarea:
  - **Backlog:** la cola real, numerada, con la siguiente tarea resaltada y por qué espera.
  - **In Progress:** corriendo; los pausados se quedan aquí con ⏸.
  - **Review:** el agente terminó; la sesión abierta sigue contando como memoria ocupada, con botón "Liberar memoria".
  - **Done:** su pico alimenta el libro de estimaciones.
  - Arriba, barra de RAM con la línea del mínimo libre.
- **Pausar no libera RAM:** la pausa frena a un agente que crece; lo que protege la máquina es no admitir lo que no cabe.

### 8a. Medir la memoria de verdad

Nuevo `src/main/daemon/admission/zotz-memory-pressure.ts`:

- **Memoria disponible real por plataforma** (no uses `os.freemem()` a secas: en macOS subestima porque no cuenta memoria inactiva o purgable):
  - Windows: `os.freemem()` (equivale a _Available_), y como respaldo `GlobalMemoryStatusEx` si hace falta precisión.
  - macOS: `sysctl kern.memorystatus_level` (porcentaje disponible según el kernel) o `vm_stat` (free + inactive + purgeable + speculative). Reutiliza la lectura de `vm_stat` que ya existe en `src/main/hang-watchdog/hang-incident-snapshot.ts`.
  - Linux: `MemAvailable` de `/proc/meminfo`.
- Leer cada 2 s y solo con agentes vivos o en cola; en reposo, cada 10 s.
- Convertirlo a `HostPressureLevel` con los umbrales de 8d, y **combinarlo con el nivel de crecimiento existente: gana el peor de los dos**. Engánchalo en `daemon-automatic-work-guard.ts`, donde ya se lee `this.monitor.level`.

### 8b. Costo estimado de cada agente

Nuevo `zotz-agent-memory-ledger.ts`:

- Mide el **RSS del árbol completo** de cada terminal de agente (padre + hijos: tests, builds, servidores), reutilizando los scopes por terminal de `process-growth-breaker.ts`.
- Guarda por tipo de agente (`claude`, `codex`, `antigravity`) la **mediana del pico** de las últimas 20 corridas (topada en el máximo por agente), persistida en el userData de Zotz.
- Sin historial, usa el default de configuración (`agentDefaultReserveGb`, 2.5 GB).

### 8c. Admisión por memoria antes de lanzar

En `terminal-spawn-gate.ts` (y en `openAgentLaunch` de `src/main/agent-launch/agent-launch-executor.ts` para los lanzamientos manuales):

- Un agente entra solo si `disponible − costo_estimado ≥ reserva_minima` y la presión de memoria es `ok`. **Sin tope por cantidad ni presupuesto por agentes** (decisión de Hugo, 2026-11-19): la máquina se aprovecha hasta que la RAM de verdad se carga. `disponible` sale del sistema, así que cuenta todo, también los procesos en segundo plano que lancen los agentes.
- Si no cabe: **en cola**, usando los waiters existentes. Se arranca **en orden de llegada** cuando un agente termina o la memoria se recupera. Nunca se descarta una tarea.
- Aplica a **todos los lanzamientos de agentes** (manuales, automatizaciones, orquestación, remotos por `serve`). **No** aplica a terminales normales sin agente.
- Interruptor "Lanzar de todos modos" por tarea, para cuando Hugo decida forzar.

### 8d. Regulación en caliente

Si con agentes ya corriendo la presión sube:

1. **`elevated`** (disponible < 20 % o < `minFreeGb` + 1 GB): no se admiten agentes nuevos y se avisa (notificación y UI).
2. **`critical`** (disponible < `minFreeGb`), sostenido 30 s: se **pausa el agente más reciente** (macOS/Linux `SIGSTOP` al árbol; Windows `NtSuspendProcess` o suspender el Job Object), se avisa, y se **reanuda solo** cuando el nivel vuelve a `ok` durante 60 s. Un agente a la vez, del más nuevo al más viejo.
3. **Tope por agente rebasado** (`perAgentMaxGb`): según `onAgentOverLimit` = `notify` | `pause` (default) | `kill`. `kill` solo si Hugo lo elige en Settings.

- Nunca pausar ni matar el propio Zotz, el daemon, `tailscaled`, ni la sesión del sistema.
- Ojo: pausar un agente mucho tiempo puede hacer que su sesión con la API expire. Registra en la UI cuánto lleva pausado y, pasados 15 min, avisa para que Hugo decida.

### 8e. Topes duros por plataforma

- **Linux:** ya existe (`ORCA_TERMINAL_MEMORY_MAX`). Solo conectarlo a la configuración de Zotz.
- **Windows:** meter cada terminal de agente en un **Job Object** con `JOB_OBJECT_LIMIT_JOB_MEMORY` = `perAgentMaxGb` y `KILL_ON_JOB_CLOSE`. El spawn de ConPTY está en `src/main/daemon/pty-subprocess/` (`native-pty-spawn-windows`); el Job Object va en el módulo nativo (carpeta `native/`, en Rust) o vía `koffi`/FFI si ya se usa en el repo. **Revisa antes qué hay** para no meter dependencias nuevas.
- **macOS:** no existe un tope duro por proceso para usuarios normales; ahí aplica la regulación suave de 8d (medir, pausar, avisar).

### 8f. Configuración y "al instalar"

Nueva sección **Settings → Recursos** y claves en `src/shared/default-global-settings.ts`:

| Clave                   | Default                | Qué es                                            |
| ----------------------- | ---------------------- | ------------------------------------------------- |
| `minFreeGb`             | max(2, 15 % de la RAM) | Memoria que siempre se deja libre para el sistema |
| `perAgentMaxGb`         | min(6, 35 % de la RAM) | Tope por agente (árbol completo)                  |
| `agentDefaultReserveGb` | 2.5                    | Costo supuesto de un agente sin historial         |
| `onAgentOverLimit`      | `pause`                | `notify` / `pause` / `kill`                       |

- **Primer arranque y `zotz-node-setup.ps1`:** detectar la RAM total, calcular los defaults de la tabla y mostrarlos ("Esta máquina tiene 16 GB: hasta 2 agentes a la vez, 4 GB libres siempre"). Hugo puede ajustarlos ahí mismo.
- Los defaults se calculan una vez y se guardan; no se recalculan si Hugo ya los cambió.

### 8g. Que se vea

- En la barra de estado (ya existe `status-bar/resources/popover/resource-usage-metrics.tsx`): memoria disponible, presupuesto usado por agentes y **agentes en cola**.
- Cada tarea en cola muestra por qué: _"En cola: necesita ~3.1 GB, hay 1.4 GB libres. 2 agentes antes."_
- Notificación (y push al celular si está activo) cuando: un agente entra en cola, arranca desde la cola, se pausa o rebasa su tope.

### Pruebas

- Unit tests **solo** para la lógica pura de admisión y regulación (alimentada con muestras falsas): cabe/no cabe, orden FIFO, reanudación con histéresis (no reanudar y pausar en bucle), mediana con tope del ledger y procesos protegidos nunca tocados.
- Prueba manual documentada en `docs/zotz/MEMORIA.md`: en la MSI, lanzar 6 tareas que corran un script que consuma 3 GB cada una. Resultado esperado: nunca bajan de `minFreeGb`, las que no caben esperan en cola y arrancan solas, y nada se mata.

**Listo cuando:** en la MSI se pueden mandar 10 tareas de golpe por Tailscale y la máquina **no se traba ni entra a swap fuerte**. Las tareas corren por tandas según la memoria y todas terminan.

---

## Fase 9 — Tablero de tareas (GitHub Projects + conectores externos)

Spec completo: [`TASKS-SPEC.md`](./specs/TASKS-SPEC.md).

- [x] 9a. Modal unificado con pestañas Tareas y Agentes; el botón de kanban de la barra lateral lo abre y el Workspace board queda oculto (no borrado).
- [x] 9b, parte 1. GitHub Projects de solo lectura: elegir organizaciones/cuenta → Projects; tablero combinado (Backlog / In Progress / In Review / Done) y vista espejo de cada Project; tarjetas con marca de GitHub, logo y nombre de la org y el proyecto; búsqueda; detalle con "Abrir en GitHub"; "Archivar terminadas" (solo con botón) y vista Archivadas.
- [x] 9b, parte 2. Issues de repos sueltos; vistas guardadas (board/tabla, filtro con la sintaxis de GitHub, Group by, Sort); actualizar cada 5 min con el modal abierto.
- [x] 9c. PRs ligados estilo Avena: línea de PR en la tarjeta; en el detalle, PRs y ramas ligadas, los que la mencionan, commit y archivos.
- [x] 9d, parte 1. Contrato `zotz-tasks/v1` con campos tipo Project (JSON, YAML, TOML), feed por URL con token cifrado, importar archivo, tareas externas en el tablero y vista propia de cada servicio.
- [x] 9d, parte 2. JSON Schema publicado, `zotz tasks push`/`validate`/`schema` y endpoint `link-pr`.
- [x] 9e. Tarea ↔ agente: chip de estado en la tarjeta y "Crear workspace con esta tarea".
- [x] 9f. Acción `move` para fuentes externas, con comprobación previa.
- [x] Sumas de campos numéricos, _Slice by_ y vista roadmap (parte 2 de la fase).
- [x] Relay propio (GitHub App + Vercel) para avisos al instante, opcional y apagado por defecto. Guía: [`RELAY.md`](./guias/RELAY.md).

**Listo cuando:** el tablero muestra juntas las tareas de los Projects elegidos y de un feed externo de prueba, cada una con su marca, su proyecto y sus PRs; un PR detectado llega al proveedor por `link-pr`; y ninguna tarea de GitHub se puede modificar desde Zotz.

---

## Fase 10 — Flows (automatizaciones con nodos, estilo n8n)

Spec completo: [`SPEC-flows.md`](./specs/SPEC-flows.md). Propuesta del 2026-11-27, por aprobar.

- [x] 0. Contrato de flows, nodos, disparadores, corridas y RPC `zotz.flows.*`.
- [x] 1. Motor: ejecutor, nodos (con bucle Para cada), plantillas, salida Markdown/JSON, horario y CLI `zotz flows`.
- [x] 2. Lienzo visual (React Flow): editor, inspector y vista de corrida.
- [x] 3. Disparadores por evento: agente terminó, PR, tarea cambió de columna, webhook.
- [ ] 4. Chat: `/flow` con el contexto de la conversación y Responder en chat.
- [ ] 5. Migración de automatizaciones a flows de un nodo, página vieja oculta y móvil.

**Listo cuando:** el caso de `/revisar-pr` del final del spec corre completo en la MSI.

---

## Decisiones abiertas (las resuelve Hugo)

1. **Notificaciones push al celular** (`push.onorca.dev`): las manda la infraestructura de StablyAI. Opciones: (a) dejarlas, que es cómodo pero los avisos pasan por sus servidores; (b) apagarlas y usar un bot propio de Telegram para los avisos (sería una Fase 8).
2. **App móvil**: ¿usar la app oficial de Orca pareada por Tailscale, o compilar la propia (`mobile/`) más adelante?
3. **Firma del instalador de Windows**: por ahora sin firmar (SmartScreen avisará al instalar). Más adelante se puede usar un certificado propio.

---

## Orden y alcance sugeridos

| Fase                    | Depende de | Tamaño                                 |
| ----------------------- | ---------- | -------------------------------------- |
| 0 Setup                 | —          | S                                      |
| 1 Rebrand + 1b logo     | 0          | M                                      |
| 1c Nombres internos/CLI | 1, 3b      | M                                      |
| 2 Telemetría y red      | 0          | M                                      |
| 3 Updates               | 0          | S                                      |
| 3b Updates desde Zotz   | 3          | M                                      |
| 4 Agentes               | 1          | S                                      |
| 5 Nodo 24/7 Windows     | 1, 3       | L                                      |
| 6 Tailscale             | 5          | S                                      |
| 7 Seguridad             | 5          | S (en su mayoría docs y configuración) |
| 8 Gobernador de memoria | 4, 5       | L                                      |
| 9 Tablero de tareas     | 8          | L                                      |
| 10 Flows                | 8, 9       | XL                                     |

Las fases 1, 2 y 3 se pueden trabajar en paralelo en worktrees separados.

---

## Bitácora

Vive en [`bitacora/`](./bitacora/): un archivo por cambio, con fecha en el nombre para que se ordenen solos.
