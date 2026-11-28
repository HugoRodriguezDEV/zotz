# Spec — Material "Liquid Glass" para la interfaz

Una opción de Apariencia que pone vidrio translúcido en la navegación de Zotz (barra lateral, pestañas, riel derecho, barra de estado y caja de texto del chat) sobre un fondo índigo apagado. El contenido (chat, terminal, editor, tablas) sigue opaco. Rama: `zotz-liquid-glass`. Reglas del fork: [`PLAN.md`](./PLAN.md).

**Estado (2026-11-27):** solo diseño. No hay código. El mock completo vive en un lienzo privado de claude.ai: <https://claude.ai/artifact/K1FmnAeR53CWxRo9i5mTQt> (11 pantallas, versión 2, después de tres revisiones).

## 1. Decisiones (Hugo, 2026-11-25)

- **Oscuro por defecto**, con los grises de Zotz (`#0a0a0a`, `#171717`, `#f0f0f0`) y un fondo índigo apagado sacado del ícono del murciélago. Nada de colores brillantes: lo usan devs.
- **Vidrio solo en el cromo.** El contenido siempre es opaco.
- **Es una opción, no el diseño nuevo.** "Plano" (el de hoy) sigue siendo el default.

## 2. Reglas de diseño

1. **Dónde va el vidrio:** `Sidebar`, `TabBar`, `RightRail`, `StatusBar` y el compositor del chat. En ningún otro lado: ni tarjetas, ni columnas, ni diálogos, ni la aprobación de herramientas.
2. **Desenfoque solo donde pasa contenido por debajo.** El fondo es estático, así que el cromo es color con transparencia (`.chrome`), sin `backdrop-filter`. Solo el compositor, que flota sobre el chat con `position: sticky`, usa `blur(16px)`. Una sola capa de desenfoque por pantalla.
3. **Diálogos y paletas** (Saltar a, Crear espacio de trabajo, la cola): superficie casi sólida (97%) con `shadow-floating`. La aprobación de herramientas usa `SecuritySurface`, sólida y con borde propio.
4. **Foco visible siempre:** anillo de 2px con `--ring`, 3:1 o más sobre el vidrio. Prohibido `outline: none` sin reemplazo.
5. **Selección:** fondo `--cur` **más** una barra sólida de 2px (a la izquierda en filas, abajo en pestañas). El fondo solo no basta: sobre vidrio da 1.1–1.3:1.
6. **Estados del agente con ícono y texto**, nunca solo un punto de color: "Trabajando", "Espera tu respuesta", "En cola", "Segundo plano", "Falló", "Terminó".
7. **Contraste:** texto 4.5:1 o más sobre la superficie real (vidrio compuesto sobre el fondo). Bordes de campos 3:1 o más.
8. **Tamaños:** escala 11/12/13/14 px; chat en 13 px; títulos de página 18 px, de sección 15 px. Radios: controles 8 px, tarjetas 10 px, paneles 12–14 px; píldoras solo para badges. Botones de 28–32 px.
9. **Botones:** el primario (`--btn`) solo para la acción afirmativa. "Lanzar de todos modos" y "Squash y merge" con checks fallando son secundarios.
10. **Reducir efectos visuales** (el ajuste que ya existe en `settings/appearance/ReduceVisualEffectsSetting.tsx`) y `prefers-reduced-transparency` quitan el desenfoque y dejan los paneles sólidos.

## 3. Tokens

Nuevos tokens, siempre en pares claro/oscuro. Se activan con la clase del material en la raíz (por ejemplo `.zotz-glass`), así que "Plano" no cambia nada.

| Token                  | Oscuro                  | Claro                   | Uso                           |
| ---------------------- | ----------------------- | ----------------------- | ----------------------------- |
| `--glass-panel`        | `rgba(26,25,33,.66)`    | `rgba(255,255,255,.58)` | Cromo                         |
| `--glass-panel-strong` | `rgba(22,22,24,.97)`    | `rgba(252,252,253,.97)` | Diálogos, compositor sin blur |
| `--glass-edge`         | `rgba(255,255,255,.09)` | `rgba(255,255,255,.85)` | Borde del vidrio              |
| `--glass-highlight`    | `rgba(255,255,255,.12)` | `rgba(255,255,255,.95)` | Brillo interior de 1px arriba |
| `--glass-current`      | `rgba(255,255,255,.13)` | `rgba(10,10,30,.09)`    | Fondo de lo seleccionado      |
| `--field-line`         | `#71717a`               | `#85858f`               | Borde de campos (3:1)         |
| `--ring`               | `#a59cff`               | `#4b5bd6`               | Foco                          |
| `--glass-wall`         | ver abajo               | ver abajo               | Fondo de la ventana           |

Fondo oscuro:

```css
radial-gradient(55% 60% at 12% 8%, #29234d 0, transparent 70%),
radial-gradient(50% 55% at 92% 18%, #1c1f36 0, transparent 70%),
radial-gradient(60% 60% at 70% 100%, #231b40 0, transparent 70%),
linear-gradient(160deg, #111017, #0a0a0b 55%, #0d0b13)
```

Estados: usar los que ya existen (`--zotz-gh-*`, `--git-decoration-*`, `--zotz-working-wave`). En claro hay que oscurecer ámbar y verde para pasar 4.5:1 sobre `--glass-current` (`#8a5c00`, `#116329`).

## 4. Pantallas del mock

1. Chat trabajando (compositor con Detener, "Acceso total", contexto en %).
2. Chat esperando aprobación (plan aprobado, aprobación sólida con comando, carpeta y motivo, atajos ↵/Esc, mensaje en cola).
3. Terminal dividida (panel activo marcado) + Control de código fuente (Fetch/Pull/Push, acciones por archivo, commit dividido).
4. Editor con diff lado a lado y una nota para la IA.
5. PR y checks (fallo con extracto del log, "Arreglar con IA", comentario que se pone en cola).
6. Tareas (5 columnas con "Sin estado", chips reales del agente).
7. Cola de agentes y Sistema (memoria por máquina; procesos sin botón de cerrar en la tabla).
8. Crear espacio de trabajo (combobox con búsqueda, foco inicial, ⌘↵).
9. Saltar a… (filtros por hosts y proyectos, badges Actual/Host/Proyecto/Acción).
10. Ajustes › Apariencia (Tema, Material Plano / Liquid Glass, intensidad Sutil/Media/Alta, fondo, Reducir efectos visuales, Aumentar contraste, Zoom).
11. Inicio (textos y atajos reales, aviso de preflight).

## 5. Implementación propuesta

- **Ajuste:** `zotzUiMaterial: 'flat' | 'glass'` (default `'flat'`) e intensidad `'subtle' | 'medium' | 'strong'`. Control nuevo en `settings/appearance/zotz-ui-material-setting.tsx`, enganchado en `AppearancePane.tsx` con una línea.
- **Estilos:** archivo nuevo `assets/zotz-glass.css` importado desde `main.css`. Todo bajo `.zotz-glass` en `<html>`; agrega los tokens de la §3 en `:root` y `.dark` y los expone en `@theme inline`.
- **Componentes:** sin forks. Cada superficie de cromo recibe una clase (`zotz-glass-chrome`) con un cambio de una línea; los estilos viven en el CSS nuevo.
- **Foco y selección:** el anillo y la barra de selección valen también para "Plano". Probablemente conviene sacarlos en un PR propio antes del material.
- **Multiplataforma:** solo CSS (`backdrop-filter` de Chromium), así que funciona igual en macOS, Windows y Linux. No usar `vibrancy` ni `backgroundMaterial` de Electron ni un fondo de pantalla del sistema: no son portables y rompen el contraste. El material de la ventana del terminal (`TerminalWindowSection`) no cambia.
- **Remotos, móvil y carpetas:** no les afecta; es solo presentación del renderer.
- **Guía de estilo:** hay que agregar a `docs/STYLEGUIDE.md` la excepción del material (hoy son tres niveles de elevación y cromo monocromo).
- **Verificación:** fixtures de `pnpm fixtures:shot` para Sidebar, TabBar, StatusBar y compositor en oscuro, claro y con efectos reducidos; contraste medido sobre la superficie compuesta.

## 6. Revisión del mock (2026-11-25)

Tres revisores (UI, UX y paridad de funciones con la app). Lo que la versión 2 ya corrige: foco visible, selección con barra, estados con texto, vidrio solo en el cromo, una capa de desenfoque, aprobación sólida, bordes de campos a 3:1, primario solo para afirmar, textos y atajos reales, y tres pantallas nuevas (editor, PR/checks, chat en espera).

**Pendiente:**

- Pantallas sin hacer: navegador integrado, menús contextuales, toasts y notificaciones, host remoto caído o reconectando, terminal flotante, diálogos de borrar y forzar cierre, asistente de modo de máquina.
- Estados por probar con el vidrio: muchas pestañas, barra lateral con 30+ filas y grupos, vacíos, cargando y errores.
- Textos que el mock inventa y hay que alinear antes de implementar: "Enviar 1 nota al agente", el aviso de GitHub CLI en Inicio y los nombres de grupo de ejemplo.
- La aprobación real solo tiene Permitir y Denegar en `es.json`; si "Permitir para esta sesión" existe en otro agente, agregarlo al diseño.
- El mock es de macOS (botones de ventana y ⌘). Falta la variante de Windows y Linux.

## 7. Preguntas abiertas

1. ¿El material se elige por máquina o se sincroniza entre dispositivos?
2. ¿"Liquid Glass" queda detrás de Experimental hasta que pase una prueba de uso diario?
3. ¿Sacamos primero el foco visible y la selección con barra para "Plano", que ya son una mejora por sí solos?
