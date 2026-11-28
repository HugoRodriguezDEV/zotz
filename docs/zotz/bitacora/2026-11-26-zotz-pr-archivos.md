# Archivos cambiados del PR dentro de Zotz (`zotz-pr-archivos`)

2026-11-26

- **Problema:** para revisar el diff de un PR había que abrirlo en Chrome.
- El panel del PR (pestaña Checks) suma el botón **Archivos cambiados**. Abre la página de PR que ya trae upstream (árbol de archivos, diff unificado o lado a lado, "Viewed", comentarios en línea) directo en esa pestaña, con `openTaskPage({ openGitHubInitialTab: 'files' })`. Solo GitHub.
- Verificado en una instancia dev por CDP con el PR #47 de avena-argos: el botón abre la página y carga los 9 archivos (capturas en `capturas/pr-archivos/`).
