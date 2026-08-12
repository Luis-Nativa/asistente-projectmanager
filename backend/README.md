# Backend

## Variables de entorno

Crea un archivo `.env` en la raíz del backend:

```bash
DATABASE_URL=postgresql://...?sslmode=require
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
GEMINI_API_KEY=...
PIN_SALT_ROUNDS=12
JWT_SECRET=...
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=...
REFRESH_TOKEN_EXPIRES_IN=30d
CRON_SECRET=...
TZ=America/Mexico_City
FLY_APP_NAME=pendientes-telegram
```

## Comandos

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build
npm run build

# Producción
npm start

# Migración
npm run migrate

# Tests
npm test
```

## Estructura

```
backend/
├── src/
│   ├── index.ts          # Entry point
│   ├── routes/           # Rutas de API
│   ├── services/         # Lógica de negocio
│   ├── prompts/          # Prompts para Gemini
│   └── middleware/       # Middleware de Express
├── migrations/           # Migraciones SQL
├── scripts/              # Scripts de utilidad
└── tests/                # Tests
```
