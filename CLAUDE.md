# CLAUDE.md — contexto para asistentes IA

Si vos sos un asistente IA (Claude Code, Cursor, Copilot Chat, etc.) trabajando en este repo, leé esto antes de proponer cambios.

## Qué es este proyecto

Bot serverless que detecta comentarios con una palabra clave en publicaciones de Instagram Business/Creator y responde automáticamente con un DM que contiene un link.

Alternativa self-hosted y gratuita a **ManyChat**. Basado en la **Instagram Graph API con Instagram Login** (endpoint `graph.instagram.com`, NO el viejo Basic Display API deprecado en Dec 2024).

## Stack real

- **Runtime**: Node.js 24.x
- **Deploy**: Vercel Hobby (serverless functions en `/api/`)
- **API**: Instagram Graph API v23+ (`graph.instagram.com`)
- **Sin base de datos** (stateless por diseño — cada evento es independiente)
- **Sin framework** (nada de Express/Fastify — handlers Vercel puros)

## Estructura

```
api/
  index.js               → GET /api        (status, sin llamada a Meta)
  health.js              → GET /api/health (sanity check con llamada real a Meta)
  webhook.js             → GET/POST /api/webhook (verify + eventos comments)
  list-recent-posts.js   → GET /api/list-recent-posts?secret=XXX (admin helper)
lib/
  env.js         (valida env vars al import time; skip dotenv en Vercel; expone renderDmMessage)
  instagram.js   (wrapper Graph API: sendPrivateReply, getAccountInfo, getRecentMedia)
  post-links.js  (resuelve media_id → URL usando content/post-links.json)
content/
  post-links.json  (mapa media_id → URL, editable + versionado en git)
public/
  index.html     (landing estática servida en /)
```

## Modelo de resolución de URL

**Una sola keyword global** (default `link`). La URL específica depende del **post donde se comentó** — Meta manda `value.media.id` en cada webhook, el bot usa ese id para buscar en `content/post-links.json`.

Formato del JSON:
```json
{
  "posts": {
    "<media_id>": { "url": "...", "topic": "...", "message": "opcional custom" }
  },
  "fallback": { "url": "...", "message": "cuando no hay match" }
}
```

Placeholders del template: `{username}` (autor del comment) y `{url}` (resuelta). El template se toma de (en orden): `posts[id].message` → `env.bot.dmTemplate` → nunca hardcodeado.

## Reglas duras

1. **El `.env` NUNCA se commitea**. Está en `.gitignore`. Si un usuario tuyo lo agrega por error, PARÁ TODO y decíselo — la solución es rotar el `IG_ACCESS_TOKEN` en Meta Dev Console antes de cualquier push.

2. **`api/webhook.js` debe leer raw body**. La firma HMAC SHA256 que Meta manda en `X-Hub-Signature-256` se calcula sobre el body crudo. Por eso `export const config = { api: { bodyParser: false } }` está en ese archivo. NO agregar body parsing automático ahí.

3. **Timing-safe comparison** en `verifySignature`. Usar `node:crypto.timingSafeEqual`, nunca `===` sobre strings.

4. **En producción `IG_APP_SECRET` es obligatorio**. Sin él, cualquiera con la URL del webhook puede dispararlo. El código lo hace opcional para desarrollo local, pero es warning grave.

5. **Response 200 a Meta aún en errores lógicos**. Si mandás 4xx/5xx, Meta reintenta indefinidamente. Solo devolver 400 en body no-JSON, 403 en handshake fallido, 405 en método no soportado.

## Constraints de Meta que hay que respetar

- **Rate limit**: 200 DMs/hora por cuenta. Superarlo congela el bot.
- **Ventana de 7 días**: Private Reply solo funciona sobre comentarios de los últimos 7 días.
- **Long-lived token**: dura 60 días. Se refresca desde Meta Dev Console → API con Instagram Login → sección "Generar tokens de acceso" → botón "Generar token" en la fila de la cuenta. O programáticamente con `GET /refresh_access_token?grant_type=ig_refresh_token&access_token={current}`.
- **Cuenta debe ser profesional**: Business o Creator. Cuentas personales no soportan la Messages API.

## Flujo end-to-end (para entender antes de cambiar)

```
1. Usuario X comenta "link" en post de la cuenta configurada
2. Meta hace POST /api/webhook con body JSON firmado (HMAC)
3. api/webhook.js:
   a. readRawBody(req)
   b. verifySignature(req, rawBody) contra IG_APP_SECRET
   c. JSON.parse(rawBody)
   d. Filtrar entry.changes[].field === "comments"
   e. Para cada comment: chequear keyword, filtrar auto-comment
   f. sendPrivateReply(commentId, message) → Graph API
   g. Responder 200 a Meta
4. Meta envía DM al autor del comentario
```

## Workflows comunes

### Agregar un post nuevo al mapping

1. Publicar el post/reel en IG
2. `curl "https://<deploy>.vercel.app/api/list-recent-posts?secret=$ADMIN_SECRET"` → devuelve últimos 25 posts con `id` y flag `mapped`
3. Copiar el `id` del post nuevo → agregar entrada en `content/post-links.json`:
   ```json
   "17984123456789": {
     "url": "https://mi-destino.com/algo",
     "topic": "descripción interna"
   }
   ```
4. `git commit && git push` → Vercel auto-deploya

### Personalizar mensaje solo para un post específico

Agregar `"message": "Template custom con {username} y {url}"` a la entrada del post en `content/post-links.json`. Sobreescribe el default de `env.bot.dmTemplate`.

### Agregar una nueva keyword variant

Actualmente `KEYWORD` es un solo string global. Si el usuario pide "detectar varias palabras" (link, quiero, dame), refactor `env.js` para lista separada por coma y `handleCommentEvent` haga `.some()`. Cuestionar primero: ¿realmente necesita varias keywords, o basta con la URL-por-post que ya tenemos?

### Agregar autorefresh del token

En vez de que el usuario refresque manual cada 60 días, agregar cron job Vercel (`vercel.json` con `crons`) que llame `graph.instagram.com/refresh_access_token` cada 30 días. Requiere endpoint interno `/api/cron/refresh-token` con auth por header `Authorization: Bearer <CRON_SECRET>`.

### Deploy

```bash
vercel deploy --prod --yes   # solo cambios de código
```

Env vars se editan en Vercel dashboard (Project → Settings → Environment Variables) o via CLI:

```bash
printf "nuevo-valor" | vercel env add NOMBRE_VAR production --force
```

Nunca hardcodear valores nuevos en el código.

### Testing local

```bash
npm install
vercel dev   # levanta las functions en localhost:3000
```

Para probar el webhook sin exponer a internet: usar `ngrok http 3000` o `cloudflared tunnel` y configurar la URL temporal en Meta Dev Console.

## Antipatrones a rechazar si el usuario los pide

- **"Agregar Express"** → NO. El punto de la migración fue eliminarlo. Los handlers Vercel son suficientes.
- **"Guardar comentarios en base de datos"** → si el user pide esto, cuestionar por qué. El sistema es stateless a propósito. Si realmente hace falta persistencia (analytics, dedup), sugerir Vercel KV o Supabase, y aislarlo en `lib/storage.js`.
- **"Hardcodear el token en config para testing"** → NO. Aún en dev, usar `.env`.
- **"Commit .env porque es solo local"** → NO. NUNCA. Ver regla dura #1.
- **"Bypassear HMAC porque es más simple"** → NO en producción. Solo aceptable si `IG_APP_SECRET` está vacío en dev.

## Referencias oficiales

- Instagram API con Instagram Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
- Webhooks Instagram: https://developers.facebook.com/docs/instagram-platform/webhooks
- Private Replies: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
- Vercel Functions: https://vercel.com/docs/functions
- Vercel env vars CLI: https://vercel.com/docs/cli/env

## Author intent

El repo lo mantiene [@carloshuane](https://instagram.com/carloshuane) — desarrollador peruano documentando el "construir sus propias herramientas con IA" como parte de su marca personal. Cualquier PR o fork debe respetar ese ADN: **directo, técnico, sin humo, código real y verificable**. Nada de dependencias inventadas, nada de features "por si acaso", nada de complejidad para vender complejidad.
