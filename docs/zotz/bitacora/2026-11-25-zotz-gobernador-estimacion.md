# Estimación de memoria por agente: mediana con tope (`zotz-gobernador-estimacion`)

2026-11-25

- **Problema:** con 24 GB y memoria de sobra, cada lanzamiento de Claude quedaba en la cola y pedía "Lanzar de todos modos". El libro de picos guardaba el árbol entero de la terminal, y las corridas que arrancaron builds o `pnpm dev` (12–18 GB) dejaban el p90 en ~14 GB: nunca cabía sobre la reserva mínima.
- **Arreglo:** la estimación es la **mediana** de las últimas 20 corridas y nunca pasa de `perAgentMaxBytes` (35 % de la RAM, máx. 6 GB). Con el mismo historial queda en ~2 GB y entra sin preguntar. La presión del kernel y el crecimiento del swap siguen frenando lanzamientos cuando la máquina de verdad se queda sin memoria.
