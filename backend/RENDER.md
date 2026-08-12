# Render (Free Tier)

## Características del Free Tier

- **Se duerme después de 15 min** sin tráfico
- **Primer request tarda ~50s** en despertar
- **No tiene cron nativo** en free tier
- **Necesita keep-alive** externo

## Estrategia

### 1. Keep-Alive (mantener despierto)

Usamos **cron-job.org** (gratis) para hacer ping cada 10 minutos:

1. Ve a https://console.cron-job.org/
2. Crea una cuenta gratis
3. Crea un nuevo "Job":
   - **Name:** `pendientes-telegram-keepalive`
   - **URL:** `https://pendientes-telegram-backend.onrender.com/health`
   - **Schedule:** Every 10 minutes
   - **Method:** GET

### 2. Cron para Recordatorios

Usamos **cron-job.org** para llamar `/internal/tick` cada 5 minutos:

1. En cron-job.org, crea otro "Job":
   - **Name:** `pendientes-telegram-cron`
   - **URL:** `https://pendientes-telegram-backend.onrender.com/internal/tick`
   - **Schedule:** Every 5 minutes
   - **Method:** POST
   - **Headers:**
     ```
     X-Cron-Secret: <tu CRON_SECRET>
     ```

## Deploy

### Opción A: Desde GitHub (Recomendado)

1. Sube el código a GitHub
2. Ve a https://dashboard.render.com/
3. Click "New +" → "Web Service"
4. Conecta tu cuenta de GitHub
5. Selecciona el repo `pendientes-telegram`
6. Render detecta automáticamente `render.yaml`
7. Configura las variables de entorno (ver `.env.example`)
8. Click "Create Web Service"

### Opción B: Desde Docker Hub

Si prefieres no usar GitHub:

```bash
# Build y push a Docker Hub
docker build -t tu-usuario/pendientes-telegram:latest .
docker push tu-usuario/pendientes-telegram:latest

# En Render, usa "Existing Image" y apunta a tu imagen
```

## Variables de Entorno

En el dashboard de Render, configura:

```
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_CHAT_ID=123456789
TELEGRAM_WEBHOOK_SECRET=genera-un-string-aleatorio
GEMINI_API_KEY=AIzaSy...
JWT_SECRET=genera-un-string-aleatorio
REFRESH_TOKEN_SECRET=genera-un-string-aleatorio
CRON_SECRET=genera-un-string-aleatorio
```

## Limitaciones del Free Tier

- **512 MB RAM**
- **0.1 CPU**
- **Se duerme después de 15 min**
- **100 GB bandwidth/mes**
- **750 horas/mes** (suficiente para 1 servicio 24/7)

## Monitoreo

- **Health check:** https://pendientes-telegram-backend.onrender.com/health
- **Logs:** Dashboard de Render → "Logs"
- **Uptime:** cron-job.org muestra si los jobs están corriendo

## Costo

- **$0/mes** (free tier)
- Si necesitas más recursos, puedes hacer upgrade a "Starter" ($7/mes)
