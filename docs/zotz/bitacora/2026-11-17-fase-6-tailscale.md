# Fase 6 (`zotz/fase-6-tailscale`)

2026-11-17

- Solo tailnet: `src/main/zotz/zotz-tailnet-source-guard.ts` (`ZotzTailnetOnlySourceGuard`) admite loopback y Tailscale (`100.64.0.0/10`, `fd7a:115c:a1e0::/48`) y rechaza LAN y públicas al aceptar el TCP. Se activa con `zotzTailnetOnly` en las opciones que devuelve `zotzServerNetworkSources` (modo servidor) y se engancha con 3 líneas en `createServeNetworkSourceGuard`, así cubre el arranque y la adopción en caliente del asistente. Antes el modo servidor usaba la política de `--refuse-public`, que también acepta la LAN.
- Firewall (`zotz-node-setup.ps1`): las reglas **Allow** de `Zotz.exe` que Windows crea en el primer "Permitir acceso" (remoto `Any`) dejaban pasar la LAN por encima de la regla de tailnet; ahora se limitan a `100.64.0.0/10` en vez de borrarse (borrarlas haría que Windows vuelva a preguntar).
- Pairing: no hizo falta código. Relay apagado desde Fase 2 y los enlaces/QR del asistente ya usan la IP de Tailscale leída en vivo. Por SSH: `orca pair --address <IP-100.x>` / `orca pair --mobile --address <IP-100.x>`.
- Docs: `docs/zotz/guias/REMOTE.md` (requisitos, vincular laptop/móvil, qué orígenes entran, SSH de respaldo, diagnóstico).

**Sorpresas / pendientes**

- No se usa `--bind <IP-de-Tailscale>` (decisión de Fase 5): la IP cambia y upstream rechaza abrir la red con una IP fija. El filtro por origen + firewall da el mismo resultado.
- `orca serve` sin ventana mantiene la política de upstream (acepta LAN); el nodo no lo usa. Documentado cómo restringirlo.
- Falta la prueba manual: vincular desde la laptop y desde la app móvil oficial por la tailnet, y confirmar que desde la LAN (`192.168…`) se rechaza.
