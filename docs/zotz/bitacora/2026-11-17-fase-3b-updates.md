# Fase 3b (`zotz/fase-3b-updates`)

2026-11-17

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
