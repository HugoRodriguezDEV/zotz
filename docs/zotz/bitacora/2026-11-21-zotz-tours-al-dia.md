# Tours al día con Zotz (`zotz-tours-al-dia`)

2026-11-21

- **Galería "Conoce Zotz"** (Ayuda → Explorar): dos recorridos nuevos al inicio, _Nodo 24/7_ (modo servidor + Tailscale) y _Memoria y cola_, y _Tareas_ ahora muestra el tablero de Zotz en vez de la lista de Linear/GitHub. Cada uno trae un storyboard animado (`components/zotz/feature-education/`) y un botón para probarlo: abrir el asistente de la máquina, la cola o el tablero. El de workspaces ya no muestra `orca.yaml` ni OpenCode; "mantener despierta" se ve fija en modo servidor.
- **Tours contextuales nuevos** (`shared/zotz/feature-education/zotz-contextual-tours.ts`): barra lateral (Tareas, `+` del proyecto, menú de la conversación), tablero vacío y con tareas (vistas, filtro, layouts, tarjeta, fuentes), cola en la barra de estado al lanzar el primer agente, tablero de la cola (memoria de cada máquina, backlog) y Segundo plano (eco de la fila + pestaña). Corren una vez en todo perfil, no solo en los de primer arranque, y no gastan el límite de un tour por sesión.
- **Arreglos**: el último paso del tour de agentes ("otra tarea en paralelo") ahora ancla en _Crear_ de la barra lateral de Zotz, así que vuelve a pasar al tour de crear workspace. El asistente personal/servidor bloquea los tours mientras está abierto.
- **Getting Started**: el paso de tareas se llama "Llena tu tablero de tareas", abre el tablero y cuenta como hecho con fuentes de Zotz; las skills se instalan desde el repo de Zotz (antes apuntaban a `stablyai/orca` con un commit que ahí no existe).
- **Tips y onboarding**: el tip de la CLI muestra `zotz …` y avisa "`zotz` quedó registrado"; el onboarding solo ofrece los agentes visibles, habla del tablero de tareas y esconde "pedir un idioma" (iba al feedback de orca.dev, apagado).
- **Agente trabajando = barritas**: la onda azul de la barra lateral (`ZotzWorkingRipple`) se cambió por tres barras que suben y bajan (`ZotzWorkingBars`), la misma marca que usa la landing; también en los visuales de la galería.
- Enganches en upstream de una o pocas líneas: uniones de ids (tours, interacciones, workflows y su telemetría), `useContextualTour`, el cuerpo de la galería, copias del checklist y la URL de skills.
- Verificado con `pnpm tc`, oxlint/oxfmt, tests de las zonas tocadas y fixtures (`ZotzFeatureWallBody:node|queue|tasks`, claro y oscuro).
