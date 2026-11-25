# Spec — Monitor del sistema, Multipass y terminales remotas

Tres trabajos independientes, un PR cada uno. Reglas del fork: [`PLAN.md`](./PLAN.md) (diff mínimo contra upstream, código de Zotz en módulos `zotz`, enganches de una línea en archivos de Orca, bitácora al terminar).

## Decisiones (Hugo, 2026-11-24)

- OS Vitals se integra **con código propio** en el monitor de memoria (tablero de la cola de agentes), no se instala el plugin.
- **Sí** se pueden cerrar procesos desde Zotz (con confirmación).
- Las terminales remotas van **en su propio grupo de pestañas** y **con color distintivo**.
- La receta de Multipass viene incluida en Zotz.

## A. Monitor del sistema (estilo OS Vitals)

Referencia: plugin `pblobp.os-vitals` 1.0.0 (MIT), en `github.com/stablyai/orca-community-mirror`, tag `pblobp/orca-plugins/os-vitals/1.0.0`, carpeta `plugins/os-vitals`. Se pueden portar sus lectores y parsers dando crédito (licencia MIT en el encabezado del archivo portado). No se instala ni se carga el plugin.

Lo que ya existe: `src/main/zotz/memory-governor/` (muestrea memoria por agente; `zotz-darwin-memory-signals.ts` ya calcula la memoria usada igual que Activity Monitor) y el tablero `src/renderer/src/components/zotz/agent-queue/ZotzAgentQueueBoard.tsx` (Backlog / En progreso / Revisión / Hecho), que también ve la cola de los servidores.

Fases (un PR cada una):

1. [x] **Medidor del sistema (main)**: CPU total y por núcleo, carga, uptime; memoria (reusar la del gobernador, sin duplicar el muestreo), swap y presión; red (bajada/subida, interfaz por defecto); disco (lectura/escritura, espacio del disco de arranque); GPU si hay; batería o energía; procesos (CPU, memoria, PID, usuario, padre, comando). macOS, Linux y Windows (en Windows sin `sh`: PowerShell/CIM o APIs de Node). Solo mide mientras alguien mira la vista, salvo lo que el gobernador ya mide. Historial en memoria (anillo de N minutos).
2. [x] **Pestaña "Sistema" en el tablero**: tarjetas CPU, Memoria, Red, Disco, GPU, Energía, con gráfica de historial y vista de detalle por tarjeta. Tokens y primitivas del styleguide; sin colores nuevos.
3. [x] **Procesos**: lista filtrable y ordenable, detalle del proceso, botón "Cerrar proceso" con confirmación (SIGTERM, luego ofrecer forzar). Los procesos de agentes se marcan con su conversación (árboles que ya conoce el gobernador). Nunca ofrecer cerrar el propio Zotz sin advertencia clara.
4. [x] **Barra de estado y avisos**: `CPU · MEM` junto al segmento de la cola; aviso de memoria con los mismos umbrales del gobernador (un solo límite).
5. [x] **Servidores**: los mismos datos de cada máquina remota en la pestaña, con selector de máquina (por el mismo camino que la cola de los servidores).

## B. Multipass VM Recipes incluida

Referencia: `github.com/stablyai/orca-plugins/tree/main/plugins/multipass-recipes` (MIT): receta declarativa `recipes/ubuntu-lts.json` (create, suspend, resume, destroy) que entrega una conexión SSH. Zotz ya soporta recetas de VM (`src/main/ephemeral-vm`, `vmRecipes`).

1. [x] Incluir la receta en Zotz como plugin o recurso incluido (igual que el tema `zotz.zotz-night`), para que funcione con el catálogo de Orca apagado.
2. [x] Rutas propias: `${XDG_STATE_HOME:-$HOME/.local/state}/zotz/multipass/` en vez de `orca/multipass`.
3. [x] Si `multipass` no está instalado, mensaje claro con cómo instalarlo según el sistema.
4. [x] Solo macOS/Linux por ahora (la receta es `sh`); en Windows no se ofrece o se explica por qué.

## C. Terminales remotas: grupo propio y color

1. [ ] **Color por máquina**: cada host no local (SSH, VPS, servidor Zotz, VM de Multipass, WSL no cuenta como remoto salvo que el código ya lo trate así) recibe un color estable de una paleta fija tomada de tokens existentes de `main.css`. Lo local no lleva color.
2. [ ] **Dónde se ve**: franja arriba del panel de terminal con el nombre del host; pestaña teñida con ese color; la misma marca en la barra lateral de Zotz.
3. [ ] **Grupo propio**: las terminales de un host remoto abren en su propio grupo de pestañas (uno por máquina) en vez de mezclarse con las locales. Ajuste para apagarlo (encendido por defecto).
4. [ ] Modo claro y oscuro; que no rompa la app móvil.
