# Mantener despierto el servicio en Render (free tier)
# Este script hace ping al health check cada 10 minutos

RENDER_URL="https://pendientes-telegram-backend.onrender.com"

while true; do
  curl -s "$RENDER_URL/health" > /dev/null
  echo "Keep-alive ping: $(date)"
  sleep 600
done
