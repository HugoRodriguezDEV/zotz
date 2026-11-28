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
7. Al terminar cada fase, marca su checklist en este archivo y anota en **Bitácora** lo que cambió y cualquier sorpresa.

---

## Fase 0 — Setup del repo

- [x] Agregar el remote upstream: `git remote add upstream https://github.com/stablyai/orca.git`.
- [x] Documentar en `docs/zotz/SYNC.md` cómo sincronizar: `git fetch upstream && git rebase upstream/main` (o merge) en una rama `zotz/sync-YYYY-MM-DD`, resolver conflictos y correr los gates.
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

Spec en [`RENAME-SPEC.md`](./RENAME-SPEC.md). Va después de la Fase 3b para que llegue por el actualizador.

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
- [x] Escribir `docs/zotz/UPDATE.md`: cómo actualizar Zotz en la MSI (`git pull`, `pnpm install`, `pnpm build`, reiniciar el servicio).

**Listo cuando:** la app corre 24 h sin pedir ni instalar updates.

---

## Fase 3b — Updates desde los releases de Zotz

Reemplaza la regla "Zotz no se auto-actualiza" de la Fase 3: el actualizador de Orca se reapunta a `HugoRodriguezDEV/zotz`. Spec completo en [`UPDATES-SPEC.md`](./UPDATES-SPEC.md).

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
- [x] ~~Llamar a `zotz serve service install --bind <IP-tailscale>`.~~ Reemplazado: el script registra la tarea `\Zotz\Server`, que arranca la **app de escritorio en modo servidor** (computer use y navegador necesitan el escritorio; ver `docs/zotz/NODE-SETUP.md`), y no se fija a la IP de Tailscale porque cambia.
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

Verificación en hardware real (pendiente; nada de esto se pudo probar desde la Mac de desarrollo, pasos en `docs/zotz/NODE-SETUP.md`):

- [ ] Windows (MSI): el asistente pide una sola UAC y deja ✓ en cada paso; la tarea relanza Zotz al cerrarlo; el enlace/QR conecta desde la Mac y el móvil.
- [ ] Windows: `orca serve service install|status|uninstall` (perfil por defecto).
- [ ] macOS: `pmset` solo pide contraseña si hace falta; el LaunchAgent abre Zotz al iniciar sesión.
- [ ] Linux: regla `ufw` con `pkexec` y la unidad `zotz-server.service` al iniciar sesión.
- [ ] "Listo cuando" de abajo (corte de corriente con Autologon y _Restore on AC Power Loss_).

**Listo cuando:** desconectas y reconectas la corriente, la MSI prende sola, inicia sesión, Zotz levanta en modo serve y en menos de 2 minutos puedes mandarle una tarea por Tailscale.

---

## Fase 6 — Acceso remoto por Tailscale

- [x] ~~`zotz serve` escucha **solo** en la IP de Tailscale de la MSI (`--bind`)~~ Reemplazado: en modo servidor Zotz escucha en todas las interfaces pero **solo admite** loopback y tailnet (`zotz-tailnet-source-guard.ts`), y el firewall de Windows limita el puerto a `100.64.0.0/10` (ver `docs/zotz/REMOTE.md`).
- [x] Pairing directo por la tailnet, sin relay: enlaces/QR del asistente con la IP de Tailscale, o `orca pair --address <IP-100.x>` (ver `src/cli/server/pair.ts`).
- [ ] Probar el pairing desde: (1) la laptop de Hugo con Zotz u Orca, (2) la app móvil oficial de Orca. Si la app móvil oficial no puede parear sin relay, anotarlo en _Decisiones abiertas_.
- [x] Documentar en `docs/zotz/REMOTE.md` cómo conectarse: Tailscale, pairing, SSH de respaldo.

---

## Fase 7 — Higiene de seguridad (acceso total ≠ acceso a todo)

Los agentes tienen acceso total **a la MSI**; que esa máquina no tenga nada que no deba perderse.

- [ ] Usuario de Windows dedicado (`zotz`), sin la sesión de Chrome personal de Hugo y sin datos de negocios ni de clientes. (Pasos en `SECURITY.md` §1; falta hacerlo en la MSI, que hoy corre como `rodri`.)
- [ ] Tokens con alcance mínimo y revocables: GitHub fine-grained, solo con acceso a los repos que el nodo trabaja. (Guía y plan de revocación en `SECURITY.md` §2; lo crea Hugo.)
- [ ] Respaldo: punto de restauración de Windows antes de la primera puesta en marcha y backup semanal de la carpeta de datos de Zotz. (Comandos listos en `SECURITY.md` §3; falta correrlos en la MSI.)
- [x] Documentar todo en `docs/zotz/SECURITY.md`.

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

Spec completo: [`TASKS-SPEC.md`](./TASKS-SPEC.md).

- [x] 9a. Modal unificado con pestañas Tareas y Agentes; el botón de kanban de la barra lateral lo abre y el Workspace board queda oculto (no borrado).
- [x] 9b, parte 1. GitHub Projects de solo lectura: elegir organizaciones/cuenta → Projects; tablero combinado (Backlog / In Progress / In Review / Done) y vista espejo de cada Project; tarjetas con marca de GitHub, logo y nombre de la org y el proyecto; búsqueda; detalle con "Abrir en GitHub"; "Archivar terminadas" (solo con botón) y vista Archivadas.
- [x] 9b, parte 2. Issues de repos sueltos; vistas guardadas (board/tabla, filtro con la sintaxis de GitHub, Group by, Sort); actualizar cada 5 min con el modal abierto.
- [x] 9c. PRs ligados estilo Avena: línea de PR en la tarjeta; en el detalle, PRs y ramas ligadas, los que la mencionan, commit y archivos.
- [x] 9d, parte 1. Contrato `zotz-tasks/v1` con campos tipo Project (JSON, YAML, TOML), feed por URL con token cifrado, importar archivo, tareas externas en el tablero y vista propia de cada servicio.
- [x] 9d, parte 2. JSON Schema publicado, `zotz tasks push`/`validate`/`schema` y endpoint `link-pr`.
- [x] 9e. Tarea ↔ agente: chip de estado en la tarjeta y "Crear workspace con esta tarea".
- [x] 9f. Acción `move` para fuentes externas, con comprobación previa.
- [x] Sumas de campos numéricos, _Slice by_ y vista roadmap (parte 2 de la fase).
- [x] Relay propio (GitHub App + Vercel) para avisos al instante, opcional y apagado por defecto. Guía: [`RELAY.md`](./RELAY.md).

**Listo cuando:** el tablero muestra juntas las tareas de los Projects elegidos y de un feed externo de prueba, cada una con su marca, su proyecto y sus PRs; un PR detectado llega al proveedor por `link-pr`; y ninguna tarea de GitHub se puede modificar desde Zotz.

---

## Fase 10 — Flows (automatizaciones con nodos, estilo n8n)

Spec completo: [`SPEC-flows.md`](./SPEC-flows.md). Propuesta del 2026-11-27, por aprobar.

- [x] 0. Contrato de flows, nodos, disparadores, corridas y RPC `zotz.flows.*`.
- [x] 1. Motor: ejecutor, nodos (con bucle Para cada), plantillas, salida Markdown/JSON, horario y CLI `zotz flows`.
- [ ] 2. Lienzo visual (React Flow): editor, inspector y vista de corrida.
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

<!-- Cada fase agrega aquí: fecha, rama/PR, qué cambió, sorpresas. -->

### 2026-11-15 — Fase 0 (`zotz/fase-0-setup`, PR #1)

- Remote `upstream` → `stablyai/orca` (config local de cada clon; documentado en `docs/zotz/SYNC.md`).
- `docs/zotz/SYNC.md`: flujo `zotz/sync-YYYY-MM-DD`, zonas de conflicto y grep para detectar workflows de publish sin guard.
- `LICENSE` y `README.md`: línea de copyright de Zotz y nota de fork arriba.
- Workflows: guard `github.repository == 'stablyai/orca'` en `agent-state-rules-publish`, `homebrew-bump`, `mobile-android-release`, `mobile-ios-release`, `release-mirror-r2`, `windows-signing-rehearsal` y `pullfrog`. Los de release-cut/hourly/daily/adhoc/dev-channel/docs/readme-badge/release-policy ya traían el guard. Se usó guard (no `.disabled`) para que los `workflow_call` sigan resolviendo y el rebase sea barato.
- Gates: `pnpm check:changed` ✓ (31 checks).

**Sorpresas**

- El copyright de `LICENSE` es de **Lovecast Inc.**, no "StablyAI"; se dejó intacto.
- La Mac no tenía Node ni pnpm: se instaló `node@24` con Homebrew y pnpm 12.14.0 vía `corepack` (`export PATH="/opt/homebrew/opt/node@24/bin:$PATH"`, `corepack pnpm …`).
- El snapshot de upstream del fork venía roto (import a `shared/structural-value-equality`, que se movió a `shared/collections/`): tumbaba los unit tests. Se hizo cherry-pick del fix de upstream `2e77caf0ea` (#42793); el próximo sync lo reconoce como el mismo parche.
- `release-javascript.yml` usa `ORCA_POSTHOG_WRITE_KEY` pero no publica; sin el secret el bundle sale sin llave (se termina de cortar en Fase 2).

### 2026-11-15 — Fase 1 (`zotz/fase-1-rebrand`, PR #3)

**Qué cambió**

- Identidad centralizada en `src/shared/zotz/zotz-app-identity.ts` (`Zotz`, `dev.hugorodriguez.zotz`, carpeta `zotz`, comando `zotz`, esquema `zotz://`).
- `package.json`: `name: zotz`, bin `zotz` (se quitó `orca`; `orca-dev` se queda). `verify-cli-bin.mjs` ahora exige `bin.zotz`.
- `electron-builder.config.cjs`: appId, productName, protocolo `zotz://`, ejecutable `Zotz.exe` (en Linux se mantiene `orca-ide`: la caché/extracción del AppImage y los oráculos de CI dependen de ese nombre), sin publisher de SignPath (sin firma), feed `HugoRodriguezDEV/zotz`, `StartupWMClass: zotz`.
- Carpeta de datos: Electron la deriva de `package.json` `name` → `zotz` (minúscula, igual que upstream con `orca`). La CLI (`getPlatformUserDataPath`), `getOrcaUserDataPath` (hooks de Codex offline), `macCoordinationRoot`, el fallback de `logs-directory` y el script de hooks de Command Code usan la misma constante.
- Windows convive con Orca: `%LOCALAPPDATA%\Zotz\daemon-host` (TS + NSIS), ProgIDs `Zotz.Markdown`/`Zotz.Tabular`, registro de protocolo `zotz://` (ya no le roba `orca://` a Orca), AppUserModelId = appId.
- `LOCAL_BUILD_COMPATIBILITY_CONTRACT.appId` (json + ts) y los bundle ids de macOS (notificaciones, press-and-hold) apuntan al nuevo appId.
- Textos visibles: título de ventana, tray (tooltip, “Open Zotz”, aviso de minimizar), menú (About/Hide/Explore/Getting Started/tooltip de Quit), notificación push, titlebar, onboarding, status bar, crash dialog, slide móvil; claves en `en.json` y `es.json`.
- CLI: el nombre por defecto del comando es `zotz` (`resolveInvokedCliCommand`); la ayuda cambia “Orca” → “Zotz” vía `src/cli/discovery/zotz-help-branding.ts`. `zotz --help` y `zotz serve --help` verificados.
- Fase 1b: `resources/icon-source/zotz-bat.svg` + `icon.icon/Assets/logo.svg` y `resources/logo.svg` con el murciélago; regenerados `build/icon.{png,icns,ico}`, `resources/icon.png`, `tray/*Template*.png` y `app-icons/*.png` con los mismos nombres y tamaños.

**Sorpresas / pendientes**

- `resources/icon-source/generate.sh` necesita `xcrun actool` (Xcode completo) e ImageMagick; esta Mac solo tiene CommandLineTools. Los íconos se rasterizaron con `resvg` (brew) + `iconutil` + el script existente `trim-windows-icon-source.mjs` para el `.ico`. En una Mac con Xcode, `pnpm build:icons` regenera desde el nuevo `logo.svg` (el estilo Icon Composer quedará algo distinto).
- El launcher de la CLI empaquetado sigue llamándose `orca` (`resources/bin/orca`, `orca.cmd`, `orca.exe`, `~/.local/bin/orca`) porque los skills y terminales de agentes lo invocan así; choca con un Orca instalado en PATH. Renombrarlo es una fase aparte.
- Sigue compartido con Orca: `~/.orca` (agent-hooks, etc.), el proceso `orca-terminal-daemon.exe` que mata el desinstalador de NSIS, el borrado de hooks al desinstalar el último Orca/Zotz, labels de launchd `com.stablyai.orca.*`, y el sidecar de computer use en macOS (`TrustedOrcaApplication.swift` solo confía en `com.stablyai.orca*`). Revisar antes de instalar ambos en la misma máquina.
- Linux deb/rpm: `after-install.sh`/`after-remove.sh` buscan `/opt/Orca`; con productName `Zotz` no registran `/usr/bin/orca-ide` ni ajustan `chrome-sandbox`. No es objetivo (Windows), queda anotado.
- Los links `orca://` (pairing, plugins, skills compartidos) siguen siendo de Orca por regla; Zotz no los recibe del SO.
- En dev (`pnpm dev`) el perfil sigue en `orca-dev` y el bundle id dev es `com.stablyai.orca.dev`.
- Solo se cambiaron ~13 strings de en/es con el nombre de la app; `en.json` tiene ~1,380 menciones de “Orca” en frases (muchas sobre la app móvil oficial, orca.dev o el CLI `orca`). Un reemplazo masivo genera conflictos grandes con upstream; queda para decidir.
- `test:changed` se expande a casi toda la suite (por los JSON de locales); se corrieron los 70 archivos de test relacionados directamente.
- Fallout de CI (PR #3): `pr.yml` (marcador deb/rpm en `/opt/Zotz`, smoke de `Zotz.exe`), harness `tests/tools/win-update-e2e` (D7) y `win-crash-survival-e2e.yml` ahora buscan `Zotz.exe`/`Programs\Zotz`/`%APPDATA%\zotz`. Runtime: el proveedor de navegador de orcad busca primero la instalación de Zotz (Orca como respaldo), `/opt/Zotz` en la inspección del launcher y en `after-install/after-remove.sh`, el desinstalador `Uninstall Zotz.exe` sigue a productName, `Zotz.app` en local builds y el launcher de macOS usa `MacOS/Zotz`. Los e2e `ssh on managed orcad` fallan porque el fork no tiene el tag `v1.4.224` (los fuentes del relay legacy se construyen desde ese tag); hay que publicarlo en origin. `offscreen-browser-backend-frame-rate` es un test de timing no relacionado.
- Segunda ronda de CI: el launcher nativo de Windows (`native/windows-cli-launcher`) buscaba `Orca.exe` fijo; ahora prueba `Zotz.exe` y luego `Orca.exe` (no se pudo compilar localmente: no hay toolchain de Rust en esta Mac, lo valida CI). Se revirtió el `executableName` de Linux a `orca-ide`. `cross-version wire compatibility` sigue fallando porque al fork le faltan tags de release (`v1.4.190`, `v1.4.219`, `v1.4.220`, …), no por el rebrand.

### 2026-11-15 — Fase 2 (`zotz/fase-2-telemetria`, PR #4)

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

### 2026-11-15 — Fase 3 (`zotz/fase-3-updates`, PR #2)

- `src/main/updater/zotz-updater-policy.ts` (nuevo): `isZotzUpdaterEnabled()` (`ZOTZ_ENABLE_UPDATER=1`) y el aviso nativo "Zotz se actualiza con git pull + build" (`dialog.showMessageBox` sobre la ventana principal; sin ventana, solo log). Textos en `en.json` y `es.json` bajo `zotz.updater.*` vía `translateMain`.
- `updater-service.ts` (fachada única del updater): sin el env var, `setupAutoUpdater` no hace nada, así que nunca se carga `electron-updater`, no se registran sus eventos, ni revisión al arrancar, ni timer diario, ni revisión al despertar/enfocar, ni nudges, ni feed de `stablyai/orca`. `checkForUpdates`, `downloadUpdate` y `quitAndInstall` son no-op; `checkForUpdatesFromMenu` (menú, bandeja, botones de Ajustes y tarjeta, todos pasan por ahí vía IPC `updater:check`) muestra el aviso; `listAvailableReleaseBuilds` devuelve `[]` (el selector de canal/build queda vacío); las RPC remotas `check/download/installRemoteServerUpdate` lanzan `remote_update_manual_required` (el mismo código que upstream usa para "actualiza el servicio a mano").
- `serve`: no se auto-actualiza. `setupHeadlessServeAutoUpdater` pasa por la misma fachada; el handoff (`serve-update-handoff.ts`) solo se escribe desde `quitAndInstall`, que está bloqueado, y el supervisor de la CLI (`src/cli/runtime/serve/updates/`) solo reacciona a ese handoff, sin red propia. En Windows además el modo serve ya era `unsupported-headless-serve` (el supervisor es solo de macOS). La CLI no tiene chequeo propio de "update disponible".
- Plugins: `ORCA_PLUGIN_AUTO_UPDATE` ahora es opt-in también en builds empaquetados (antes: `app.isPackaged || env`). Las actualizaciones manuales de plugins siguen.
- Nudges/banners: sin `setupAutoUpdater` el estado del updater se queda en `idle`, y con eso la `UpdateCard`, los nudges y el estado que ven los clientes remotos/móvil no aparecen. No hizo falta tocar el renderer.
- Tests: los 13 tests del updater de upstream cargan la fachada vía `testing/updater-test-module-loader.ts`; ahí se pone `ZOTZ_ENABLE_UPDATER=1` para que el comportamiento de upstream siga cubierto. Nuevo `zotz-updater-policy.test.ts`: sin el env var nada llega a `electron-updater` (falla si se quita el guard).
- `docs/zotz/UPDATE.md`: `git pull` + `pnpm install` + `pnpm build:win` + reinstalar y reiniciar `serve` (manual hoy; tarea programada cuando exista `zotz serve service` en Fase 5).
- Sorpresas: (1) no hace falta tocar `updater-setup.ts`: todos los caminos automáticos (timers, `powerMonitor` resume, `browser-window-focus`, nudges, reintentos) nacen en `setupAutoUpdater` o en eventos que este registra. (2) `orcad-managed-auto-update` (actualiza hosts SSH administrados) se dejó: empuja el orcad **empaquetado en este mismo build de Zotz**, no descarga nada de Orca. (3) Upstream rompía un import (`structural-value-equality`); se resolvió en la base `zotz/fase-0-setup` y esta rama se rebasó encima.
- Pendiente: "Listo cuando" (24 h sin pedir ni instalar updates) solo se puede verificar corriendo el nodo real.

### 2026-11-16 — Fase 5 (`zotz/fase-5-nodo`)

**Qué cambió**

- 5b: `src/main/power/windows-system-sleep-assertion.ts` (`powerSaveBlocker` `prevent-app-suspension`) conectado en `AgentAwakeService`: en Windows, como en macOS, la aserción de sistema sustituye al bloqueo de pantalla (la pantalla se puede apagar; si la aserción falla, se vuelve al bloqueo de pantalla). En modo servidor el modo efectivo es siempre `on` (`resolveZotzComputerAwakeMode` en `src/shared/zotz/zotz-machine-mode.ts`, usado al arrancar y al cambiar settings).
- 5a: `orca serve service` en Windows con la tarea programada `\Zotz\Serve` (al iniciar sesión, token interactivo, repetición cada minuto con `IgnoreNew`, RestartOnFailure, sin límite de tiempo, con batería). Sin `--supervise` (solo POSIX) y solo con el perfil por defecto (una tarea no fija variables de entorno). `resolveServiceCommand` busca `orca.exe` en Windows. El estado sale del enum `State` de `Get-ScheduledTask`, que no depende del idioma de Windows.
- 5c: `resources/win32/zotz/zotz-node-setup.ps1` (idempotente, exige admin, transcripción y JSON de resultado por paso; además quita reglas de bloqueo de `Zotz.exe` en el puerto, como la reparación de firewall de upstream). Se empaqueta en `resources/zotz/` (extraResources de Windows; `resources/win32` ya está excluido de `app.asar`) y el build de Windows de `zotz-desktop-builds.yml` valida que parsea.
- 5d: setting `zotzMachineMode` (opcional en el tipo, default `'unset'`). Pantalla en `src/renderer/src/components/zotz/`, montada en `AppRootSurfaces` junto al onboarding de upstream (sale cuando el onboarding ya no está), con entrada en Ajustes → General. Orquestador en `src/main/zotz/` (fases por plataforma, estado por paso, errores aislados, IPC `zotzNode:*`). Mantener despierta, abrir la red, mostrar el enlace/QR (`mobile:getRuntimePairingUrl` / `mobile:getPairingQR` con la IP de Tailscale leída en vivo) y persistir `zotzMachineMode: 'server'` solo ocurren cuando Tailscale está conectado y el firewall no falló (si se cancela UAC o falla Tailscale/firewall en un equipo personal/sin configurar, no se expone la red ni queda guardado `server`).
- Exposición de red persistente: en modo servidor el escritorio arranca con `exposeNetworkByDefault` y la política de origen de `serve --refuse-public` (cambio de pocas líneas en `main-process-runtime-launch.ts`). No se fija a la IP de Tailscale: cambia al re-registrar el nodo, puede no existir todavía al iniciar sesión, y con una IP fija `ensureNetworkExposure` de upstream rechaza abrir la red y rompe el botón de vincular. El firewall de Windows limita el puerto a `100.64.0.0/10`.
- El arranque automático lanza la **app de escritorio** (`Zotz.exe --zotz-node-autostart`), no `serve` sin ventana: computer use y el navegador necesitan el escritorio, `Zotz.exe` no abre consola y es el mismo perfil con los mismos dispositivos. `shouldActivateDesktopForSecondInstance` ignora ese argumento para que el watchdog no robe el foco.
- Docs: `docs/zotz/NODE-SETUP.md` (qué cambia por SO, cómo deshacerlo, Smart App Control, BIOS, Autologon, cómo probar).
- Tests: XML/args de la tarea y su estado (`zotz-windows-serve-service.test.ts`); secuencia, aislamiento y estado del orquestador y fases con runners inyectados (`zotz-node-setup.test.ts`: una sola elevación en Windows, UAC rechazada, Tailscale instala → login → espera → timeout, macOS sin pedir contraseña si ya está); aserción de Windows en el servicio de awake; `zotz-machine-mode.test.ts`. Fixture `zotz/ZotzMachineModeWizard` para revisar la UI.

**Sorpresas / pendientes**

- Nada de esto se pudo ejecutar en Windows o Linux reales (esta Mac no tiene PowerShell); ver la lista de verificación de Fase 5.
- `RestartOnFailure` del Programador de tareas no vigila la salida de un proceso largo y su `Count` máximo es 999; de ahí el watchdog de repetición cada minuto. Mientras un Zotz abierto a mano (no por la tarea) esté corriendo, la tarea lanza cada minuto un segundo `Zotz.exe` que sale al instante sin activar la ventana; desde el siguiente inicio de sesión es la tarea quien lo posee.
- Windows limita las horas activas a 18 h (no 0–23).
- `-ExecutionPolicy RemoteSigned` (no `Bypass`, por EDR) para el script empaquetado; si el archivo llegara con Mark-of-the-Web, PowerShell lo bloquea y el paso lo reporta.
- Pasar de servidor a personal solo quita el arranque automático; energía, firewall, SSH y políticas se deshacen a mano (comandos en NODE-SETUP.md).
- Homebrew renombró el cask de la app a `tailscale-app`; se intenta ese y luego `tailscale`. En Linux, `tailscaled` rechaza `tailscale login` de un usuario sin privilegios: el asistente lo hace operador con `pkexec tailscale set --operator=<usuario>` antes del login y reporta el error real si el login falla.
- La exposición que abre el asistente adopta en caliente la política de origen de `serve --refuse-public` (`adoptServeNetworkSources` en `runtime-rpc-network-exposure.ts`), sin esperar reinicio.
- La CLI empaquetada sigue llamándose `orca` (`orca.exe`); no se renombró.

**Revisión del PR #7 (2026-11-16)** — arreglos tras code review:

- Elegir "Personal" quita la tarea de arranque siempre que el modo no fuera ya personal: una configuración de servidor a medias (Tailscale falló) podía registrar la tarea sin guardar el modo. Al dejar el modo servidor avisa que los dispositivos emparejados siguen con acceso hasta revocarlos.
- El paso "no dormirse" verifica que un bloqueo del SO quedó activo (`AgentAwakeService.isSleepPrevented`), no solo que se pidió.
- En Windows el bloqueo de sistema es **adicional** al de pantalla (no lo reemplaza): con Modern Standby, apagar la pantalla podía dormir la máquina y sacarla de la tailnet.
- Rechazar el UAC se detecta recorriendo las excepciones internas (`Win32Exception` 1223 / `0x800704C7`), para mostrar "permiso rechazado" en vez del error crudo.
- `orca serve service` en Windows registra la tarea con `S4U` (sin ventana) en vez de `InteractiveToken`: `orca.exe` es de consola y abría una ventana visible en cada inicio de sesión.
- Pendientes anotados, no arreglados: (1) la repetición cada minuto podría relanzar Zotz durante una actualización NSIS (hoy el updater está apagado por Fase 3); (2) `xmlText`/`systemdArgument` duplican escapadores de `serve-service-unit.ts`.

### 2026-11-17 — Fase 4 (`zotz/fase-4-agentes`)

- Permisos: no hizo falta código. Un perfil nuevo trae `agentPermissionDefault: 'full-access'` y en cada lanzamiento se convierte en flags (`claude`/`agy` → `--dangerously-skip-permissions`, `codex` → `--dangerously-bypass-approvals-and-sandbox`) o en política de chat (Codex `never` + `danger-full-access`; Claude con skip-permissions; Antigravity por ACP en modo `yolo`). El `'own'` de `agent-launch-profile.ts:161` solo arma vistas del selector, no pisa el lanzamiento.
- Workspace trust: tampoco hizo falta código. Orca pre-confía la carpeta para Claude (`~/.claude.json`), Codex (`config.toml`) y Antigravity (`~/.gemini/antigravity-cli/settings.json`) justo antes de cada lanzamiento, en cualquier modo de permisos y también en workspaces de carpeta (`agentWorkspaceTrustEnabled`, default `true`).
- Agentes visibles: `applyZotzVisibleAgents` se engancha en los defaults y al cargar el perfil. Guarda en `zotzSeenTuiAgents` qué agentes del catálogo ya vio, así que los que agregue upstream en un sync nacen ocultos y lo que Hugo active o desactive a mano se respeta.

**Sorpresas / pendientes**

- Casos en que un agente sí puede preguntar: Claude cuando la carpeta es la raíz de un disco o el home (`isTooBroadToPreTrust`); Antigravity si arranca en una subcarpeta del workspace (solo confía rutas exactas); escribir `claude`/`codex`/`agy` a mano en una terminal (no pasa por el pre-trust); Codex en WSL; hosts SSH con relay viejo. Para el nodo: abrir cada proyecto como su propio workspace, nunca `C:\` ni la carpeta del usuario.
- Un perfil guardado con `agentYoloDefaultsMigrated: true` pero sin `agentPermissionDefault` cae en `'own'` (sin flags). No pasa con perfiles nuevos de Zotz.
- Antigravity, aun en `yolo`, a veces hace preguntas o pide revisiones administrativas (lo dice su propio spec en `antigravity-acp-launch-spec.ts`).
- La MSI (Katana 15, 16 GB) solo tiene `claude` en el PATH. Falta instalar `codex` y `agy` para cerrar el "Listo cuando".

### 2026-11-17 — Fase 6 (`zotz/fase-6-tailscale`)

- Solo tailnet: `src/main/zotz/zotz-tailnet-source-guard.ts` (`ZotzTailnetOnlySourceGuard`) admite loopback y Tailscale (`100.64.0.0/10`, `fd7a:115c:a1e0::/48`) y rechaza LAN y públicas al aceptar el TCP. Se activa con `zotzTailnetOnly` en las opciones que devuelve `zotzServerNetworkSources` (modo servidor) y se engancha con 3 líneas en `createServeNetworkSourceGuard`, así cubre el arranque y la adopción en caliente del asistente. Antes el modo servidor usaba la política de `--refuse-public`, que también acepta la LAN.
- Firewall (`zotz-node-setup.ps1`): las reglas **Allow** de `Zotz.exe` que Windows crea en el primer "Permitir acceso" (remoto `Any`) dejaban pasar la LAN por encima de la regla de tailnet; ahora se limitan a `100.64.0.0/10` en vez de borrarse (borrarlas haría que Windows vuelva a preguntar).
- Pairing: no hizo falta código. Relay apagado desde Fase 2 y los enlaces/QR del asistente ya usan la IP de Tailscale leída en vivo. Por SSH: `orca pair --address <IP-100.x>` / `orca pair --mobile --address <IP-100.x>`.
- Docs: `docs/zotz/REMOTE.md` (requisitos, vincular laptop/móvil, qué orígenes entran, SSH de respaldo, diagnóstico).

**Sorpresas / pendientes**

- No se usa `--bind <IP-de-Tailscale>` (decisión de Fase 5): la IP cambia y upstream rechaza abrir la red con una IP fija. El filtro por origen + firewall da el mismo resultado.
- `orca serve` sin ventana mantiene la política de upstream (acepta LAN); el nodo no lo usa. Documentado cómo restringirlo.
- Falta la prueba manual: vincular desde la laptop y desde la app móvil oficial por la tailnet, y confirmar que desde la LAN (`192.168…`) se rechaza.

### 2026-11-17 — Fase 7 (`zotz/fase-7-seguridad`)

- `docs/zotz/SECURITY.md`: usuario estándar `zotz` (qué instalar ahí y qué nunca), tokens con alcance mínimo (GitHub fine-grained solo con los repos del nodo y 90 días; cuentas o API keys de agentes solo para el nodo con límite de gasto), qué revocar y en qué orden si el nodo se compromete, punto de restauración antes del asistente y tarea semanal `\Zotz\Backup` (robocopy como `SYSTEM`, sin cachés). Los bloques de PowerShell se verificaron con el parser.
- Sin cambios de código: todo es configuración de la máquina y de las cuentas, que hace Hugo.

**Sorpresas / pendientes**

- Hoy la MSI corre Zotz como `rodri` (el usuario principal) y su carpeta de datos tiene la identidad de pairing (`orca-devices.json`, `orca-e2ee-keypair.json`). Hay que crear `zotz` y mover el nodo ahí.
- Los secretos que Zotz cifra con `safeStorage` (DPAPI) solo se descifran con el mismo usuario en la misma instalación de Windows: un respaldo restaurado en otra máquina obliga a volver a iniciar sesión y a vincular de nuevo.
- Las bases SQLite se copian en caliente (con `-wal`/`-shm`), así que la copia puede no ser consistente. Lo crítico (JSON de configuración y pairing) sí se copia bien.

### 2026-11-17 — Fase 3b (`zotz/fase-3b-updates`)

- **Versiones:** `1.4.<parche×100 + build>` (`zotz-release-version.mjs`). Sin sufijo, para que cuenten como estables. `-zotz.N` se descartó porque el actualizador lo toma como RC, lo ordena por debajo de `1.4.214` y marca error cuando no hay update.
- **CI:** job `version`; builds con `ORCA_LOCAL_BUILD_VERSION`; zip de macOS; los manifiestos y sus archivos se suben con el nombre original (`zotz-stage-release-assets.mjs`) más copias `zotz-*`; release estable `v<versión>` marcado como latest; check `zotz-check-release-repo-refs.mjs`.
- **App:**
  - `ZOTZ_RELEASE_REPO` en el feed, el Atom, `/releases/latest`, la revisión de manifiestos y `MAIN_RELEASE_REPO`.
  - `orca-whats-new` apaga el changelog y los nudges de `orca.dev`.
  - Encendido por default; se apaga con `zotzUpdatesEnabled` (o `ZOTZ_DISABLE_UPDATER=1`).
  - `zotz-update-automation.ts` descarga sola (Windows/AppImage) y, en modo servidor, instala tras 10 min sin agentes trabajando (`getWorkingAgentCount` del servicio de awake). Revisión cada 6 h.
  - Ajustes → Acerca de: switch, `Zotz 1.4.21427 (Orca 1.4.214, build 27)`, sin selector de canales. Ayuda → Changelog/GitHub apuntan a Zotz.
- **Tests:** versión, staging de assets, idle install, lectura de versión y política (con el switch apagado no se carga `electron-updater`). Las fixtures de upstream con URLs de `stablyai/orca` pasan al repo de Zotz.

**Sorpresas / pendientes**

- La automatización solo se activa cuando el arranque de la app la configura; así las suites del actualizador de upstream siguen probando su flujo de "clic para descargar".
- Las builds locales conservan la versión de Orca (`1.4.214`): el actualizador les ofrece el siguiente release de Zotz.
- macOS no tenía el bloqueo de §6: la tarjeta ofrecía "Update" y Squirrel.Mac iba a rechazar el zip. El `Zotz.app` publicado está firmado ad-hoc (`designated => cdhash H"…"`), y un build re-firmado da `code failed to satisfy specified code requirement(s)` con `codesign -v -R`, que es la misma prueba que hace Squirrel. Ahora `zotz-mac-manual-install.ts` marca la versión como `externallyManaged` con `zotzManualDownloadUrl` (el `zotz-macos-arm64.dmg` del release), main rechaza la descarga, y la tarjeta y Ajustes muestran "Descargar la versión nueva". Cuando haya Developer ID, `isZotzManualMacInstall()` debe devolver `false`.
- La base de Orca salía de `package.json`, que Orca no sube en `main` (se quedó en `1.4.214` con Orca ya en `1.4.262`): la etiqueta mentía y el tope de 99 builds nunca se reiniciaba. Ahora es el release más nuevo de Orca cuyo corte está mergeado (§3 de `UPDATES-SPEC.md`); el siguiente release queda en `1.4.25901`.
- macOS se firma con un certificado auto-firmado (`Zotz Release Signing`, gratis). El requisito designado queda `identifier "dev.hugorodriguez.zotz" and certificate leaf = H"…"`: probado aquí, un build re-firmado con otra versión pasa `codesign -v -R` (Squirrel) y con ad-hoc no. CI lo importa (`zotz-import-mac-signing-cert.sh`, confianza con `sudo add-trusted-cert` porque electron-builder solo usa identidades válidas) y revisa `Authority=`. La app lee su firma con `codesign -dvv` al iniciar el actualizador: con certificado usa Squirrel; ad-hoc o desconocida, el `.dmg`.
- Falta la prueba real: instalar a mano `v1.4.21401`, publicar un cambio y ver que llega, se instala al reiniciar y que en modo servidor no interrumpe a un agente.

### 2026-11-17 — Progreso del asistente y marca en textos (`claude/zots-loading-screen-orca-names-ae9160`)

**Qué cambió**

- Asistente de servidor: arriba dice "Paso X de N: <paso>" con el tiempo que lleva, una barra, qué está haciendo el paso actual y una consola con la salida real. En Windows, mientras corre el script elevado, main lee su transcript (`zotz-node-setup.log`) cada segundo (`zotz-node-setup-log-progress.ts`): los pasos que faltan quedan pendientes en vez de todos girando, y la instalación de OpenSSH (5–15 min) dice que tarda.
- El progreso por IPC ahora es `{ steps, output }`; las fases que no son el script escriben líneas con el mismo formato (`== paso ==`, `paso -> done: …`).
- Firewall (`zotz-node-setup.ps1`): limitar a la tailnet la regla Allow de `zotz.exe` fallaba en la MSI ("Aplazar a usuario" solo se puede usar…), porque las reglas que crea el aviso de Windows traen `EdgeTraversalPolicy DeferToUser`. Ahora se cambia a `Block` en la misma llamada (`Set-NetFirewallRule`); el tráfico de Tailscale no usa edge traversal.
- "Orca" → "Zotz" en todos los textos de la interfaz y los menús sin tocar los JSON de upstream: `zotz-brand-copy.ts` se aplica a los catálogos al cargarlos (renderer y main) y a los textos por defecto de `t()`, antes de interpolar. Se conservan "Orca Mobile" / "app móvil de Orca" (la app oficial) y el namespace `zotz.*`. Los tests de upstream lo apagan con `zotz-vitest-upstream-brand-copy.ts`.

**Sorpresas / pendientes**

- Siguen en inglés con "Orca" los mensajes de error armados en main sin `t()` (instalador del CLI, orcad administrado, pairing). Son poco visibles; cambiarlos es editar código de upstream.
- No se pudo abrir la app Electron en la MSI desde el worktree (node-pty no compila sin VS C++); se verificó con capturas de fixtures y con el log real de una configuración en curso.

### 2026-11-18 — Fase 8, parte 1 (`zotz/fase-8-memoria`)

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

### 2026-11-18 — Fase 2b: cortar lo que aún llegaba a Orca (`zotz/fase-2b-sin-orca`)

- `zotz-network-policy.ts` suma `plugin-catalog` y `feedback`, ambos apagados.
- **Plugins:** el sistema de plugins sigue encendido. Ajustes → Plugins tiene el interruptor "Descargar el catálogo de plugins de Orca" (`zotzOrcaPluginCatalogEnabled`, apagado por defecto). Apagado, no se siembran ni refrescan `stablyai/orca-plugins` ni `orca-community-plugins` (incluye las fuentes ya sembradas antes), ni se bajan la lista de bloqueo y las estadísticas de `orca.dev`. Los marketplaces que agregue el usuario siguen funcionando. Guardas en `src/main/zotz/zotz-plugin-catalog-guard.ts` (el ajuste se enlaza en `zotz-plugin-catalog-opt-in.ts`, que también arranca o detiene la lista de bloqueo al cambiarlo), enganchadas en los servicios (no en `main-process-plugins.ts` ni `plugin-marketplace-service.ts` más allá de una línea: ya estaban en el tope de 300 líneas).
- **Estrella de GitHub:** `checkOrcaStarred`/`starOrca` ya no llaman a `gh`; Ajustes y la pantalla de inicio ocultan el botón.
- **Comentarios:** "Enviar comentarios" abre `issues/new` del repo de Zotz; `postFeedback` rechaza sin red.
- **Enlaces:** el menú de ayuda pierde Docs, Discord y X. Los avisos de error de terminal y las vistas de proyecto de GitHub apuntan a los issues de Zotz. Se ocultan "Explorar plugins de temas" (onboarding) y la guía de modo administrador en Windows.
- **Textos con "Orca" escritos en el código:** `applyZotzBrandToCopy` se aplica en la salida humana de la CLI (`printResult`, `reportCliError`; el JSON queda intacto) y en `unwrapIpcErrorMessage`, por donde pasan los errores del proceso principal que muestra la interfaz. No toca "Orca Mobile" ni "Orca" dentro de rutas (`~/Orca/x`, `C:\Orca\x`). El comando pair ya dice "Paste this link in Zotz: Settings → Remote Zotz Servers".
- Vistas previas de enlaces (`ZotzLinkPreview/1.0`) y Jira se presentan como Zotz. Los textos de permisos de macOS (`NS*UsageDescription`) dicen "Zotz allows…".
- Sorpresa: `pnpm check:changed` selecciona casi toda la suite (la política de red y el rebrand de textos se importan en todos lados) y las pruebas unitarias llegan al tope de 30 min. Se corrieron acotadas: 1475 pasan; solo falla `process-host-dev-rebuild.test.ts` (espera a un watcher de rolldown en carpetas temporales; no usa nada de esta rama).
- Pendiente: los 17 enlaces de la galería de funciones siguen en `orca.dev/docs` (el título entero es el enlace; hace falta decidir si se quitan o se apuntan a docs propias). El diálogo de comentarios de Orca queda en el código, sin ruta para abrirlo.

### 2026-11-18 — Fase 1c, parte 1 (misma rama `zotz/fase-2b-sin-orca`, por decisión de Hugo)

- **Alias:** `src/shared/zotz/zotz-env-aliases.ts`. Se importa primero en `src/main/index.ts` y `src/cli/index.ts`; los procesos hijos (daemon, terminales) heredan las `ORCA_*` ya llenas.
- **CLI `zotz`:** el comando que se registra es `zotz` en las tres plataformas (`/usr/local/bin/zotz` o `~/.local/bin/zotz`; en Windows el PATH apunta a `resources\bin`, que ahora trae `zotz.exe`/`zotz.cmd`). `orca.exe`/`orca.cmd` de Windows se mueven a `resources\orca-compat`, que solo las terminales de Zotz anteponen al PATH; en macOS y Linux `orca` sigue en `resources/bin`, que no está en el PATH global. El lanzador nativo es el mismo binario (busca `Zotz.exe` dos carpetas arriba, así que funciona desde ambas carpetas).
- Instalaciones y actualizaciones: `zotz-cli-auto-registration.ts` revisa el comando 15 s después del primer arranque de cada versión (`zotzCliRegisteredVersion`) y lo registra si falta, apunta a otra versión o no está en el PATH. En macOS puede pedir la contraseña de administrador para `/usr/local/bin`; si se cancela, no vuelve a preguntar hasta la siguiente versión (queda Ajustes → CLI). Un comando `zotz` ajeno (conflicto) no se toca. El modo serve ya registraba su propia CLI. El enlace viejo `orca` en macOS/Linux sigue apuntando a Zotz hasta que se borre.
- Sin tocar: el nombre del lanzador de Linux (`orca-ide`), la CLI dentro de WSL y el comando que se sugiere a los agentes (`orca`/`orca.cmd`/`orca-ide`, que siguen funcionando dentro de Zotz).
- Falta probar en hardware: `zotz --help` desde una terminal nueva en la MSI y que `orca` ya no exista fuera de Zotz.- **Computer use en Mac:** el ayudante nativo solo confiaba en `com.stablyai.orca*`, así que rechazaba a Zotz (`dev.hugorodriguez.zotz`). Se agregó a `TrustedOrcaApplication.swift`, y `macos-tcc-prompt-watch.ts` también reconoce los diálogos de permisos de Zotz. Falta probarlo en una Mac con la app empaquetada.
- **Decisión (Hugo, 2026-11-18): Zotz no convive con Orca en la misma máquina.** Por eso no se mueven `~/.orca` a `~/.zotz`, ni se renombran procesos (`orca-terminal-daemon`, `orca-agent-hook`), etiquetas de launchd ni el paquete de Linux: sin Orca instalado no chocan y el cambio solo agrega riesgo. Si algún día conviven, ojo: los ganchos de agentes se reconocen por `agent-hooks/<script>` sin mirar la carpeta (`managed-hook-command-matching.ts`), así que cada app pisaría los de la otra; el comando de Codex está congelado (`CODEX_HOOK_COMMAND_FORM`) y obliga a volver a aprobarlo; y las rutas remotas/WSL también usan `.orca`.- **Nombres internos:** `TERM_PROGRAM=Zotz`, el título ante Codex (`clientInfo.title`) y el nombre del tema de Claude Code dicen Zotz. Se dejan los identificadores (`orca_desktop`, `themes/orca.json`) para no perder la selección del tema.
- **Logos:** la tarjeta para compartir usa el murciélago y `github.com/HugoRodriguezDEV/zotz`. Se dejan: la pantalla de la app móvil en Ajustes (muestra la app oficial de Orca, que se queda por regla), `resources/icon-dev.png` (solo builds de desarrollo) y los videos del onboarding (hay que regrabarlos con la interfaz de Zotz).

### 2026-11-18 — Barra lateral simple estilo Conductor (`zotz/sidebar-conductor`)

- Nuevo default `zotzSidebarLayout` (≠ `'orca'`): arriba Inicio / Crear / Buscar; debajo cada proyecto con su `+` (abre el creador de workspaces de upstream con el proyecto elegido) y solo las conversaciones del usuario: sin el checkout principal salvo que tenga pestañas abiertas, sin lo creado por automatizaciones ni por la CLI, salvo lo que la CLI crea arrancando un agente (`--agent`, p. ej. una entrega a otro agente), que es una conversación nueva. Las carpetas sueltas (`~`) salen solo con pestañas abiertas.
- Enganche: un `if` en `components/sidebar/index.tsx`; el resto vive en `components/zotz/sidebar/`. Ajustes → General → "Barra lateral simple" regresa a las tarjetas de Orca.
- Pendiente: el switch "sin worktree" al crear (conversación directa en la carpeta del proyecto), marcar como "propias" las conversaciones abiertas desde Zotz para ocultar agentes externos dentro del mismo worktree, y "Conectar a mi servidor" en modo personal.
- `server-hook-session-binding.test.ts` y `journal-writer-operation-expiry.test.ts` ya fallaban en `main` antes de esta rama.
- Misma rama: cada conversación muestra el `AgentStateDot` de upstream (trabajando, pregunta, error, terminado, sin leer); los proyectos sin ícono toman el avatar de GitHub del dueño. Fase 8: el gobernador mide los chats nativos (pid del dueño en el lease de la sesión) y la cola también los retiene antes de arrancar (`zotz-structured-agent-start-hold.ts`, enganchado en `runStart`).

### 2026-11-18 — Fase 8: prueba de estrés en Zotz Dev (Mac, 32 GB)

- **Tope de agentes:** 6 Claude seguidos → 4 en marcha en ~10 s y el resto en cola (`concurrency`); al cerrar uno, el siguiente arranca solo. Antes del arreglo, la reserva de 90 s contaba doble y dejaba un lugar vacío ese tiempo.
- **Memoria en macOS:** `memory_pressure` cuenta como libre lo que macOS puede mandar a swap; con 16 GB ocupados Zotz seguía viendo 9–12 GB libres. Ahora la presión también sale de `kern.memorystatus_vm_pressure_level` y del swap escrito en 2 min (≥ 1 GiB). Con 12 GB ocupados: presión `elevated`, un Claude nuevo esperó con motivo `pressure` y arrancó solo ~80 s después de liberar la RAM.
- **Cancelar:** la cola resuelve `canceled` y recuerda el pane; la terminal abre como shell sin el agente, con una franja "cancelado en la cola" y la marca en la barra simple. Antes el pane reintentaba el spawn y volvía a la cola.
- **Pendiente:** repetir la prueba de memoria en la MSI (Windows mide distinto).
- **CI del PR #18:** las suites E2E de upstream (D7 de Windows y el layout oracle) buscan el botón "New workspace" de la barra de Orca. Con `ORCA_E2E_USER_DATA_DIR` (lo ponen los drivers de e2e) y sin `zotzSidebarLayout` elegido, la barra vuelve a la de Orca (`isZotzConductorSidebar(settings, automatedLaunch)`), igual que el asistente de primer arranque. La barra nueva leía `folderWorkspaces`/`worktreesByRepo` directo; ahora usa los selectores del ratchet. El oráculo de apagado de serve en Linux busca `~/.local/bin/zotz`.
- Bajo `ORCA_E2E_USER_DATA_DIR` también se permite el catálogo de plugins de Orca: las suites e2e de upstream instalan desde él. `plugin-demo.spec.ts` espera "control Zotz".
- **Pendientes del CI que no son de este PR:** (1) el D7 empaquetado de Windows falla igual en `main` (corrida manual 44378985670): a la app instalada le falta `out\shared\orchestration\orchestration-compatibility-evidence.js` y `zotz serve` no arranca; el último verde fue el 2026-11-17, así que lo rompió algo que entró a `main` después. Hay que investigarlo antes de depender de `zotz serve` en la MSI. (2) `cross-version wire compatibility` toma como release anterior el tag de Zotz `v1.4.25901` y su copia no arranca el worker de journal SQL en el harness; nunca había corrido en el fork. (3) Los jobs de macOS (persistence, smoke nativo, updater) no consiguen runner.

### 2026-11-18 — Checks unificados y release solo Zotz (`zotz/pr-checks-unificados`)

- **Checks:** la franja de Zotz con el PR y sus checks salía arriba de Source Control y repetía el panel de Checks de upstream (PR, checks, comentarios, "Fix with AI"). Se quitó; el interruptor de Autofix vive ahora en el panel de Checks (`ZotzChecksAutofixToggle`, arriba de la lista). El Autofix sigue corriendo desde `useZotzPrChecksMonitor`, que también usa el chip del PR bajo la conversación. Se fueron con la franja: "Create PR" por el agente y el botón Merge de la franja (el panel de Checks de upstream ya tiene los suyos).
- **Release:** `zotz-stage-release-assets.mjs` publica cada instalador solo con su nombre `zotz-*` y reescribe los `latest*.yml` para que apunten a él (con su `.blockmap`). El build conserva los nombres `orca-*` porque el CI de upstream los lee. Los workflows de release de Orca (`release-cut`, `release-mac-build`, `release-policy`) no corren en el fork: se disparan a mano o tienen el guard `github.repository == 'stablyai/orca'`.
- El actualizador se apaga bajo `ORCA_E2E_USER_DATA_DIR` (ya en `main`): el D7 empaquetado de Windows fallaba porque el build viejo de la prueba se actualizaba al release real mientras arrancaba `serve`.

### 2026-11-19 — Pestaña "Segundo plano" (`zotz/segundo-plano`)

- Los procesos en segundo plano de la sesión (pruebas, scripts, subagentes) ya no salen como franja arriba del chat: la franja de upstream (`NativeChatStructuredSessionStatus`) se monta por portal dentro de la pestaña nueva **Segundo plano** de la barra derecha (`zotz-background`, ícono Activity), con su lista y su Detener tal cual.
- Solo el chat visible y enfocado llena la pestaña; sin tareas (o sin chat nativo) muestra un estado vacío. Con la pestaña cerrada no se muestra en ningún lado.
- Archivos: `components/zotz/background/` (destino del portal, portal y panel). Ganchos de pocas líneas en `use-structured-native-chat-subagents.tsx` (envuelve la franja; `NativeChatStructuredSession.tsx` ya está en el tope de 400 líneas), la unión `RightSidebarTab` y sus tres validadores (ruta del renderer, parámetros RPC, normalización persistida), los ítems de la barra y el contenido de paneles.
- **Salida de los shells:** en el panel, una fila de shell (`command`/`monitor`) se despliega con la cola de su salida (últimas 200 líneas o 64 KB), refrescada cada segundo mientras la tarea sigue viva. Las filas de agente siguen abriendo su conversación. El archivo sale del `outputFile` que Claude Code publica en los bloques `background-task` del transcript (`zotz-background-task-outputs.ts`) y se lee por el host del worktree del chat: rangos con acceso `user-file` en local/SSH/WSL, y el permiso de archivo del host (`readHostFilePreview`) en servidores remotos. Sin `outputFile` (Codex y otros) el despliegue lo dice. Fuera del panel la franja no cambia (el contexto solo existe dentro del portal).

### 2026-11-19 — Revisar cambios antes de borrar o quitar (`zotz/borrar-con-revision`)

- **Borrar conversación/worktree:** upstream ya contaba los cambios sin commitear y listaba los archivos en un popover. Ahora cada archivo de esa lista se despliega con su diff contra HEAD (`ZotzDirtyFileDiff`, unificado con `structuredPatch` de `diff`, hasta 200 líneas). El diff se pide por `getRuntimeGitDiff` con el contexto de `getEditorFileReadContext`, así que funciona igual en local, SSH y WSL. Gancho: prop `owner` en `DeleteWorktreeDirtyChangeHint` (tres llamadas). Los folder workspaces no cambian: upstream no revisa cambios en ellos.
- **Quitar proyecto:** solo lo desregistra (los archivos y worktrees se quedan en el disco o en el host remoto; se cierran sus terminales y ya avisaba de archivos sin guardar del editor). `ZotzProjectRemovalChanges` revisa las conversaciones del proyecto con la misma hidratación de estado del diálogo de borrar y lista las que tienen cambios sin commitear, con sus archivos y diffs, antes de confirmar. El aviso dice "N cambios sin commitear" (prop `keptLabel`), no "se perderán".
- Sin verificar en local: las dependencias compartidas (`node_modules` de grunt) quedaron con enlaces rotos tras una reinstalación del 2026-11-19, así que no corrieron vitest, los plugins de oxlint ni `check:code-quality:changed`; los cubre el CI del PR. Sí pasaron `pnpm tc`, oxfmt, oxlint base, los ratchets de max-lines y workspace-record-read, y la extracción, cobertura y catálogos de traducciones.

### 2026-11-19 — Fase 8: ver qué espera en la cola (`memory-limiter-backlog-indicador`)

- Un chat nativo retenido por la cola no decía nada: el agente se quedó ~20 min en Backlog sin que se notara. Ahora el chat muestra la misma tarjeta "En cola" que la terminal, arriba del compositor (`ZotzQueuedChatNotice`, una línea en `NativeChatStructuredSession`). Se busca por la llave canónica de la sesión, sin importar qué pestaña la muestre.
- Barra lateral simple: la conversación con un agente en cola lleva un reloj de arena y "En cola · N min" en color de pendiente, por encima del estado de sus hilos.
- La tarjeta dice cuántos minutos lleva esperando.
- **Por qué esperó con RAM de sobra:** el tope de agentes simultáneos (4 con 32 GB, 2 con 16 GB) contaba a todos los agentes con sesión abierta, también los que esperaban respuesta. Con 4 chats abiertos, el quinto se quedaba en cola por `concurrency` aunque sobrara memoria.
- **Decisión (Hugo, 2026-11-19): solo decide la RAM.** Se quitaron el tope por cantidad (`maxConcurrentAgents`) y el presupuesto del 70 % para agentes (`agentBudgetBytes`). Un agente entra si, después de su costo estimado, quedan libres `minFreeGb` (max(2 GB, 15 %)) y la presión es `ok`; si no, espera y arranca solo cuando se libera memoria (muestra cada 15 s mientras haya cola). La memoria disponible la reporta el sistema, así que incluye los procesos en segundo plano de los agentes.
- Para que una ráfaga no llene la RAM: un agente admitido aparta durante 90 s lo que le falta de su estimación (estimación − lo medido), porque al arrancar mide poco. Antes la reserva se soltaba con la primera medición y el tope por cantidad tapaba el hueco.

### 2026-11-19 — Archivar conversaciones principales y cola de memoria por servidor (`zotz/servidores-cola-y-archivar`)

- Spec: [`SPEC-servidores-cola-y-archivar.md`](./SPEC-servidores-cola-y-archivar.md). Parte A en este PR; Parte B (cola de memoria de los servidores visible y controlable desde la laptop) en PRs siguientes.
- **Archivar la conversación principal de un proyecto** (por ejemplo `uni` en la MSI): el menú ofrecía Archive y Delete solo fuera del checkout principal, así que para esa fila no existían. Ahora Archive también aparece en principales; Delete sigue bloqueado. La sección Archivadas ya lista las principales, y se restauran desde ahí.
- `archiveZotzConversation` ignoraba el resultado de `updateWorktreeMeta` y avisaba "Conversation archived" aunque fallara. Ahora manda el host de la conversación y, si falla, muestra el error sin "Deshacer".
- Sin cambio en `useArchiveOnMerge`: una principal nunca se archiva sola al hacer merge.
- Sin verificar con la MSI real; se comprobó con la fixture `ZotzProjectSidebar:archivedMain`.

### 2026-11-20 — Cola de memoria de los servidores, lectura (`zotz/cola-servidores-lectura`)

- Spec: [`SPEC-servidores-cola-y-archivar.md`](./SPEC-servidores-cola-y-archivar.md), Parte B. La laptop ahora ve la cola de memoria de cada servidor emparejado.
- **Servidor:** llamadas RPC nuevas `zotz.agentQueue.snapshot` y `zotz.agentQueue.subscribe` (permiso `workspace`) y la capability `zotz.agent-queue.v1`. El constructor del snapshot salió del IPC de Electron (`zotz-agent-queue-snapshot-builder.ts`) y el limitador se registra en `zotz-agent-queue-source.ts`, para que un servidor sin escritorio también pueda atenderlo. Solo se agregan llamadas.
- **Cliente:** `zotz-host-agent-queue-store.ts` sigue la cola de cada servidor que declare la capability y olvida el que se desconecta; lo que llega de otra máquina se valida entrada por entrada (`zotz-agent-queue-remote-snapshot.ts`). Se monta en `use-app-shell-services.ts`.
- **Interfaz:** el aviso de cola del chat de un servidor sale con "En {servidor}" y sin botones (cancelar y _Launch anyway_ son la PR 3); la barra lateral une la cola local con la de los servidores para el reloj de arena y "En cola · N min".
- **Compatibilidad:** un servidor sin la capability no muestra cola y no da errores. Para ver la cola de la MSI, la MSI debe tener este release.
- **Sin cubrir todavía:** tarjetas sobre terminales de un servidor y tablero por máquina. No se verificó con la MSI real.

### 2026-11-20 — Cola de memoria de los servidores, acciones (`zotz/cola-servidores-acciones`)

- Spec: [`SPEC-servidores-cola-y-archivar.md`](./SPEC-servidores-cola-y-archivar.md), Parte B, fase 3. Desde la laptop se puede cancelar un arranque en cola de un servidor o pulsar _Launch anyway_.
- **Servidor:** llamadas RPC nuevas `zotz.agentQueue.cancel`, `forceStart` y `dismissCanceled` (permiso `workspace`, id de 1 a 1024 caracteres, igual que el IPC de la ventana) y la capability `zotz.agent-queue-control.v1`, aparte de la de lectura porque un servidor que publica su cola puede no tener todavía estas llamadas. En un servidor sin limitador no hacen nada ni fallan.
- **Cliente:** `zotz-host-agent-queue-actions.ts` llama al servidor y, si falla, avisa con el nombre del servidor; no actualiza nada a mano porque el flujo de la cola del servidor reporta el resultado. Los botones del aviso del chat de un servidor salen solo si declara la capability de control.
- **Sin cubrir todavía:** tarjetas sobre terminales de un servidor (falta comprobar que la clave de panel coincide) y el tablero por máquina. No se verificó con la MSI real.

### 2026-11-20 — Cola de memoria de los servidores, terminales (`zotz/cola-servidores-terminales`)

- Un agente de terminal lanzado en un servidor y retenido por su limitador no mostraba nada en la laptop: la tarjeta "En cola" del pane solo leía la cola local. Ahora lee la cola del servidor dueño del worktree, con "En {servidor}" y Cancelar / _Launch anyway_ si el servidor declara la capability de control; la franja de cancelado también.
- **Clave de panel:** el servidor recibe el `tabId`/`leafId` de la laptop en `terminal.create` y `terminal.createAgentSession` y los conserva, así que la cola lo guarda con la misma clave que calcula la ventana.
- `use-zotz-queue-on-host.ts` reúne cola, nombre y acciones de la máquina (local o servidor) para el chat y la terminal.
- **Tablero de todas las máquinas:** una sola tabla (Backlog / In Progress / Review / Done) con las tarjetas de todas las máquinas; arriba, una línea de memoria por máquina (esta primero, con "Este equipo"). Cada tarjeta lleva la marca de su máquina (ícono de equipo o servidor y nombre) cuando hay más de una. En el backlog, cada máquina conserva su turno y las siguientes de cada una quedan juntas arriba. Un servidor sin la capability de control no muestra botones y una línea arriba dice que hay que actualizarlo. El contador "en cola" de la barra de estado suma todas las máquinas; la RAM libre sigue siendo la de esta.
- **Panel lateral, no diálogo:** el tablero se abre junto a la barra lateral, sin bloquear la app, como el Workspace board y el de Agents (`ZotzAgentQueueDrawer`, montado en `sidebar/index.tsx`). Abrir uno cierra los otros dos; Escape, la X o el botón de la barra de estado lo cierran.
- **Memoria libre en macOS:** el limitador usaba el "free percentage" de `memory_pressure` (heredado de Orca), que cuenta como libre lo que el kernel recuperaría comprimiendo o paginando: con 10 GB en swap marcaba 15 GB libres de 24 cuando Monitor de Actividad dejaba ~8. Ahora toma el menor entre ese número y lo que queda fuera de "Memoria usada" (apps + wired + comprimida, de `vm_stat`), tanto para mostrar como para admitir agentes (`collectZotzHostMemory`). El monitor de recursos de Orca no cambia.
- **Pendiente:** un agente lanzado desde la laptop en un servidor entra con prioridad `automation` (la más baja), porque el servidor solo reconoce `mobile`/`cli` como remotos.
- **Riesgo abierto:** la laptop espera la respuesta de crear la terminal remota ~3 min (`REMOTE_RUNTIME_AUTO_RECOVERY_TIMEOUT_MS`); si el agente sigue en cola más tiempo, el pane se da por desconectado. Falta que una espera en cola no cuente como caída.

### 2026-11-20 — Marca de segundo plano y sin archivar al hacer merge (`zotz/sonar-segundo-plano`)

- **Marca propia para el segundo plano:** cuando el agente terminó y solo sigue un proceso en segundo plano (estado `monitoring`), la barra lateral mostraba la misma onda que con el agente trabajando. Ahora muestra `ZotzBackgroundSonar` (un punto con dos arcos de eco que pulsan). La onda queda solo para `working`, que siempre gana: si en la conversación el agente trabaja y además hay un proceso en segundo plano, se ve la onda.
- **Se quita `useArchiveOnMerge`:** una conversación ya no se archiva sola al mergear su PR; solo Hugo la archiva desde el menú. También salió la cadena `zotz.sidebar.archivedMerged`. La limpieza automática de upstream (`workspaceCleanup`) sigue apagada por defecto y no se tocó.
- Verificado con la fixture `ZotzWorkingRipple:backgroundOnly`; no se probó con un proceso real en segundo plano.

### 2026-11-19 — Fase 9a: modal de tareas y agentes (`zotz/fase-9-tareas`)

- Spec: [`TASKS-SPEC.md`](./TASKS-SPEC.md).
- Un solo modal (`ZotzBoardModal`) con pestañas **Tareas** y **Agentes**, montado una vez desde `ZotzRootOverlays` en la raíz de la app. El botón de kanban de la barra lateral abre Tareas; el indicador de la cola en la barra de estado abre Agentes. Tareas todavía muestra un estado vacío hasta la 9b.
- El Workspace board de Orca queda oculto, no borrado: `useZotzWorkspaceBoardPanel` reemplaza a `useWorkspaceBoardPanel` en la barra lateral, deja el drawer siempre cerrado, apaga la vista previa al arrastrar y manda el atajo y el comando del board a la pestaña Tareas.
- Se borraron de los 11 idiomas los 3 textos del botón viejo (`auto.components.sidebar.SidebarToolbar.*`): el gate de localización no deja textos sin uso.
- Sorpresa: el store de la cola tronaba si `snapshot()` devolvía `undefined` (cliente web sin runtime). Ahora lo trata como vacío.
- Verificado con la fixture `zotz/tasks/ZotzBoardModal` (ambas pestañas, ambos temas) y `pnpm check:changed`. Sin verificar en la app real.

### 2026-11-20 — Fase 9b, parte 1: tablero con GitHub Projects (`zotz/fase-9-tareas`)

- **Ajustes → Tareas → Tablero de tareas de Zotz:** lista los Projects de tu cuenta y de tus orgs (`listAccessibleProjects` de Orca), agrupados por dueño con su avatar. Hay casilla por org (marca todos sus Projects) y por Project. Se guarda en `zotzTaskBoardSources`.
- **Pestaña Tareas:**
  - "Todos los proyectos" junta los Projects en Backlog / In Progress / In Review / Done. Cada opción de Status cae en su columna por nombre o sinónimo (`Todo`, `Ready` → Backlog; `QA`, `Review` → In Review); lo que no casa va a "Sin estado".
  - Al elegir un Project se ve tal cual en GitHub con el `ProjectBoard` de Orca, sin arrastre.
  - Un issue que está en dos Projects sale una vez, y un PR ligado a un issue del tablero no sale como tarjeta aparte.
- **Datos:** usa `fetchProjectViewTable` (y su caché) con la vista por defecto del Project; si es roadmap, toma la primera vista board o tabla. Se cargan al abrir la pestaña y con "Actualizar"; la actualización cada 5 min queda para la parte 2.
- **Detalle de solo lectura:** campos del Project, asignados, labels, issue padre, sub-issues, PRs ligados y "Abrir en GitHub". El cuerpo del issue no viene en las filas del Project; leerlo queda pendiente.
- **Archivar terminadas** guarda en `zotzTaskBoardArchived` (setting, no archivo aparte). Una tarea archivada vuelve sola si sale de Done.
- Avatares de dueños: `https://github.com/<login>.png`, sin llamada extra a la API; si no cargan, se ocultan.
- Test de la lógica pura en `zotz-task-board-columns.test.ts` (mapeo, duplicados, PR ligado, archivado). Verificado con fixtures (`ZotzTaskBoard:combined`, `:detail`, `ZotzTaskBoardSourcesSetting:picker`) y `pnpm check:changed`. Sin verificar con GitHub real ni en la app.

### 2026-11-20 — Fase 9d, parte 1: servicios de tareas externos (`zotz/fase-9-tareas`)

- **Contrato** en `shared/zotz/tasks/zotz-tasks-contract.ts`. Un esquema `zod` lee JSON, YAML o TOML.
  - Una tarea inválida se omite y se reporta con su motivo; un documento inválido no reemplaza al último bueno.
  - Límites: 2 MB y 2,000 tareas.
- **Main** (`main/zotz/tasks/`):
  - `ZotzTaskConnectorService` descarga cada feed con `Authorization: Bearer`, 15 s de límite, y guarda el último documento en `zotz-task-connectors.json`.
  - El token se cifra con el `SecretStore` del sistema en `zotz-task-connector-secrets.json` (modo 600). Si el sistema no puede cifrar, no se guarda.
  - IPC `zotzTasks:*` y puente `window.api.zotzTaskConnectors`.
- **Ajustes → Tareas → "External task services":** URL + token opcional, o "Import file". Muestra el número de tareas, la hora, la primera tarea omitida y el error.
- **Tablero:**
  - El modelo de tarjeta ahora acepta tareas de GitHub y externas (`origin`).
  - El Status externo cae en la columna por nombre y, si no, por `category`.
  - Cada servicio tiene su vista con sus columnas.
  - El detalle muestra sus campos.
- Probado en la app real con un feed local protegido por token: sin token da 401 y no se agrega; con token, 5 tareas y 1 omitida. Capturas en la evidencia de la sesión.
- Tests: `zotz-tasks-contract.test.ts` (tareas omitidas, JSON/YAML/TOML iguales, versión, columna por nombre y por categoría).

### 2026-11-20 — Fase 9 completa: 9b parte 2, 9c, 9d parte 2, 9e y 9f (`zotz/fase-9-tareas`)

- **9b, parte 2:**
  - **Repos sin Project:** en Ajustes cada cuenta u organización (también las que no tienen Projects) tiene "Mostrar repos". Los issues se leen de GitHub, no de clones locales: los 100 más recientes, abiertos y cerrados. El Status se deriva así: abierto → Todo, abierto con PR abierto que lo cierra → In Progress, cerrado → Done.
  - **Vistas guardadas** (`zotzTaskBoardViews`):
    - Tienen alcance (todo, un Project, un repo o un servicio), board o tabla, filtro con la sintaxis de GitHub, Group by (fuente, proyecto, asignado, estado) y orden (fuente, actualizadas, título).
    - Los cambios quedan con un punto hasta "Guardar vista"; doble clic renombra la vista.
    - _Column by_ no se elige: el combinado usa el Status de Zotz y la vista de un Project usa la columna de esa vista en GitHub.
  - **Filtro:** acepta `is:`, `status:`, `assignee:@me`, `label:`, `repo:`, `project:`, `source:`, `no:`, `has:`, `updated:@today-7d` e `iteration:@current`, negación con `-` y comas como OR.
  - **Actualización:** cada 5 min mientras el tablero está abierto (`useNow`).
- **9c — PRs de GitHub:**
  - La tarjeta tiene línea de PR ("→ main · PR open", "PR merged into main", "PR closed without merging", +N).
  - El detalle tiene la sección Development: PRs ligados (`closedByPullRequestsReferences`) con autor, +/−, archivos y commit de merge; ramas ligadas (`linkedBranches`); y PRs que solo lo mencionan (timeline), con "Ligar en GitHub".
  - Se lee por lotes de 20 issues con caché de 5 min.
  - Los despliegues (GitHub Deployments) no entraron.
- **9d, parte 2:**
  - **CLI:** `zotz tasks push` (RPC `zotz.tasks.push`, capability `zotz.tasks-push.v1`, también hacia un servidor emparejado), `tasks validate` (local) y `tasks schema` (local).
  - **JSON Schema:** `docs/zotz/schemas/zotz-tasks-v1.schema.json`, generado con `tasks schema`.
  - **Detección de PRs:** Zotz lee los 50 PRs más recientes de los repos del tablero y los que el servicio declara. Si `taskIdPattern` aparece en la rama o el título, el PR se liga; si solo aparece en el cuerpo, queda como mención.
  - **`link-pr`:** se envía solo cuando algo cambia, se reintenta si falla, y manda `unlinked` cuando un enlace desaparece.
  - **Acciones:** se comprueban con `dryRun` al conectar.
  - **Patrones peligrosos:** los cuantificadores anidados se rechazan.
- **9e:**
  - **Chip en la tarjeta:** muestra el workspace ligado (por `linkedIssue` o por el id de la tarea en la rama) y el estado de su agente; un clic lo abre.
  - **Crear workspace:** "Crear workspace con esta tarea" usa el composer de Orca. Para GitHub liga el issue; para servicios pone el id en el nombre.
  - **Pendiente:** el cuerpo de la tarea como primer prompt no se puede, porque el composer no lo acepta. "En cola" tampoco, porque la cola no guarda el workspace de cada espera.
- **9f:** arrastrar en la vista de un servicio que verificó `move` manda la acción y mueve la tarjeta; si falla, avisa.
- **Rebase sobre #33:** la cola de memoria pasó a un panel lateral propio con todas las máquinas. El modal de tareas ya no tiene pestaña "Agentes" para no duplicarla, y el indicador de la barra de estado abre ese panel, como en `main`.
- **Arreglos que salieron al probar con datos reales:**
  - **Grupos duplicados en Ajustes:** una organización salía dos veces (sin host y con `github.com`).
  - **PRs perdidos:** la sincronización de PRs podía escribir sobre un conector que un refresh acababa de reemplazar.
  - **Ajustes sin el conector de `push`:** no se enteraba porque faltaba `notifyListeners`.
- **Probado** en la app real con el Project TEDYC, un repo suelto, un servicio local con token y `zotz tasks push` desde la CLI compilada. El servicio recibió los `dryRun`, dos `link-pr` reales (un PR detectado por la rama `feature/issue-19-…` y otro declarado) y un `move`.
- Los 4 tests de `cross-version-wire` fallan en esta máquina: una copia vieja en caché (`tests/e2e/.cross-version-checkouts/v1.4.265`) importa un paquete `cloud/` que no existe aquí. No es por este cambio.

### 2026-11-20 — README de Zotz y carpeta `~/zotz` (`zotz/readme-zotz`)

- **README:** reescrito en español para Zotz, sin nombres, enlaces ni imágenes de Orca. Imágenes de las fixtures en `docs/assets/zotz/` y `social-preview.png` para la vista previa del repo (se sube a mano: GitHub no tiene API). Los README traducidos y los assets viejos de `docs/assets/` se quedan por el costo de sync.
- **Carpeta visible:** los worktrees nuevos van a `~/zotz/workspaces` y los proyectos nuevos a `~/zotz/projects` (antes `~/orca/...`). `getDefaultWorkspaceDir` y el espejo de WSL usan `ZOTZ_HOME_FOLDER_NAME` (`src/shared/zotz/zotz-home-folders.ts`). `~/.orca` sigue igual (decisión de Fase 1c).
- **Migración al cargar el perfil** (`src/main/zotz/zotz-workspace-dir-migration.ts`): si el ajuste guardado era el default viejo (o no existía), pasa a `~/zotz/workspaces` y `~/orca/workspaces` entra a `workspaceDirHistory`, así que los worktrees que ya están ahí conservan dueño y visibilidad. Una carpeta elegida a mano no se toca. La clasificación de WSL reconoce ambas raíces.
- **No se mueven los worktrees existentes:** git los registra por ruta absoluta y pueden tener agentes corriendo. Siguen en `~/orca/workspaces` hasta que se borren; cuando la carpeta quede vacía se puede borrar a mano.

### 2026-11-20 — Crear conversación en un servidor desde la laptop (`zotz/crear-conversacion-remota`)

- **Problema:** en "Create workspace", con un proyecto que solo existe en la Mac (carpeta o repo sin remote, id `repo:<id>`), la fila "MSI Server" decía "Project location not set" y no hacía nada. Upstream oculta "Set project location" para esos proyectos porque no puede ligarlos a otra máquina.
- **Cambio:** para hosts locales y de runtime (no SSH), la fila ahora ofrece "Set project location". En ese caso la carpeta elegida se agrega como **proyecto propio** del servidor y el composer cambia a ese proyecto: _Browse folder_ (explorador de archivos del servidor) o _Carpeta nueva_ (crea `<home>/zotz/projects/<nombre>` con `repo.create`).
- Lógica en `zotz-host-folder-project-target.ts`, `components/zotz/project-location/`; ganchos cortos en `project-host-setup-options.ts`, `SetProjectLocationDialog.tsx` y `target-change-actions.ts` (busca el proyecto del setup nuevo).
- Sin RPC nuevas: el servidor no necesita este release. No se verificó con la MSI real.

### 2026-11-20 — Fase 9, parte 2: sumas, _Slice by_ y roadmap (`zotz-tablero-sumas-slice-roadmap`)

- **Campos de la fuente:** cada tarea expone sus campos numéricos, de fecha, single select e iteración, de GitHub (`fieldValuesByFieldId`) o de un servicio (`source.fields`), por nombre. Así el "Estimate" de dos Projects y de un servicio cuentan como el mismo campo. Para leer el nombre de los números y los single select de GitHub se agregó `fieldName` a esos valores en la normalización de Orca (igual que ya traían fechas e iteraciones).
- **Sumas:** la vista elige un campo numérico ("Sumar: Estimate"). Cada columna (combinado, Project y servicio), cada carril de Group by y cada grupo de la tabla muestran conteo y suma; la tabla agrega una columna con el valor. Las tareas sin valor no suman, como en GitHub.
- **_Slice by_:** la vista elige asignado, label, estado, proyecto, fuente, repo o un single select / iteración. El panel de la izquierda lista "Todos" y cada valor con su conteo (después del filtro escrito); un clic filtra. En la vista de un Project se cuentan sus propias filas. El valor elegido no se guarda, solo el campo; cambiar de vista o de campo vuelve a "Todos".
- **Roadmap:** tercer layout. Reusa la línea de tiempo del roadmap de Orca (`project-roadmap-timeline`: meses, posiciones, fechas). La vista guarda inicio, fin y zoom (mes/trimestre); si no se eligen, se toman por nombre (_Start_/_Target_) o la primera iteración. Línea de hoy, botón "Hoy", grupos con su suma, tareas sin fecha en una lista aparte, clic en barra o título abre el detalle. Solo lectura.
- **Vistas:** `zotzTaskBoardViews` guarda `sumField`, `sliceBy`, `roadmapStart`, `roadmapEnd` y `roadmapZoom`; las vistas viejas los leen con valores por defecto. `ProjectBoard` de Orca recibe un `columnSummary` opcional para la suma en la vista de un Project.
- Tests: `zotz-task-view-fields.test.ts` (suma por nombre, catálogo de campos, slices por asignado y por campo, barras de fechas invertidas, iteraciones y campos por defecto).
- Verificado con fixtures (`ZotzTaskBoard:sums`, `:tableSums`, `:roadmap`, `:projectSlice`, ambos temas) y `pnpm check:changed`. Sin probar en la app real con el Project TEDYC.

### 2026-11-20 — Fase 9, parte 2: relay de webhooks (`zotz-relay-webhooks`)

- **Servicio `zotz-relay`** (repo aparte, Vercel + Upstash Redis):
  - Recibe los webhooks de una GitHub App, verifica `X-Hub-Signature-256` y guarda solo el aviso (qué repo, número o Project cambió), 7 días.
  - `GET /v1/events` con long-poll y token de dispositivo; `POST /v1/sources/<id>/push` para proveedores, con el documento 24 h o hasta que Zotz lo confirma.
  - Tests de la firma (con el ejemplo de la doc de GitHub) y de los cursores.
- **Zotz:**
  - _Ajustes → Tareas → Relay para avisos al instante_: URL + token cifrado; apagado por defecto.
  - Con el relay en vivo, cada aviso relee solo el Project, el repo o la sección Development afectada, y la consulta completa baja a cada 30 min. Si falla, vuelve a cada 5 min y la barra dice "Relay caído".
  - Los documentos de proveedores entran como `zotz tasks push`, solo si su `source.id` es el de la fuente autenticada.
- **Cambios de paso:**
  - El manejo de tokens cifrados salió de `ZotzTaskConnectorService` a `ZotzTaskSecretFile`, que ahora guarda uno a la vez.
  - La recarga del tablero es por fuente, así que releer un Project no cancela la carga de otro.
  - Development ya no relee todos los issues en cada cambio de la lista después del primer refresco automático; solo con "Actualizar" o con un aviso.
- **Sorpresas:**
  - Vercel KV ya no existe; su reemplazo es Upstash Redis desde el Marketplace (plan gratis de 500,000 comandos al mes).
  - Una GitHub App privada solo se instala en la cuenta que la creó. Para las orgs hace falta una App por org o una App pública con lista de cuentas permitidas.
  - Bug previo: el refresco cada 5 min dependía de una función que cambiaba en cada render, así que después del primer tick el tablero se refrescaba en cada render. Se arregló al mover el temporizador a `useZotzTaskRelay`.
- **Probado:**
  - El relay local (`npm run dev`) con curl: firma inválida rechazada, entrega repetida descartada, long-poll que responde al llegar el webhook, push → documento → confirmación.
  - `ZotzTaskRelayClient` contra ese relay: el aviso llegó al momento, el documento se importó y uno con otro `source.id` se descartó.
  - La sección de Ajustes con la fixture `zotz/tasks/ZotzTaskRelaySetting` (conectar, en vivo, caído), en ambos temas.
  - Sin desplegar ni probar con GitHub real: falta crear el repo, Vercel, Upstash y la GitHub App.

### 2026-11-20 — El tablero de tareas como página (`zotz-task-board-full`)

- El tablero dejó de ser un modal: es una página completa, como Inicio, en la vista nueva `zotz-board` (`ZotzBoardPage`). Ocupa todo el alto y las columnas crecen con la ventana.
- En la barra lateral simple, "Tareas" queda justo abajo de Inicio (`ZotzSidebarTopNav`). El botón de kanban del pie solo sigue en la barra lateral de Orca.
- `zotz-board-page-store` abre y cierra la página sobre `activeView` y recuerda la vista anterior; el atajo y el comando del Workspace board la alternan. Abrir un workspace o crear uno desde una tarea ya cambia a `terminal`, así que no cierran nada a mano.
- Enganches en upstream (una línea cada uno): `TopLevelView`, su lookup y su esquema de RPC, `UiViewHistory`, las vistas sin barra derecha y `AppWorkspaceShell`.
- Verificado con fixtures (`ZotzBoardPage:empty`, `ZotzTaskBoard:combined` y el nav) y `pnpm tc`. Sin verificar en la app real.

### 2026-11-21 — Tours al día con Zotz (`zotz-tours-al-dia`)

- **Galería "Conoce Zotz"** (Ayuda → Explorar): dos recorridos nuevos al inicio, _Nodo 24/7_ (modo servidor + Tailscale) y _Memoria y cola_, y _Tareas_ ahora muestra el tablero de Zotz en vez de la lista de Linear/GitHub. Cada uno trae un storyboard animado (`components/zotz/feature-education/`) y un botón para probarlo: abrir el asistente de la máquina, la cola o el tablero. El de workspaces ya no muestra `orca.yaml` ni OpenCode; "mantener despierta" se ve fija en modo servidor.
- **Tours contextuales nuevos** (`shared/zotz/feature-education/zotz-contextual-tours.ts`): barra lateral (Tareas, `+` del proyecto, menú de la conversación), tablero vacío y con tareas (vistas, filtro, layouts, tarjeta, fuentes), cola en la barra de estado al lanzar el primer agente, tablero de la cola (memoria de cada máquina, backlog) y Segundo plano (eco de la fila + pestaña). Corren una vez en todo perfil, no solo en los de primer arranque, y no gastan el límite de un tour por sesión.
- **Arreglos**: el último paso del tour de agentes ("otra tarea en paralelo") ahora ancla en _Crear_ de la barra lateral de Zotz, así que vuelve a pasar al tour de crear workspace. El asistente personal/servidor bloquea los tours mientras está abierto.
- **Getting Started**: el paso de tareas se llama "Llena tu tablero de tareas", abre el tablero y cuenta como hecho con fuentes de Zotz; las skills se instalan desde el repo de Zotz (antes apuntaban a `stablyai/orca` con un commit que ahí no existe).
- **Tips y onboarding**: el tip de la CLI muestra `zotz …` y avisa "`zotz` quedó registrado"; el onboarding solo ofrece los agentes visibles, habla del tablero de tareas y esconde "pedir un idioma" (iba al feedback de orca.dev, apagado).
- **Agente trabajando = barritas**: la onda azul de la barra lateral (`ZotzWorkingRipple`) se cambió por tres barras que suben y bajan (`ZotzWorkingBars`), la misma marca que usa la landing; también en los visuales de la galería.
- Enganches en upstream de una o pocas líneas: uniones de ids (tours, interacciones, workflows y su telemetría), `useContextualTour`, el cuerpo de la galería, copias del checklist y la URL de skills.
- Verificado con `pnpm tc`, oxlint/oxfmt, tests de las zonas tocadas y fixtures (`ZotzFeatureWallBody:node|queue|tasks`, claro y oscuro).

### 2026-11-21 — La app como la landing: proyectos entre máquinas y servidores en la barra de estado (`zotz-tours-al-dia`)

- **Un proyecto, varias máquinas**: la barra lateral agrupa por `getProjectIdentityKey` (GitHub owner/repo o el remoto git), así la misma repo en esta Mac y en cada servidor es una sola sección. Si el proyecto está en más de una máquina, cada conversación muestra su chip de máquina (`Local Mac`, `MSI Server`) y el `+` abre el compositor sin fijar host para elegir dónde. Con una sola máquina remota se queda el chip en el encabezado, como antes.
- **Barra de estado**: con uno o dos hosts conectados nombra las máquinas ("MSI Server · Mac mini") en vez de contar "N hosts"; con más sigue el conteo.
- Verificado: `pnpm tc`, oxlint/oxfmt, 46 archivos de tests, fixture `ZotzProjectSidebar:projectAcrossMachines` y la barra lateral cargada en la app real. La agrupación entre máquinas no se probó con datos reales: hoy ninguna repo está a la vez en la Mac y en la MSI.

### 2026-11-23 — Grupos de conversaciones, hijos y arrastrar (`zotz-grupos`)

Spec: [`SPEC-grupos.md`](./SPEC-grupos.md). Las 5 fases en una rama, un commit por fase.

- **Grupos con nombre:** un grupo es un enlace (`zotzConversationLinks`) con `name` y `order`; uno con nombre sobrevive vacío. Sección **Grupos** arriba de **Proyectos**; quien está en un grupo ya no sale en su proyecto. Menú de la fila: "Mover a grupo" (grupos, nuevo, quitar). Menú del grupo: renombrar, eliminar (los miembros vuelven a su proyecto y se desenlazan).
- **Arrastrar** (drag nativo con tipo propio, `use-zotz-sidebar-drag`): a un grupo en la posición del puntero, a su proyecto (sale del grupo), reordenar dentro del grupo y reordenar grupos por el encabezado. Soltar en otro proyecto se niega con aviso en rojo. Los proyectos siguen por actividad.
- **Hijos:** la CLI manda `ORCA_AGENT_SESSION_ID` (solo al host local) y `--group`; el host resuelve la conversación del agente que crea y la guarda en `cliProvenance.zotzParentWorktreeId`, aunque se use `--no-parent` (la guía de upstream lo pide en cada entrega). Enganche de una línea en los dos caminos de creación (`worktree.create` y `agent.launch`) vía `buildZotzCliWorkspaceProvenance`. En la barra el hijo cuelga del padre (mismo grupo, o ambos sin grupo aunque sean de proyectos distintos) y se mueve con él. `useZotzGroupPlacement` lo mete una vez al grupo del padre o al de `--group` (lo crea si falta); `zotzPlacedConversations` recuerda a quién ya se colocó para que sacarlo a mano se respete.
- **Mapa del grupo** en el panel de Enlaces: nodo por conversación, línea por par que se escribió (grosor por cantidad, parpadea con correo nuevo), punteada de hijo a padre; clic en una línea filtra los mensajes.
- **Arrancar un grupo:** el diálogo de "Nuevo grupo" (desde `+`) deja elegir proyectos, agente y una tarea; crea una conversación por proyecto, las mete al grupo antes de arrancar (así cada agente conoce a los demás al iniciar) y les manda la tarea.
- Verificado: `pnpm tc`, oxlint/oxfmt, pruebas nuevas (grupos, soltar, anidado, colocación, líneas del mapa) y en una instancia dev con perfil copiado: crear grupo, arrastrar dentro/fuera, negar otro proyecto, anidar un hijo (marcado en memoria), mapa y diálogo de arranque. **Sin probar de punta a punta:** una entrega real que registre el padre, el mapa con correo real y el arranque de agentes (crea worktrees reales).

### 2026-11-23 — Tema Zotz Night con Karla (`zotz-tema-noche`)

- **Plugin incluido `zotz.zotz-night`** (`resources/plugins/launch/zotz.zotz-night`, solo datos, se activa solo como los de upstream): tema de app y de terminal oscuros con la paleta de Tokyo Night un escalón más oscura (fondo `#111219`, barras `#0c0d13`; todos los tokens públicos + colores de sintaxis para el editor) y las fuentes **Karla** (interfaz) y **Atkinson Hyperlegible Mono** (terminal y editor), WOFF2 variables 200–800 con itálicas, OFL. Licencias en el plugin (MIT de Tokyo Night/enkia, OFL de las fuentes).
- Los plugins incluidos aceptaban solo el publisher `stablyai`; ahora también `zotz` (`isShippedPluginPublisher`, enganchado en el índice de incluidos y en la confianza de instalación).
- **Default de Zotz:** perfil nuevo arranca en modo oscuro, tema y terminal Zotz Night, Karla y Atkinson Mono (`zotzNightLookDefaults`). **Perfiles guardados** migran una vez (`zotzNightLookApplied`), pieza por pieza: solo cambia lo que sigue en el default de Orca (tema oscuro sin elegir y terminal Ghostty → Zotz Night y `system` → `dark`; `Geist` → Karla; la mono de la plataforma → Atkinson Mono). Lo que alguien eligió se respeta.
- El cliente web no carga fuentes de plugins: ahí cae a Geist / la mono de la plataforma. La app móvil no cambia.
- Verificado: `pnpm tc`, suite unitaria y en una instancia dev con perfil copiado del instalado: migración aplicada, tokens pintados, Karla en la UI y Atkinson Mono en la terminal (fondo `#111219` medido en xterm), Ajustes → Apariencia muestra "Zotz Night".

### 2026-11-24 — Hijos también desde `orchestration worker-start` (`zotz-hijos-worker-start`)

- Las conversaciones que un agente crea con `zotz orchestration worker-start` no quedaban como hijas: ese camino crea el worktree con `createManagedWorktree` sin procedencia de CLI, así que nunca se guardaba `zotzParentWorktreeId`. Caso real: el orquestador de `avena-backoffice` creó `crear-panel-empresas` y `empresas-admin-backend` con `--worktree new-top-level --repo` y salieron sueltas en sus proyectos.
- `resolveWorkerWorktreeCreationTarget` ahora lleva la conversación que despacha (`zotzCreatorWorktreeId`, con `new-child` y `new-top-level`) y `recordZotzWorkerCreator` la escribe justo después de crear. Se escribe después y no al crear porque una creación `created-by-cli` fija el nombre generado y apagaría el renombrado por primer trabajo; por lo mismo guarda `displayNameIsPinned` explícito.
- Las conversaciones ya creadas antes del arreglo no se corrigen solas; se pueden arrastrar a un grupo.
- `pnpm check:changed`: solo fallan dos pruebas de `agent-launch-replay`, que fallan igual en `origin/main` (2c728b8cc2c) en esta Mac.

### 2026-11-24 — Terminales remotas con color y subgrupo por máquina (`zotz-terminales-remotas`, PR #45)

Sección C de la spec de monitor y remotos.

- **Color por máquina:** cada host que no es esta máquina (SSH, servidor Zotz, VM) toma uno de los 5 colores de `--git-graph-lane-*` (ya tienen valor claro y oscuro). Lo local, WSL y el servidor al que está pareado un cliente web no llevan color. La asignación (`assignZotzHostColorSlots`) parte de un hash del id del host y resuelve choques en orden de id, así que hasta 5 máquinas nunca comparten color y el mismo id cae igual en cada cliente. No se guarda nada.
- **Dónde se ve:**
  - Franja "Corre en <host>" arriba de la zona de pestañas del worktree (`ZotzHostStrip`).
  - Pestañas teñidas con línea arriba (`ZotzHostTabTint`, sobre el fondo de cada estado de la pestaña).
  - Punto de color en el chip de máquina de la barra lateral, en el encabezado de proyecto y en los subgrupos.
- **Grupo propio por máquina:** en Orca los grupos de pestañas son de un worktree y todas las terminales de un worktree corren en su host (la pestaña no tiene host propio; la terminal flotante siempre es local), así que ahí nunca se mezclan terminales locales y remotas y no hubo que tocarlos. Donde sí se mezclaban era en la barra lateral desde "proyectos entre máquinas". Ahora, dentro de cada proyecto, las conversaciones de esta máquina van arriba y las de cada máquina remota en su propia lista con nombre y color (`ZotzMachineSubgroups`). Las carpetas sueltas siguen la misma regla. Los Grupos con nombre del usuario no se tocan.
- **Ajuste:** "Agrupar conversaciones remotas por máquina" en Ajustes → General → Esta computadora (`zotzGroupRemoteByMachine`, encendido salvo `false`). Apagado vuelve a la lista mezclada con chips, ahora con punto de color.
- Enganches en upstream: dos líneas en `TabGroupPanel.tsx` (la franja y el contenedor de la tira de pestañas). `SortableTab.tsx` está en el tope de 400 líneas, por eso el tinte va en el contenedor y no en cada pestaña.
- **Sorpresa:** en la app, el host de una pestaña sale de `worktree.hostId` y de `activeWorkspaceExecutionHostId`, no del repo. Para simular un remoto en una instancia dev hubo que poner los tres.
- Verificado: `pnpm tc`, oxlint/oxfmt, test de la asignación de colores, fixtures (`zotz/host-color/ZotzHostStrip`, `ZotzProjectSidebar:projectByMachine` y `:projectByMachineOff`, ambos temas) y en una instancia dev con perfil copiado por CDP, con la MSI y un "Mac mini" simulados en el store en memoria: terminal real con pestaña teñida y franja, subgrupos, ajuste apagado, claro y oscuro. **Sin probar con un servidor real pareado**, ni el cliente web pareado. La app móvil no cambia (solo un campo opcional nuevo en los ajustes de Zotz).

### 2026-11-24 — Monitor del sistema, fases 1 y 2 (`zotz-monitor-sistema`)

Spec: [`SPEC-monitor-y-remotos.md`](./SPEC-monitor-y-remotos.md) §A. Lectores y parsers portados de `pblobp.os-vitals` 1.0.0 (MIT, crédito en el encabezado de cada archivo portado); el plugin no se instala.

- **Medidor en main** (`src/main/zotz/system-monitor/`): CPU total y por núcleo (deltas de `os.cpus()`), carga, uptime; memoria con las funciones del gobernador (`collectZotzHostMemory` y su lector de presión, que ahora también entrega el swap de macOS sin leer `sysctl` dos veces); red, disco (E/S y espacio del disco de arranque con `statfs`), GPU, batería y procesos. Muestra cada 2 s **solo mientras una ventana mira la pestaña** (IPC `zotzSystemMonitor:watch/unwatch`, se suelta al cerrar o recargar la ventana); historial en memoria de 10 min con huecos donde nadie miraba.
- **Por plataforma:** macOS `netstat`/`route`/`ioreg`/`pmset`/`ps`; Linux `/proc` y `/sys` (+ `nvidia-smi` si existe); Windows **un solo PowerShell vivo** mientras se mira, con clases CIM de rendimiento (no dependen del idioma, a diferencia de `typeperf`), que se cierra solo si Zotz muere. En Windows no hay carga ni usuario de proceso ni totales desde el arranque.
- **Contrato** (`src/shared/zotz/system-monitor/zotz-system-monitor-contract.ts`): ya trae la lista de procesos (mitad más CPU + mitad más memoria, con PID, padre, usuario, comando) para la fase 3, y es serializable para la fase 5 (servidores).
- **Pestaña "Sistema"** en el tablero de la cola (pestañas Cola / Sistema): seis tarjetas con gráfica de historial y vista de detalle por tarjeta (núcleos, procesos que más CPU o memoria usan, interfaces, disco de arranque). Solo tokens existentes (`chart-2`, `muted-foreground`, `destructive`); textos en `en` + `es`.
- Enganches en upstream: una línea cada uno en `preload/index.ts` y `preload/api-types.ts`; el arranque cuelga del gobernador (`zotz-memory-governor-startup.ts`).
- Verificado: `pnpm tc`, oxlint/oxfmt, pruebas de parsers (netstat, diskstats, swap de Linux, línea del muestreador de Windows), el muestreador de macOS contra esta Mac, fixtures `zotz/system-monitor/ZotzSystemMonitorPanel` en claro y oscuro y la pestaña en una instancia dev por CDP (capturas en `capturas/monitor-sistema/`). **Sin probar en hardware:** Windows (el script de PowerShell/CIM) y Linux.
- **Sorpresa:** `typeperf` traduce los nombres de contadores en Windows en español, por eso se descartó para la MSI.
- **Sorpresa 2:** en desarrollo React monta dos veces (watch, unwatch, watch) y el segundo muestreo nunca arrancaba: un `return` dentro del `try` se saltaba la reprogramación. Ahora se reprograma en el `finally`, con prueba.

### 2026-11-24 — Monitor del sistema, fase 3: procesos (`zotz-monitor-procesos`)

- **Vista Procesos** (séptima tarjeta de la pestaña Sistema, y clic en un proceso desde los detalles de CPU o Memoria): todos los procesos, con filtro (nombre, PID, usuario, comando o agente), orden por columna y detalle (padre, usuario, CPU, memoria, línea de comando completa, a quién pertenece). Muestra 200 filas; el filtro encuentra el resto.
- **Dueños** (`zotz-system-process-owners.ts`): subiendo por los padres, el primer árbol de agente que conoce el gobernador (`listZotzAgentProcessRoots`) marca el proceso con su agente y conversación; si no, los PIDs de Zotz (main, helpers de Electron, daemon de terminales) lo marcan como **Zotz** o "en Zotz" (algo que Zotz inició).
- **Cerrar proceso** (`zotz-system-process-control.ts`): diálogo de confirmación; advertencia en rojo si es Zotz o un agente vivo. Primero SIGTERM (Windows: `taskkill` sin `/F`, que pide cerrar); si a los 3 s sigue vivo, el diálogo ofrece **Forzar cierre** (SIGKILL / `taskkill /F`). Se niega si el PID ya es de otro programa (reuso de PID) y nunca toca PID 0, 1 ni 4.
- La lista completa vive en main (la toma el mismo muestreo de la pestaña); el renderer la pide cuando main lee procesos, sin timer propio.
- Verificado: `pnpm tc`, oxlint/oxfmt, pruebas (dueños y la carrera del servicio), fixtures `processes` y `closeAgentProcess` en claro y oscuro, y en la app dev por CDP: un `sleep` se cerró con SIGTERM y uno que ignora SIGTERM ofreció "Forzar cierre" y se cerró; los procesos de la instancia salen como Zotz con su advertencia. **Sin probar:** Windows (`taskkill`, línea de comando vía `windows-process-table`) y la marca de agente con un agente real (la instancia dev no tenía agentes; cubierto con fixture y prueba).

### 2026-11-24 — Monitor del sistema, fase 4: barra de estado (`zotz-monitor-barra`)

- **`CPU · MEM`** junto al segmento de la cola (`ZotzSystemStatusSegment`, enganchado dentro del segmento de la cola: no toca `StatusBarSurface`). Clic abre el tablero directo en la pestaña Sistema (el tablero ahora recuerda su pestaña en `zotz-agent-queue-drawer-open`). Tooltip con GB usados, total y libres.
- **Sin segundo muestreador de memoria** (`zotz-system-status-service.ts`): CPU de los contadores que Node ya lee (`os.cpus()`, sin lanzar procesos) cada 3 s; memoria, presión y piso libre son los del gobernador, al que se le pide una muestra si su lectura tiene más de 15 s. Solo corre mientras una ventana visible muestra la barra (se suelta al ocultarse).
- **Aviso de memoria** con el mismo límite del gobernador: punto naranja en `elevated`, texto en rojo y un aviso (toast) al entrar en `critical`, con botón para ver el sistema. Es el mismo umbral que frena agentes nuevos, así la barra y la cola nunca discrepan.
- El manejo de ventanas que miran un muestreador quedó en `zotz-window-watchers.ts`, compartido por el monitor y la barra.
- Verificado: `pnpm tc`, oxlint/oxfmt, fixtures del segmento (normal, justo, crítico) en claro y oscuro, y en la app dev por CDP: el segmento muestra CPU y MEM, el tooltip coincide con la memoria libre del segmento de la cola y el clic abre la pestaña Sistema. **Sin probar:** el aviso de memoria crítica en vivo (la máquina no cruzó el piso durante la prueba).

### 2026-11-24 — Monitor del sistema, fase 5: servidores (`zotz-monitor-servidores`)

- **Por el mismo camino que la cola de los servidores:** métodos del runtime `zotz.systemMonitor.subscribe` (stream: snapshot y luego una actualización por muestra), `processes`, `processCommand` y `closeProcess`, leídos de `zotz-system-monitor-source.ts` como la cola lee `zotz-agent-queue-source.ts`. Enganche de una línea en `rpc-method-registry.ts`.
- **Capacidades nuevas** `zotz.system-monitor.v1` (leer) y `zotz.system-monitor-control.v1` (cerrar procesos), separadas porque cerrar es un poder mayor. Un servidor viejo no aparece; uno sin la segunda se ve sin el botón de cerrar.
- **Selector de máquina** en la pestaña Sistema (solo si hay servidores que lo publican): esta máquina y cada servidor emparejado. El servidor muestrea **solo mientras el stream está abierto**, igual que una ventana local; un watcher remoto usa ids por encima de 1 000 000 000 para no chocar con los de las ventanas.
- La vista de procesos y el diálogo de cerrar reciben un "cliente" (`zotz-system-monitor-client.ts`): IPC para esta máquina, runtime RPC para un servidor. Mismas advertencias y misma confirmación.
- Verificado: `pnpm tc`, oxlint/oxfmt, prueba del método de suscripción (snapshot, actualización, se suelta al salir el cliente), fixtures de servidor en claro y oscuro, y en la app dev llamando los métodos por el despacho del runtime (`window.api.runtime.call/subscribe`): capacidades anunciadas, stream con snapshot y actualizaciones, 1 122 procesos, línea de comando y cierre de un `sleep` de prueba. **Sin probar:** con un servidor emparejado de verdad (la MSI necesita esta versión), ni el selector en la app real (el perfil dev no tiene servidores).

### 2026-11-25 — Estimación de memoria por agente: mediana con tope (`zotz-gobernador-estimacion`)

- **Problema:** con 24 GB y memoria de sobra, cada lanzamiento de Claude quedaba en la cola y pedía "Lanzar de todos modos". El libro de picos guardaba el árbol entero de la terminal, y las corridas que arrancaron builds o `pnpm dev` (12–18 GB) dejaban el p90 en ~14 GB: nunca cabía sobre la reserva mínima.
- **Arreglo:** la estimación es la **mediana** de las últimas 20 corridas y nunca pasa de `perAgentMaxBytes` (35 % de la RAM, máx. 6 GB). Con el mismo historial queda en ~2 GB y entra sin preguntar. La presión del kernel y el crecimiento del swap siguen frenando lanzamientos cuando la máquina de verdad se queda sin memoria.

### 2026-11-25 — Receta de Multipass incluida (`zotz-multipass-receta`)

Sección B de la spec de monitor y remotos.

- **Plugin incluido `zotz.zotz-multipass`** (`resources/plugins/launch/zotz.zotz-multipass`): copia de `multipass-recipes` 2.0.1 de `stablyai/orca-plugins` (MIT, licencia en el plugin), para que funcione con el catálogo de Orca apagado. Cambios contra upstream: llave SSH en `${XDG_STATE_HOME:-$HOME/.local/state}/zotz/multipass/`, comentario de la llave y archivo temporal `zotz-multipass`, id de receta `zotz-multipass-ubuntu-lts` (no choca con la de Orca) y, si falta `multipass`, create sale con 127 y dice cómo instalarlo (`brew install --cask multipass` en macOS, `sudo snap install multipass` en Linux).
- **Incluida pero pendiente, como en upstream:** el manifiesto declara `execution: declarative`, así que el arranque la instala pero no la aprueba sola (solo los plugins de datos se aprueban solos). Hugo la aprueba una vez en Ajustes → Plugins → Multipass VM Recipes → Review → Enable plugin, después de ver los comandos create/suspend/resume/destroy.
- **Para usarla** también hay que encender Ajustes → Experimental → Cloud VM (`experimentalEphemeralVms`, apagado por defecto en upstream); ahí aparece en "Recipes" con "Use in workspace" para cada repo git local.
- **Windows:** la receta es `sh` y Windows corre las recetas con cmd.exe, así que no se ofrece: el índice de incluidos la filtra en win32 (`isBundledPluginOfferedOnPlatform` en `src/main/zotz/zotz-multipass-recipe.ts`, enganchado en una línea de `plugin-bundled-bootstrap.ts`).
- Verificado: `pnpm tc`, oxlint/oxfmt, hash del índice con `verify-packaged-plugin-resources`, y en una instancia dev con perfil nuevo por CDP: tras arrancar queda `pending`; la revisión muestra los cuatro comandos; tras aprobar queda encendida y la receta sale en el catálogo de VMs del repo (capturas en `capturas/multipass/`). El paso create con un PATH sin `multipass` imprime el aviso y sale con 127. **Sin probar:** crear una VM real (esta Mac no tiene Multipass), Linux y que Windows no la muestre.

### 2026-11-25 — Dictado en español para usuarios bilingües (`zotz-dictado-espanol`)

- **Problema:** con macOS en `en-MX` + `es-MX` y el idioma del dictado en Auto, la configuración de un clic tomaba solo el primer idioma y elegía Parakeet Unified EN (solo inglés). Dictar en español salía como "Necessitamos are a form of Nictara in Espaol…".
- **Sugerencia de modelo:** ahora cubre todos los idiomas que habla el usuario (idioma del dictado; con Auto, el idioma de la interfaz elegido y todos los idiomas preferidos del sistema). Entre los modelos que los cubren gana el de menor error en el peor idioma; con en + es es **Parakeet TDT v3** (en 3.7 %, es 1.7 %). `UiLanguageDetection` lleva `preferredTags` con la lista completa.
- **Perfiles guardados:** una vez por perfil (`zotzDictationLanguagesChecked`), si el modelo elegido no oye uno de esos idiomas, Zotz baja el sugerido en segundo plano y cambia al terminar (el dictado nunca se queda sin modelo); avisa con un toast. Si el usuario cambió de modelo mientras bajaba, se respeta el suyo. Modelos en la nube y dictado apagado no se tocan; el cliente web emparejado no corre la revisión.
- Verificado en una instancia dev con el modelo solo-inglés: la migración bajó Parakeet TDT v3 y cambió; el mismo audio en español (voz Eddy es-MX) pasó de "Necessitamos are a form of Nictara in Espaol…" a "Necesitamos agregar una forma de dictar en español. Si estoy hablando en español, la transcripción tiene que salir en español, con acentos y puntuación."; inglés sigue exacto.

### 2026-11-24 — Tema Zotz Contraluz (`zotz-tema-contraluz`)

- **Zotz Contraluz** (app + terminal) en el plugin incluido `zotz.zotz-night` (v1.1.0): base oscura de alto contraste para trabajar con reflejos o contra la luz. Texto casi blanco (`#f5f7ff` sobre `#0b0c12`, 18:1), texto secundario y pestañas inactivas ≥10:1, acentos más claros y saturados ≥9:1, bordes y divisores ≥3:1, selección azul sólida con texto blanco, comentarios sin itálica.
- No cambia el default: se elige en Ajustes → Apariencia (tema) y Ajustes → Terminal.

### 2026-11-26 — Revisar, aprobar y pasar a draft desde Zotz (`zotz-pr-revision`)

- **Página del PR:** botón **Review** en la barra de Files changed, junto a "Side by Side", como el "Review changes" de GitHub: comentario y Comentar / Aprobar / Pedir cambios, más **Pasar a draft** o **Listo para revisión**. Merge y cerrar ya existían en upstream.
- **Panel del PR (lateral):** la misma caja de revisión y **Pasar a draft** para PRs abiertos; "Listo para revisión" de los drafts ya lo traía upstream.
- **Backend:** `gh pr review` en `src/main/zotz/github/zotz-pr-review.ts`; IPC `gh:submitPRReview` y `gh:markPRDraft` (upstream solo tenía draft por RPC) en `zotz-pr-review-ipc.ts`; RPC `github.submitPRReview` para servidores emparejados y el cliente web.
- GitHub no deja aprobar ni pedir cambios en tu propio PR; Zotz lo dice en vez de mostrar el error de GraphQL.
- Verificado en una instancia dev por CDP con el PR #56: el botón Review abre la caja en Files changed y Aprobar llega a GitHub, que lo rechaza por ser propio, con el aviso claro (captura en `capturas/pr-revision/`). **Sin probar en vivo:** aprobar o pedir cambios en el PR de otra persona, pasar a draft (cambia un PR real) y el panel lateral, que no se pudo ligar a un PR abierto en el perfil de prueba.

### 2026-11-26 — Sin la pestaña de historial de sesiones (`zotz-quitar-historial`)

- La pestaña **Agent Session History** (`vault`) del panel derecho se oculta: las conversaciones de la barra lateral ya cumplen ese papel. No se borra de upstream; se filtra en `use-right-sidebar-activity-items.ts`.
- Si algo pide abrirla (por ejemplo `showAiVaultSearch` desde Ajustes), el panel cae en el Explorador con el respaldo que ya trae upstream para pestañas ocultas. El diálogo de historial para reanudar sesiones desde el chat no cambia.
- Verificado en una instancia dev por CDP: la barra ya no muestra el ícono y `showAiVaultSearch` deja el panel en el Explorador (captura en `capturas/quitar-historial/`).

### 2026-11-26 — Archivos cambiados del PR dentro de Zotz (`zotz-pr-archivos`)

- **Problema:** para revisar el diff de un PR había que abrirlo en Chrome.
- El panel del PR (pestaña Checks) suma el botón **Archivos cambiados**. Abre la página de PR que ya trae upstream (árbol de archivos, diff unificado o lado a lado, "Viewed", comentarios en línea) directo en esa pestaña, con `openTaskPage({ openGitHubInitialTab: 'files' })`. Solo GitHub.
- Verificado en una instancia dev por CDP con el PR #47 de avena-argos: el botón abre la página y carga los 9 archivos (capturas en `capturas/pr-archivos/`).

### 2026-11-26 — Repo de GitHub visible en la barra lateral y la de estado (`zotz-repo-github-visible`)

- **Problema:** en un grupo las filas decían el nombre de la carpeta del proyecto, que no siempre es el repo (la carpeta `avena-empresas` es `Avena-Health/avena-backoffice`), y todos los repos de una org llevan el mismo avatar. No había forma de saber en qué repo de GitHub estabas.
- **Barra lateral:** en un grupo, la fila muestra el nombre del repo de GitHub (owner/repo en el tooltip). El encabezado del proyecto suma una segunda línea con el repo cuando no coincide con la carpeta, y el ícono de GitHub (ahora visible siempre que hay remoto de GitHub) nombra owner/repo y lo abre en el navegador.
- **Barra de estado:** owner/repo del espacio activo, con clic para abrirlo en GitHub. Espacios de carpeta y repos sin remoto de GitHub no muestran nada.
- El repo sale del remoto `origin` (`github.repoSlug`, también por RPC en servidores emparejados), no de `gitRemoteIdentity`, que en un fork apunta al upstream. Se consulta una vez por repo y arranque (`src/renderer/src/components/zotz/repo-github/`).
- Verificado con fixtures (`zotz/sidebar/ZotzProjectSidebar:githubRepoInGroup`) en claro y oscuro. `server-hook-session-binding.test.ts` falla igual en `origin/main` en esta Mac; no es de este cambio.

### 2026-11-26 — Dictado en vivo dentro del campo (`zotz-dictado-en-vivo`)

- **Problema:** con un modelo sin streaming (Parakeet TDT v3) la frase solo se decodificaba al hacer una pausa de 0.6 s, y el texto solo entraba al campo cada 20 s de audio o al terminar; mientras hablabas solo se veía en la barra de arriba.
- **Motor (`stt-open-phrase-decode.ts`):** la frase que se está diciendo se decodifica otra vez cada 0.5 s más de audio y sale como texto parcial; la decodificación de la frase ya cortada lo reemplaza. Si una decodificación tarda más de la mitad del paso, ese dictado deja de hacerlas (máquinas lentas, Whisper). `performanceCoreThreads` pasó a su propio archivo por el límite de líneas del reconocedor.
- **Vista previa (`ZotzDictationLivePreview`):** las palabras aún no escritas se dibujan en gris en el cursor del campo donde van a caer (textarea, editor contentEditable, composer del chat y terminal), con la fuente del campo y envolviendo como texto tecleado; al escribirse de verdad desaparecen. No se escribe nada en el campo antes, así que deshacer y teclear al mismo tiempo siguen igual. La barra de arriba se queda. Páginas del navegador: solo la barra.
- Verificado: audio real de 11 s sin pausas (voz Eddy es-MX) alimentado en tiempo real en una instancia dev: texto nuevo cada ~0.5 s desde el segundo 1.6 y el final exacto; capturas de la vista previa en textarea y contentEditable (fixtures, claro y oscuro); en la terminal la posición cae en la celda del cursor (textarea auxiliar de xterm). **Sin probar de punta a punta:** el flujo con micrófono real (la prueba usa la API del motor y fixtures).

### 2026-11-27 — Logo luna pixelada (`zotz-logo-luna-pixel`)

- Fuente nueva: `resources/icon-source/zotz-bat-pixel.mjs` (murciélago 16×16 con alas arriba/abajo y luna 32×32). `render-zotz-icons.mjs` pinta cada tamaño a escala entera por celda; solo las esquinas del cuadro llevan suavizado.
- `generate.sh` ya no usa Icon Composer (`actool`) ni ImageMagick: solo Node (`pngjs`) + `iconutil`. Se borraron `icon.icon/` y `zotz-bat.svg`.
- Regenerados con los mismos nombres: `build/icon.{icns,png,ico}`, `icon.png`, `icon-dev.png`, `app-icons/*.png`, `tray/orca-menu-barTemplate*.png`, `logo.svg`. Nuevos: `logo-moon*.svg` (landing con aleteo, respeta `prefers-reduced-motion`) y `tray/zotz-tray-windows*.png`.
- Luna desde que cabe a 1 px por celda (≥ 40 px en `.ico`, ≥ 64 px en `.icns`); debajo, el murciélago solo sobre el cuadro noche.

**Sorpresas / pendientes**

- Bandeja de Windows: Electron no expone si la barra de tareas es clara u oscura (es distinto del tema de apps), así que en lugar de silueta clara/oscura usa el murciélago sobre el cuadro noche (16/32 px), que se lee en ambas. Linux no tiene bandeja en esta app.
- La insignia DEV de la barra de menú de macOS (`tray-dev-badge.ts`) se pinta encima del ala izquierda; solo afecta builds de desarrollo.

### 2026-11-28 — Flows, parte 0: contrato (`zotz/fase-10-flows-0-contrato`)

- `src/shared/zotz/flows/`: esquemas zod `zotz-flow/v1` (flow, disparadores, nodos, puertos), tipos de corrida, parser de plantillas `{{ }}` y validación pura del grafo. Parámetros RPC `zotz.flows.*` en `src/shared/rpc-contract/zotz/zotz-flows-params.ts`; el catálogo generado no cambia hasta que la parte 1 registre los handlers.
- El nodo Agente reusa los esquemas zod de `automation-params.ts` (`TuiAgent`, `WorkspaceRunContext`, `AutomationCanonicalLaunchSetup`, `SetupDecision`, `ExecutionHostId`, `AutomationSchedule`).

**Decisiones no escritas en el spec**

- Un nodo con varias entradas corre cuando todas sus entradas terminaron o se saltaron, y se salta si ninguna llegó; `join` solo hace falta para "esperar a la primera".
- Un flow puede tener varios nodos raíz: todos arrancan con el disparador. Un nodo sin ninguna conexión, cuando hay otros nodos, es error.
- El cuerpo de un `for_each` son los nodos con `parentId`; las aristas no cruzan el borde del bucle, el bucle entra a los nodos raíz del cuerpo y el cuerpo debe terminar en un solo nodo (la salida de cada vuelta).
- Una plantilla solo puede leer nodos que corren antes con seguridad (ancestros por aristas, más los ancestros de los bucles que lo contienen); ramas paralelas no cuentan.
- El nodo Comando no acepta plantillas en su texto: los valores van en `env` (`ZOTZ_FLOW_<NOMBRE>`).
- Puertos de Aprobación: `approved`, `rejected` y `timeout` (solo si tiene `timeoutSeconds`). Cualquier nodo con `onError: 'error_port'` suma el puerto `error`.
- `maxRunsPerHour` es un campo del flow (default 20). El token del webhook se guarda en el disparador y su ruta es `/zotz/flows/hooks/<id del disparador>`.

### 2026-11-28 — Flows, parte 1: motor (`zotz/fase-10-flows-1-motor`)

- `src/main/zotz/flows/`: guardado (`zotz-flows.json`, `zotz-flow-runs.json` con `SerialJsonWriter`, 200 corridas por flow), ejecutor del grafo (estados, reintentos, `onError`, timeout, cancelar, reintentar desde el nodo fallido, reanudar tras reinicio), concurrencia por flow, tope por hora, guarda de bucles, programador (`schedule`) y todos los nodos menos `chat_reply`. RPC `zotz.flows.*` en `src/main/runtime/rpc/methods/zotz/zotz-flows.ts` (capacidad `zotz.flows.v1`) y CLI `zotz flows list|run|runs|export|import`.
- Punto de entrada único: `startZotzFlowRun(flowId, trigger, origin, options?)` en `zotz-flow-runtime.ts`. La marca de origen se lee con `findZotzFlowOrigin({ chatSessionId, terminalPaneKey, terminalPtyId, workspaceId })`; la parte 3 la pasa como `{ source: 'event', causedBy }` y el motor rechaza el evento si el flow (o uno que lo llamó como subflow) lo causó.
- El nodo Agente lanza un registro de automatización **no guardado**: el runner no lo aceptaba para Chat en workspace nuevo (la verificación de procedencia busca la automatización guardada), así que `launchAutomationChatAgent` recibe `unsaved: true` y omite esa procedencia (cambio de pocas líneas). La corrección JSON va a la misma sesión por los caminos de reuso de sesión de las automatizaciones (chat y terminal).
- Cola de memoria: el nodo espera con prioridad de automatización (`queued`) y su timeout empieza al ser admitido; `ZotzAgentLaunchQueue.grantPass` deja pasar una vez el lanzamiento que sigue, para que no espere dos veces.

**Decisiones no escritas en el spec**

- `subflow` devuelve la salida de los últimos pasos de nivel superior del flow llamado: si terminó uno, su salida tal cual; si varios, Markdown con `## nombre` y JSON con un objeto por nombre.
- `continue` sale por `main`, o por el puerto "negativo" si no hay `main` (`false`, `default`, `rejected`, `with_failures`).
- Un Comando con exit code distinto de 0 no falla: es un resultado que lee la Condición. HTTP fuera de 2xx sí falla (con el cuerpo a la vista). Las variables `env` llegan en mayúsculas: `ZOTZ_FLOW_<NOMBRE>`.
- Reintentar crea una corrida nueva (`resumedFromNodeId`) que conserva lo anterior al nodo y las vueltas ya terminadas de un bucle reiniciado.
- Corridas manuales y de subflow corren aunque el flow esté apagado; horario y eventos no. El tope por hora cuenta todas las corridas que no se saltaron.
- Notificar en un servidor sin escritorio deja el aviso solo en la salida del paso.
- Contrato: se agregó el código `duplicate_slug` a `ZotzFlowProblemCode` (el host lo devuelve al guardar).

### 2026-11-28 — Flows, parte 3: disparadores por evento (`zotz/fase-10-flows-3-eventos`)

- `src/main/zotz/flows/zotz-flow-event-triggers.ts`: registro que arranca con el motor (`zotz-flow-startup.ts`) en la máquina donde viven los flows. Cada fuente corre solo mientras algún flow encendido la escucha y se rehace al guardar, apagar o borrar un flow. Todas inician por `service.startRun` con `{ source: 'event', causedBy }`; el tope por hora y la guarda de bucles los aplica el motor. Un evento da una sola corrida por flow aunque dos de sus disparadores lo acepten.
- **Agente terminó** (`zotz-flow-agent-finished-source.ts`): terminales por `runtime.agentTransitions` con `TerminalAgentTurnNews` (las mismas reglas que el aviso al celular); chats por `subscribeTurnCompletions` del host de chats, que se sigue aunque se instale tarde. `causedBy` sale de `findZotzFlowOriginMark` con el `terminalPaneKey` o el `chatSessionId` y el workspace. `lastMessage`: respuesta aceptada completa, si no la transcripción (`readNativeChatTranscriptTail`; en chats, la historia del journal), si no la vista previa.
- **PR** (`zotz-flow-pull-request-source.ts`): avisos `pull_request` del relay (el cliente del relay suma `onNotices` y hace long-poll mientras un flow escucha); con el relay apagado o fallando, consulta cada 2 min por GraphQL (`gh`) de los repos que piden los disparadores, o de los repos locales si uno no nombra repo. Dedupe en `zotz-flow-events.json` por `pr:<repo>#<n>:<acción>`; la primera lectura de un repo solo marca desde cuándo hay noticias y un evento de más de 24 h no dispara.
- **Tarea cambió** (`zotz-flow-task-moved-source.ts`): el servicio de conectores avisa cada documento nuevo (sync, import, `move`) con el anterior; se compara la columna `Status` de cada tarea. Primera carga, tareas nuevas y borradas no disparan. Con el tablero cerrado, los feeds URL se releen cada 5 min mientras un flow escucha.
- **Webhook** (`zotz-flow-webhook.ts`): `POST /zotz/flows/hooks/<id del disparador>` en el servidor HTTP del `WebSocketTransport` (el de `zotz serve` y del pareo del escritorio, puerto 6768 por defecto), enganchado con una línea en `ws-transport.ts`. Token en `X-Zotz-Flow-Token` (o `Authorization: Bearer`), comparado por digest con `timingSafeEqual`; cuerpo JSON de hasta 1 MB; responde `202 { runId, status }`. Hereda el filtro de origen de `serve` (solo la máquina y Tailscale).

**Decisiones no escritas en el spec**

- Resultado del agente: `failure`, `interruption` y `unconfirmed` cuentan como `error`; `cancellation` y `superseded` como `interrupted`; sin veredicto, `success`. Un turno que se detuvo esperando al usuario no cuenta como terminado.
- Los filtros de texto aceptan el id o el nombre (sin mayúsculas): proyecto = id o nombre del repo (o de la carpeta), workspace = id, nombre o ruta, fuente = id del conector, id o nombre de la fuente, columna = id o nombre de la opción.
- PR y tarea no traen sesión de Zotz, así que van con `causedBy: null`; el tope por hora acota un flow que abre PRs o mueve tareas.

**Sorpresas / pendientes**

- El tablero de GitHub Projects se lee en el renderer, no en main: "tarea cambió" cubre los feeds externos (`zotz-tasks/v1`). Los repos remotos por SSH no se consultan para PRs sin repo explícito, y `workspace.branch` llega `null`.
