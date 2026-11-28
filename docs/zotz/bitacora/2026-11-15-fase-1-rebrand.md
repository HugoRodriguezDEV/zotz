# Fase 1 (`zotz/fase-1-rebrand`, PR #3)

2026-11-15

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
