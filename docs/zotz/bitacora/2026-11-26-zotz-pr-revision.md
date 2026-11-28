# Revisar, aprobar y pasar a draft desde Zotz (`zotz-pr-revision`)

2026-11-26

- **Página del PR:** botón **Review** en la barra de Files changed, junto a "Side by Side", como el "Review changes" de GitHub: comentario y Comentar / Aprobar / Pedir cambios, más **Pasar a draft** o **Listo para revisión**. Merge y cerrar ya existían en upstream.
- **Panel del PR (lateral):** la misma caja de revisión y **Pasar a draft** para PRs abiertos; "Listo para revisión" de los drafts ya lo traía upstream.
- **Backend:** `gh pr review` en `src/main/zotz/github/zotz-pr-review.ts`; IPC `gh:submitPRReview` y `gh:markPRDraft` (upstream solo tenía draft por RPC) en `zotz-pr-review-ipc.ts`; RPC `github.submitPRReview` para servidores emparejados y el cliente web.
- GitHub no deja aprobar ni pedir cambios en tu propio PR; Zotz lo dice en vez de mostrar el error de GraphQL.
- Verificado en una instancia dev por CDP con el PR #56: el botón Review abre la caja en Files changed y Aprobar llega a GitHub, que lo rechaza por ser propio, con el aviso claro (captura en `capturas/pr-revision/`). **Sin probar en vivo:** aprobar o pedir cambios en el PR de otra persona, pasar a draft (cambia un PR real) y el panel lateral, que no se pudo ligar a un PR abierto en el perfil de prueba.
