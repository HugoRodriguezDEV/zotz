# Progreso del asistente y marca en textos (`claude/zots-loading-screen-orca-names-ae9160`)

2026-11-17

**Qué cambió**

- Asistente de servidor: arriba dice "Paso X de N: <paso>" con el tiempo que lleva, una barra, qué está haciendo el paso actual y una consola con la salida real. En Windows, mientras corre el script elevado, main lee su transcript (`zotz-node-setup.log`) cada segundo (`zotz-node-setup-log-progress.ts`): los pasos que faltan quedan pendientes en vez de todos girando, y la instalación de OpenSSH (5–15 min) dice que tarda.
- El progreso por IPC ahora es `{ steps, output }`; las fases que no son el script escriben líneas con el mismo formato (`== paso ==`, `paso -> done: …`).
- Firewall (`zotz-node-setup.ps1`): limitar a la tailnet la regla Allow de `zotz.exe` fallaba en la MSI ("Aplazar a usuario" solo se puede usar…), porque las reglas que crea el aviso de Windows traen `EdgeTraversalPolicy DeferToUser`. Ahora se cambia a `Block` en la misma llamada (`Set-NetFirewallRule`); el tráfico de Tailscale no usa edge traversal.
- "Orca" → "Zotz" en todos los textos de la interfaz y los menús sin tocar los JSON de upstream: `zotz-brand-copy.ts` se aplica a los catálogos al cargarlos (renderer y main) y a los textos por defecto de `t()`, antes de interpolar. Se conservan "Orca Mobile" / "app móvil de Orca" (la app oficial) y el namespace `zotz.*`. Los tests de upstream lo apagan con `zotz-vitest-upstream-brand-copy.ts`.

**Sorpresas / pendientes**

- Siguen en inglés con "Orca" los mensajes de error armados en main sin `t()` (instalador del CLI, orcad administrado, pairing). Son poco visibles; cambiarlos es editar código de upstream.
- No se pudo abrir la app Electron en la MSI desde el worktree (node-pty no compila sin VS C++); se verificó con capturas de fixtures y con el log real de una configuración en curso.
