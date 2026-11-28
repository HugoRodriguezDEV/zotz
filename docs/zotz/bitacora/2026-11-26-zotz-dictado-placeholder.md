# La vista previa del dictado ya no se encima con el placeholder (`zotz-dictado-placeholder`)

2026-11-26

- Con el composer vacío, el texto gris del dictado se dibujaba encima de "Ask anything, @ to mention files, / for commands". Mientras se ve la vista previa, el campo destino lleva `data-zotz-dictating` y su placeholder (el `::before` de Tiptap, `::placeholder` de textarea/input) se oculta sin mover el cursor; al terminar vuelve.
- Verificado con la fixture `ZotzDictationLivePreview:emptyComposer` (mismas clases de placeholder que `NativeChatPromptEditor`): sin dictado se ve el placeholder, con dictado solo el texto.
