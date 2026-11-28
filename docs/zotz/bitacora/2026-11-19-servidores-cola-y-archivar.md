# Archivar conversaciones principales y cola de memoria por servidor (`zotz/servidores-cola-y-archivar`)

2026-11-19

- Spec: [`SPEC-servidores-cola-y-archivar.md`](../specs/SPEC-servidores-cola-y-archivar.md). Parte A en este PR; Parte B (cola de memoria de los servidores visible y controlable desde la laptop) en PRs siguientes.
- **Archivar la conversación principal de un proyecto** (por ejemplo `uni` en la MSI): el menú ofrecía Archive y Delete solo fuera del checkout principal, así que para esa fila no existían. Ahora Archive también aparece en principales; Delete sigue bloqueado. La sección Archivadas ya lista las principales, y se restauran desde ahí.
- `archiveZotzConversation` ignoraba el resultado de `updateWorktreeMeta` y avisaba "Conversation archived" aunque fallara. Ahora manda el host de la conversación y, si falla, muestra el error sin "Deshacer".
- Sin cambio en `useArchiveOnMerge`: una principal nunca se archiva sola al hacer merge.
- Sin verificar con la MSI real; se comprobó con la fixture `ZotzProjectSidebar:archivedMain`.
