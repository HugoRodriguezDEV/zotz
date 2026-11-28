# Tema Zotz Night con Karla (`zotz-tema-noche`)

2026-11-23

- **Plugin incluido `zotz.zotz-night`** (`resources/plugins/launch/zotz.zotz-night`, solo datos, se activa solo como los de upstream): tema de app y de terminal oscuros con la paleta de Tokyo Night un escalón más oscura (fondo `#111219`, barras `#0c0d13`; todos los tokens públicos + colores de sintaxis para el editor) y las fuentes **Karla** (interfaz) y **Atkinson Hyperlegible Mono** (terminal y editor), WOFF2 variables 200–800 con itálicas, OFL. Licencias en el plugin (MIT de Tokyo Night/enkia, OFL de las fuentes).
- Los plugins incluidos aceptaban solo el publisher `stablyai`; ahora también `zotz` (`isShippedPluginPublisher`, enganchado en el índice de incluidos y en la confianza de instalación).
- **Default de Zotz:** perfil nuevo arranca en modo oscuro, tema y terminal Zotz Night, Karla y Atkinson Mono (`zotzNightLookDefaults`). **Perfiles guardados** migran una vez (`zotzNightLookApplied`), pieza por pieza: solo cambia lo que sigue en el default de Orca (tema oscuro sin elegir y terminal Ghostty → Zotz Night y `system` → `dark`; `Geist` → Karla; la mono de la plataforma → Atkinson Mono). Lo que alguien eligió se respeta.
- El cliente web no carga fuentes de plugins: ahí cae a Geist / la mono de la plataforma. La app móvil no cambia.
- Verificado: `pnpm tc`, suite unitaria y en una instancia dev con perfil copiado del instalado: migración aplicada, tokens pintados, Karla en la UI y Atkinson Mono en la terminal (fondo `#111219` medido en xterm), Ajustes → Apariencia muestra "Zotz Night".
