# Fase 9, parte 2: relay de webhooks (`zotz-relay-webhooks`)

2026-11-20

- **Servicio `zotz-relay`** (repo aparte, Vercel + Upstash Redis):
  - Recibe los webhooks de una GitHub App, verifica `X-Hub-Signature-256` y guarda solo el aviso (qué repo, número o Project cambió), 7 días.
  - `GET /v1/events` con long-poll y token de dispositivo; `POST /v1/sources/<id>/push` para proveedores, con el documento 24 h o hasta que Zotz lo confirma.
  - Tests de la firma (con el ejemplo de la doc de GitHub) y de los cursores.
- **Zotz:**
  - _Ajustes → Tareas → Relay para avisos al instante_: URL + token cifrado; apagado por defecto.
  - Con el relay en vivo, cada aviso relee solo el Project, el repo o la sección Development afectada, y la consulta completa baja a cada 30 min. Si falla, vuelve a cada 5 min y la barra dice "Relay caído".
  - Los documentos de proveedores entran como `zotz tasks push`, solo si su `source.id` es el de la fuente autenticada.
- **Cambios de paso:**
  - El manejo de tokens cifrados salió de `ZotzTaskConnectorService` a `ZotzTaskSecretFile`, que ahora guarda uno a la vez.
  - La recarga del tablero es por fuente, así que releer un Project no cancela la carga de otro.
  - Development ya no relee todos los issues en cada cambio de la lista después del primer refresco automático; solo con "Actualizar" o con un aviso.
- **Sorpresas:**
  - Vercel KV ya no existe; su reemplazo es Upstash Redis desde el Marketplace (plan gratis de 500,000 comandos al mes).
  - Una GitHub App privada solo se instala en la cuenta que la creó. Para las orgs hace falta una App por org o una App pública con lista de cuentas permitidas.
  - Bug previo: el refresco cada 5 min dependía de una función que cambiaba en cada render, así que después del primer tick el tablero se refrescaba en cada render. Se arregló al mover el temporizador a `useZotzTaskRelay`.
- **Probado:**
  - El relay local (`npm run dev`) con curl: firma inválida rechazada, entrega repetida descartada, long-poll que responde al llegar el webhook, push → documento → confirmación.
  - `ZotzTaskRelayClient` contra ese relay: el aviso llegó al momento, el documento se importó y uno con otro `source.id` se descartó.
  - La sección de Ajustes con la fixture `zotz/tasks/ZotzTaskRelaySetting` (conectar, en vivo, caído), en ambos temas.
  - Sin desplegar ni probar con GitHub real: falta crear el repo, Vercel, Upstash y la GitHub App.
