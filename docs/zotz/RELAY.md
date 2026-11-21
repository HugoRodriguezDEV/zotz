# Relay de webhooks del tablero (`zotz-relay`)

Spec: [`TASKS-SPEC.md` §8](./TASKS-SPEC.md#8-relay-propio-webhooks). Código del servicio: repo aparte `zotz-relay`.

El relay es **opcional y viene apagado**. Sin él, el tablero consulta GitHub cada 5 minutos mientras está abierto. Con él, cada cambio en GitHub llega en segundos y la consulta completa baja a cada 30 minutos.

## Cómo funciona

```
GitHub ──webhook firmado──▶ zotz-relay (Vercel + Upstash Redis) ◀──HTTPS saliente── Zotz
Proveedor zotz-tasks/v1 ──POST /v1/sources/<id>/push──▲
```

- Una **GitHub App** manda al relay los eventos `issues`, `pull_request`, `push`, `projects_v2_item` (solo Projects de organización, en _public preview_) e `installation`.
- El relay verifica `X-Hub-Signature-256` y guarda **solo el aviso**: `{ cursor, installationId, owner, repo, kind, number?, projectNodeId?, projectItemNodeId?, action, at }`. No guarda títulos, cuerpos, commits ni nombres de rama. Los avisos duran 7 días.
- Zotz pregunta con `GET /v1/events?cursor=…&wait=25` (long-poll) **solo mientras el tablero está abierto**. Con el tablero cerrado hace una consulta corta cada 10 minutos, solo para recoger documentos de proveedores. Con cada aviso relee de GitHub, con tus credenciales, solo lo afectado:

| Aviso              | Qué relee Zotz                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `issues`           | El repo suelto y los Projects que tienen ese issue, y su sección Development.                 |
| `pull_request`     | Lo anterior para el PR, más Development de los issues de ese repo y los PRs de los servicios. |
| `push`             | Development de los issues de ese repo (ramas, commits de PRs) y los PRs de los servicios.     |
| `projects_v2_item` | Ese Project.                                                                                  |
| `installation`     | Todo el tablero.                                                                              |

- Si el relay deja de responder, el tablero vuelve solo a consultar cada 5 minutos y la barra muestra "Relay caído".
- **Proveedores externos:** mandan su documento `zotz-tasks/v1` a `POST /v1/sources/<sourceId>/push` con su token. El relay guarda el último de cada fuente 24 h. Zotz lo importa igual que `zotz tasks push` y lo confirma con `DELETE`, y entonces se borra. El `source.id` del documento debe ser el mismo `sourceId` de la URL; si no, Zotz lo descarta.

### Límites conocidos

- En **Projects personales** GitHub no emite `projects_v2_item`. Mover una tarjeta de columna en un Project personal se ve con la consulta cada 30 minutos; issues, PRs y pushes sí llegan al momento.
- Un documento de proveedor lo recoge **el primer** dispositivo que lo confirma. Si usas el relay en dos máquinas, el servicio externo debe seguir publicando su feed por URL para la otra.
- Los avisos que llegan con el tablero cerrado no se aplican uno por uno: al abrirlo, el tablero hace su carga completa de siempre.

## Costos (plan gratis)

- **Upstash Redis** (vía Vercel Marketplace; Vercel KV ya no existe): el plan gratis da 500,000 comandos al mes. Un long-poll vacío cuesta 1 comando cada 3 s; un webhook, unos 5. Con el tablero abierto 3 h al día son unos 110,000 comandos al mes, más ~13,000 de la consulta cada 10 min con el tablero cerrado.
- **Vercel Hobby:** cada long-poll dura hasta 25 s. Si tu plan corta antes, baja `ZOTZ_RELAY_MAX_WAIT_SECONDS`.
- Puedes subir `ZOTZ_RELAY_POLL_INTERVAL_MS` (hasta 10,000) para gastar menos comandos a cambio de unos segundos de retraso.

## Puesta en marcha

### 1. Tokens

En el repo `zotz-relay`:

```bash
npm install
npm run token mac           # uno por máquina con Zotz
npm run token msi
npm run token acme-helpdesk # uno por proveedor zotz-tasks/v1 (el nombre es su source.id)
openssl rand -hex 32        # secreto del webhook de la GitHub App
```

Cada `npm run token` imprime el **token** (va a Zotz o al proveedor) y la línea **env** (`nombre:sha256…`, va a Vercel). El relay solo guarda hashes.

### 2. Desplegar en Vercel

1. Sube `zotz-relay` a un repo **privado** de GitHub e impórtalo en Vercel (_Add New → Project_, preset **Other**).
2. En el proyecto, _Storage → Marketplace → Upstash for Redis_ (plan gratis) y conéctalo al proyecto. Vercel agrega `KV_REST_API_URL`/`KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_*`); el relay acepta ambos.
3. _Settings → Environment Variables_ (Production):

| Variable                    | Valor                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET`     | El secreto del paso 1. Si haces una App por org, todos sus secretos separados por coma. |
| `ZOTZ_RELAY_DEVICE_TOKENS`  | Las líneas `env` de las máquinas, separadas por coma: `mac:ab12…,msi:cd34…`.            |
| `ZOTZ_RELAY_SOURCE_TOKENS`  | Las de los proveedores: `acme-helpdesk:ef56…`. Vacío si no hay.                         |
| `ZOTZ_RELAY_ALLOWED_OWNERS` | Solo si la App es pública: tus logins y orgs, `hugo,acme`. Lo demás se descarta.        |

4. Despliega. Comprueba que `https://<tu-relay>.vercel.app/` responde `{"ok":true,"service":"zotz-relay"}`. La URL de producción no lleva la protección de Vercel de los previews; si activaste _Deployment Protection_ para producción, el webhook de GitHub recibirá 401.

### 3. Crear la GitHub App

GitHub → _Settings → Developer settings → GitHub Apps → New GitHub App_.

- **Nombre:** `Zotz Relay (<tu usuario>)` (debe ser único en GitHub).
- **Homepage URL:** la URL del relay.
- **Webhook:** activo. **URL:** `https://<tu-relay>.vercel.app/github/webhook`. **Secret:** el del paso 1.
- **Permisos de repositorio (todos _Read-only_):** Metadata (obligatorio), Issues, Pull requests, Contents.
- **Permisos de organización:** Projects → _Read-only_ (solo sirve en orgs).
- **Eventos:** Issues, Pull request, Push y Projects v2 item. `installation` llega siempre, sin marcarlo.
- **¿Dónde se puede instalar?** _Only on this account_.
- No hace falta generar una llave privada: la App solo manda webhooks, Zotz nunca la usa para leer la API.

**Organizaciones:** una App privada solo se puede instalar en la cuenta que la creó. Tienes dos opciones:

- **(Recomendada) Una App privada por organización:** créala desde _la org → Settings → Developer settings → GitHub Apps_ con los mismos datos y su propio secreto, y agrega ese secreto a `GITHUB_WEBHOOK_SECRET` separado por coma. Necesitas ser owner de la org.
- **Una sola App pública** (_Any account_): se instala en tu cuenta y en las orgs. Cualquiera podría instalarla, así que pon `ZOTZ_RELAY_ALLOWED_OWNERS` para que el relay ignore a los demás.

### 4. Instalar la App

En la página de la App → _Install App_ → tu cuenta (y cada org) → _All repositories_ o solo los del tablero. GitHub manda un `ping` (el relay lo ignora) y un `installation` (el tablero se recarga completo).

Para revisar entregas: página de la App → _Advanced → Recent Deliveries_. Un `202` con `"stored":true` es un aviso guardado; `"stored":false` es un evento que Zotz no usa o de una cuenta no permitida; `401` es un secreto que no coincide.

### 5. Activarlo en Zotz

_Ajustes → Tareas → Relay para avisos al instante_: URL del relay y el token de esa máquina → **Conectar**. Zotz prueba el token antes de guardar; el token se cifra con el llavero del sistema (`zotz-task-relay-secrets.json`, modo 600) y nunca entra a settings. El interruptor lo apaga sin borrar nada; el bote de basura borra URL y token.

En la barra del tablero aparece "En vivo" (relay respondiendo, consulta completa cada 30 min) o "Relay caído" (consulta cada 5 min).

### 6. Proveedores externos

Dale al proveedor la URL y su token:

```bash
curl -X POST https://<tu-relay>.vercel.app/v1/sources/acme-helpdesk/push \
  -H "Authorization: Bearer <token del proveedor>" \
  -H "Content-Type: application/json" \
  --data-binary @tareas.json
```

Acepta JSON, YAML o TOML (según `Content-Type`), hasta 2 MB. Zotz valida el contrato al recogerlo; el relay no lo lee.

## API

| Ruta                                          | Auth                 | Respuesta                                                                                |
| --------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `GET /`                                       | —                    | `{ ok, service, api }`                                                                   |
| `POST /github/webhook`                        | firma de GitHub      | `202 { stored }` · `401` firma inválida                                                  |
| `GET /v1/events?cursor=N&wait=S`              | token de dispositivo | `{ ok, reset, cursor, notices[] }`. `reset: true` = recarga todo y sigue desde `cursor`. |
| `POST /v1/sources/<id>/push`                  | token del proveedor  | `202 { documentId }`                                                                     |
| `GET /v1/sources/<id>/document`               | token de dispositivo | El documento, con `X-Zotz-Document-Id`; `404` si no hay.                                 |
| `DELETE /v1/sources/<id>/document?id=<docId>` | token de dispositivo | Lo borra si sigue siendo ese documento.                                                  |

El cursor es el número del último aviso visto. El relay pide `reset` si el dispositivo no manda cursor, si los avisos posteriores ya se borraron (más de 7 días) o si el almacenamiento se vació (cursor mayor que el último).

## Desarrollo local

```bash
GITHUB_WEBHOOK_SECRET=dev ZOTZ_RELAY_DEVICE_TOKENS=<hash> npm run dev   # http://localhost:8787, memoria
npm test                                                                # firma y cursores
```
