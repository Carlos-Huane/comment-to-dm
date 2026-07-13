# comment-to-dm

Bot que detecta comentarios con una palabra clave en publicaciones de Instagram y responde con un DM automático con un link. Alternativa propia a ManyChat, usando la **Instagram Graph API directa** desplegada como funciones serverless en **Vercel** (free tier).

## Por qué

- "Comenta LINK y te llega un DM con el recurso" es el patrón de growth más usado por creadores en 2026.
- ManyChat cobra desde $15/mes. Esta implementación corre gratis en Vercel Hobby + Graph API con creds propias.
- El demo ES el producto: el reel del MVP demuestra el sistema usando ese mismo sistema en tiempo real.

## Arquitectura

```
Instagram (comentario en post)
       ↓ Meta webhook POST
[ Vercel serverless: /api/webhook ]
       ↓ detecta keyword
[ Instagram Graph API: Private Reply ]
       ↓
DM al autor del comentario con link
```

## Stack

- **Node 20** con ESM
- **Vercel serverless functions** (auto-detectadas en `api/`)
- **Instagram Graph API v23+** (endpoint `graph.instagram.com`)
- Hosting: **Vercel Hobby** (100 GB-h/mes, más que suficiente para este workload)

## Estructura

```
comment-to-dm/
├── package.json
├── .env.example              ← template público
├── .env                      ← creds reales (gitignored)
├── README.md
├── CLAUDE.md                 ← contexto para asistentes IA
├── api/                      ← funciones serverless, Vercel las expone en /api/*
│   ├── index.js              → GET /api/           (status)
│   ├── health.js             → GET /api/health     (sanity check con Graph API)
│   ├── webhook.js            → GET+POST /api/webhook (verify + eventos)
│   └── list-recent-posts.js  → GET /api/list-recent-posts?secret=XXX (helper admin)
├── lib/                      ← helpers importados por los handlers
│   ├── env.js                (valida env vars, expone renderDmMessage)
│   ├── instagram.js          (wrapper Graph API: sendPrivateReply, getAccountInfo, getRecentMedia)
│   └── post-links.js         (resuelve media_id → URL usando content/post-links.json)
├── content/
│   └── post-links.json       ← mapa media_id (post IG) → URL (source of truth para el bot)
└── public/
    └── index.html            (landing estática servida en /, evita 404 default)
```

## Cómo funciona la resolución de URL

El bot usa **una sola keyword global** (default `link`). La URL específica que manda depende de **en qué post se comentó**:

1. Meta envía el webhook con `media.id` (identificador del post/reel de IG)
2. El bot busca ese `media.id` en `content/post-links.json`
3. Si existe → manda la URL configurada para ese post
4. Si no existe → manda el `fallback.url` con un mensaje suave

**Formato de `content/post-links.json`**:

```json
{
  "posts": {
    "17984123456789": {
      "url": "https://hs-wiki.vercel.app/wiki/ia-herramientas/agentes-ia",
      "topic": "Agentes IA — carrusel #01",
      "message": "Opcional: template custom para este post con {username} y {url}"
    }
  },
  "fallback": {
    "url": "https://hs-wiki.vercel.app",
    "message": "Hey @{username}! Todavía no tengo link específico — explorá: {url}"
  }
}
```

**Placeholders del template**: `{username}` (autor del comment) y `{url}` (resuelta según el post).

## Setup local

```bash
cd PROYECTOS/comment-to-dm
cp .env.example .env
# rellenar .env con creds reales (ver sección Seguridad)

npm install
npm install -g vercel   # una vez, la CLI global
npm run dev             # equivale a `vercel dev`, corre las functions en localhost
```

Health check local: `curl http://localhost:3000/api/health` — debe devolver `ok: true` + info de la cuenta IG.

## Deploy a Vercel

Primera vez:

```bash
npm install -g vercel
vercel login            # con tu cuenta de GitHub
vercel                  # crea el proyecto, preview URL
```

Setear env vars en el dashboard (Project → Settings → Environment Variables) con los mismos nombres que están en `.env.example`. Aplicar a `Production` y `Preview`.

Deploys siguientes:

```bash
npm run deploy          # equivale a `vercel --prod`
```

O bien conectar el repo a Vercel: cada `git push` al branch principal dispara deploy automático (mismo patrón que hs-wiki).

## Seguridad

**Reglas absolutas:**

1. **`.env` nunca se commitea.** Está en `.gitignore`. Si por error lo agregas, **rotar el token de Meta antes de push**.
2. El **access token de Instagram** (`IG_ACCESS_TOKEN`) tiene poder total sobre la cuenta — leer DMs, postear, etc. Tratarlo como password.
3. El **App Secret** (`IG_APP_SECRET`) verifica la firma HMAC SHA256 de cada POST de Meta. Sin esto, cualquiera con la URL del webhook puede dispararlo. **Configurar antes de exponer el endpoint a internet.**
4. El **Webhook Verify Token** es un string random que tú defines. Generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y guardarlo en `.env` + Meta Dev Console (mismo valor en los dos lados).
5. Rate limit de Meta: **200 DMs/hora por cuenta**. Excederlo congela el bot.
6. **Ventana de 7 días** para Private Reply: solo se puede responder a comentarios dentro de los 7 días siguientes a su publicación.

## Endpoints

Todos bajo la URL de Vercel: `https://<tu-deploy>.vercel.app`.

| Método | Path | Función |
|---|---|---|
| GET | `/api` | Status básico (público, JSON) |
| GET | `/api/health` | Sanity check con llamada real a Graph API |
| GET | `/api/webhook` | Handshake de verificación de Meta (devuelve `hub.challenge`) |
| POST | `/api/webhook` | Recibe eventos de comentarios, dispara DMs |

## Configurar el webhook en Meta

1. Ir a [developers.facebook.com](https://developers.facebook.com) → tu app → Webhooks
2. Producto: **Instagram**
3. Callback URL: `https://<tu-deploy>.vercel.app/api/webhook`
4. Verify Token: el valor de `WEBHOOK_VERIFY_TOKEN` de tu `.env` / Vercel env
5. Suscribirse al campo: **`comments`**
6. Meta hace un GET al endpoint con el verify token → tu función devuelve el `hub.challenge`

## Roadmap

- **Fase 1** (este repo, deploy Vercel) — uso propio: webhook + detección + DM. No requiere App Review.
- **Fase 2** (futuro) — SaaS multi-tenant: dashboard, pagos, soporte LATAM. Requiere App Review de Meta.

---

## Fork this — setup para tu propia cuenta

Este repo es una **plantilla**. Ninguna de las credenciales de nadie está commiteada; todo vive en `.env` (gitignored) y env vars de Vercel. Para hacer que corra sobre TU cuenta de Instagram, seguí estos pasos.

### 0. Requisitos

- Cuenta de Instagram **Business** o **Creator** (no funciona con personal)
- Cuenta de developer en [developers.facebook.com](https://developers.facebook.com) (gratis)
- Cuenta gratuita en [Vercel](https://vercel.com) (login con GitHub recomendado)
- Node.js 20+ y `npm` instalados localmente

### 1. Fork y clone

```bash
# En GitHub: click en "Fork" arriba a la derecha
git clone https://github.com/TU_USUARIO/comment-to-dm.git
cd comment-to-dm
npm install
```

### 2. Crear una app en Meta Dev Console

1. Ir a https://developers.facebook.com/apps/ → **Create App**
2. Tipo: **Business**
3. Nombre: el que quieras (ej. `mi-comment-to-dm`)
4. Una vez creada, en el dashboard buscar el caso de uso **"Administrar mensajes y comentarios en Instagram"** y agregarlo
5. Ir a la sección de configuración de ese caso de uso → **Configuración de la API con Instagram Login**

### 3. Obtener credenciales

Dentro de "Configuración de la API con Instagram Login" vas a completar 4 sub-secciones:

**Sub-sección "Nombre de la app"**: anotá el **App Secret** (botón "Mostrar") → va a `IG_APP_SECRET`

**Sub-sección "Permisos"**: agregá y activá estos 4:
- `instagram_business_basic`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`
- `instagram_business_content_publish`

**Sub-sección "Generar tokens de acceso"**:
1. Click en "Agregar cuenta" → autorizás tu cuenta Instagram Business/Creator
2. Una vez aparece la cuenta, click en "Generar token" → Meta te devuelve un long-lived token (60 días)
3. Copiar ese token → va a `IG_ACCESS_TOKEN`
4. Anotar también el ID numérico que aparece bajo el username → va a `IG_USER_ID`

**Sub-sección "Configurar webhooks"** (después del deploy, paso 5).

### 4. Crear tu `.env` local

```bash
cp .env.example .env
```

Editar `.env` con:

```
IG_USER_ID=<el ID numérico de tu cuenta>
IG_ACCESS_TOKEN=<long-lived token de 60 días>
IG_APP_SECRET=<app secret>
WEBHOOK_VERIFY_TOKEN=<generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
KEYWORD=<la palabra que dispara el DM, ej. "link">
DM_URL=<la URL que querés mandar en el DM>
DM_MESSAGE_TEMPLATE=Hey! Acá tienes lo que pediste: {url}
```

Verificar que funciona:

```bash
node -e "import('./lib/instagram.js').then(async m => console.log(await m.getAccountInfo()))"
```

Debe imprimir tu username y user_id. Si dice "Session has expired" → volvé al paso 3 y regenerá el token.

### 5. Deploy a Vercel

```bash
npm install -g vercel
vercel login
vercel deploy --yes         # primer deploy, te da una URL de preview
```

Sincronizar env vars al proyecto Vercel (script bash):

```bash
cat .env | grep -v '^#' | grep -v '^$' | while IFS='=' read -r key val; do
  printf "%s" "$val" | vercel env add "$key" production --force
done
```

Deploy final a producción:

```bash
vercel deploy --prod --yes
```

Vercel te asigna una URL tipo `https://<tu-proyecto>.vercel.app`.

Verificar en browser: `https://<tu-proyecto>.vercel.app/api/health` — debe devolver `{"ok":true,...}` con tu username.

### 6. Configurar el webhook en Meta

Volvés a "Configuración de la API con Instagram Login" → sección **"Configurar webhooks"**:

- **URL de devolución de llamada**: `https://<tu-proyecto>.vercel.app/api/webhook`
- **Token de verificación**: el mismo valor de `WEBHOOK_VERIFY_TOKEN` de tu `.env`

Click **Verificar y guardar**. Meta hace un GET al endpoint → tu función devuelve el `hub.challenge` → Meta confirma OK.

Después de verificar, en la misma página marcá el campo **`comments`** en la lista de suscripciones.

Volvés a la sección "Generar tokens de acceso" → en la fila de tu cuenta, activá el toggle **"Suscripción al webhook"**.

### 7. Probar end-to-end

1. Publicá un post o reel en tu cuenta con caption tipo: *"Comenta LINK y te mando el recurso"*
2. Desde otra cuenta (o pedile a un amigo), comentá `link` en ese post
3. En segundos deberías recibir un DM con el mensaje configurado

Si falla, verificá logs en `vercel logs <tu-proyecto>` — cualquier error de Graph API aparece ahí.

### 8. Configurar links por post

Cuando publicás un post nuevo en IG:

1. Obtené el `media_id` — 2 formas:
   - **Vía endpoint helper** (recomendado): `curl "https://<tu-proyecto>.vercel.app/api/list-recent-posts?secret=$ADMIN_SECRET"` — devuelve tus últimos 25 posts con id, permalink, caption preview y flag `mapped`
   - **Vía Graph API Explorer**: query `me/media?fields=id,caption,permalink`
2. Editá `content/post-links.json`, agregá una entrada con la URL específica para ese post
3. `git commit && git push` → Vercel auto-deploya en ~1 min
4. Ya podés publicar el post con caption *"comenta LINK y te mando el paso a paso"*

Cuando alguien comente `link` en ese post, el bot busca `media.id` en el JSON y manda la URL correcta.

### 9. Mantenimiento

- **Cada 60 días** el `IG_ACCESS_TOKEN` expira → volvés al paso 3 → regenerás → actualizás `.env` local + `vercel env` de producción → `vercel --prod`
- Ver `CLAUDE.md` para workflows automatizables (auto-refresh via cron job) y otros patrones

## Contribuir

- PRs bienvenidos si mantienen el ADN: código directo, verificable, sin dependencias inventadas
- Antes de proponer cambios grandes, abrir un issue para discutir
- Leer `CLAUDE.md` — resume las reglas duras (raw body, HMAC, no committear `.env`)

## Licencia

MIT. Usalo, cambialo, cobralo. Solo no eches la culpa a nadie si algo explota.
