# Logo luna pixelada (`zotz-logo-luna-pixel`)

2026-11-27

- Fuente nueva: `resources/icon-source/zotz-bat-pixel.mjs` (murciélago 16×16 con alas arriba/abajo y luna 32×32). `render-zotz-icons.mjs` pinta cada tamaño a escala entera por celda; solo las esquinas del cuadro llevan suavizado.
- `generate.sh` ya no usa Icon Composer (`actool`) ni ImageMagick: solo Node (`pngjs`) + `iconutil`. Se borraron `icon.icon/` y `zotz-bat.svg`.
- Regenerados con los mismos nombres: `build/icon.{icns,png,ico}`, `icon.png`, `icon-dev.png`, `app-icons/*.png`, `tray/orca-menu-barTemplate*.png`, `logo.svg`. Nuevos: `logo-moon*.svg` (landing con aleteo, respeta `prefers-reduced-motion`) y `tray/zotz-tray-windows*.png`.
- Luna desde que cabe a 1 px por celda (≥ 40 px en `.ico`, ≥ 64 px en `.icns`); debajo, el murciélago solo sobre el cuadro noche.

**Sorpresas / pendientes**

- Bandeja de Windows: Electron no expone si la barra de tareas es clara u oscura (es distinto del tema de apps), así que en lugar de silueta clara/oscura usa el murciélago sobre el cuadro noche (16/32 px), que se lee en ambas. Linux no tiene bandeja en esta app.
- La insignia DEV de la barra de menú de macOS (`tray-dev-badge.ts`) se pinta encima del ala izquierda; solo afecta builds de desarrollo.
