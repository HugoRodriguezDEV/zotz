# Sin la pestaña de historial de sesiones (`zotz-quitar-historial`)

2026-11-26

- La pestaña **Agent Session History** (`vault`) del panel derecho se oculta: las conversaciones de la barra lateral ya cumplen ese papel. No se borra de upstream; se filtra en `use-right-sidebar-activity-items.ts`.
- Si algo pide abrirla (por ejemplo `showAiVaultSearch` desde Ajustes), el panel cae en el Explorador con el respaldo que ya trae upstream para pestañas ocultas. El diálogo de historial para reanudar sesiones desde el chat no cambia.
- Verificado en una instancia dev por CDP: la barra ya no muestra el ícono y `showAiVaultSearch` deja el panel en el Explorador (captura en `capturas/quitar-historial/`).
