# Fase 7 (`zotz/fase-7-seguridad`)

2026-11-17

- `docs/zotz/guias/SECURITY.md`: usuario estándar `zotz` (qué instalar ahí y qué nunca), tokens con alcance mínimo (GitHub fine-grained solo con los repos del nodo y 90 días; cuentas o API keys de agentes solo para el nodo con límite de gasto), qué revocar y en qué orden si el nodo se compromete, punto de restauración antes del asistente y tarea semanal `\Zotz\Backup` (robocopy como `SYSTEM`, sin cachés). Los bloques de PowerShell se verificaron con el parser.
- Sin cambios de código: todo es configuración de la máquina y de las cuentas, que hace Hugo.

**Sorpresas / pendientes**

- Hoy la MSI corre Zotz como `rodri` (el usuario principal) y su carpeta de datos tiene la identidad de pairing (`orca-devices.json`, `orca-e2ee-keypair.json`). Hay que crear `zotz` y mover el nodo ahí.
- Los secretos que Zotz cifra con `safeStorage` (DPAPI) solo se descifran con el mismo usuario en la misma instalación de Windows: un respaldo restaurado en otra máquina obliga a volver a iniciar sesión y a vincular de nuevo.
- Las bases SQLite se copian en caliente (con `-wal`/`-shm`), así que la copia puede no ser consistente. Lo crítico (JSON de configuración y pairing) sí se copia bien.
