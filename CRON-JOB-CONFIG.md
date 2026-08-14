# Configuración de Cron-Job.org para Recordatorios

## Paso 1: Crear cuenta en cron-job.org

1. Ve a https://console.cron-job.org/
2. Crea una cuenta gratuita
3. Verifica tu email

## Paso 2: Crear nuevo job

1. Click en "Create Cronjob"
2. Configura los siguientes campos:

### Configuración del Job

**Título:**
```
Pendientes Telegram - Tick cada 5 minutos
```

**URL:**
```
https://pendientes-telegram-backend.onrender.com/internal/tick
```

**Método HTTP:**
```
POST
```

**Headers personalizados:**
```
X-Cron-Secret: a1d10ca2abe6c920a2342349a9dcacef3d98cec349291f9a5f218c6057c5527f
Content-Type: application/json
```

**Schedule (Cron Expression):**
```
*/5 * * * *
```
(Esto significa: cada 5 minutos)

**Timezone:**
```
America/Mexico_City
```

**Enabled:** ✅ Marcado

## Paso 3: Probar el job

1. Click en "Execute now" para probar manualmente
2. Verifica en los logs de Render que aparezca:
   ```
   ⏰ Ejecutando tick de cron...
   ✅ Tick completado: X recordatorios, briefing=false, cierre=false
   ```

## Paso 4: Verificar funcionamiento

### Probar recordatorios

1. Crea una tarea con `remind_at` en el futuro cercano:
   ```sql
   INSERT INTO tasks (title, remind_at, status)
   VALUES ('Probar recordatorio', now() + interval '6 minutes', 'pendiente');
   ```

2. Espera 6 minutos
3. Verifica que llegue el mensaje por Telegram

### Probar briefing matutino

El briefing se envía automáticamente a las 7:00 AM. Para probarlo manualmente:

```sql
-- Temporalmente cambiar la hora del servidor o modificar el código
-- para probar fuera del horario
```

### Probar cierre nocturno

El cierre se envía automáticamente a las 21:00. Similar al briefing.

## Paso 5: Monitoreo

1. Ve a la pestaña "Executions" en cron-job.org
2. Verifica que todas las ejecuciones sean exitosas (status 200)
3. Si hay errores, revisa los logs en Render

## Troubleshooting

### Error 403 Forbidden
- Verifica que el header `X-Cron-Secret` sea correcto
- Verifica que el valor en cron-job.org coincida con el de Render

### Error 500 Internal Server Error
- Revisa los logs en Render
- Verifica que la base de datos esté accesible
- Verifica que TELEGRAM_BOT_TOKEN sea válido

### No se envían recordatorios
- Verifica que la tarea tenga `remind_at` establecido
- Verifica que `reminded_at` sea NULL
- Verifica que `status` sea 'pendiente' o 'en_proceso'
- Verifica que `confirmed` sea true

### Briefing/cierre no se envían
- Verifica la hora del servidor (debe estar en America/Mexico_City)
- Verifica que no se haya enviado ya hoy (revisa system_flags)
- Revisa los logs en Render

## Costo

Cron-job.org es **gratis** para uso básico:
- Hasta 5 jobs
- Intervalo mínimo de 1 minuto
- Historial de ejecuciones de 7 días

Para este proyecto, el plan gratuito es suficiente.

## Alternativas

Si prefieres no usar cron-job.org, puedes usar:

1. **Render Cron Jobs** (si usas Render paid plan)
2. **AWS EventBridge + Lambda** (gratis hasta 1M requests/mes)
3. **GitHub Actions** (gratis hasta 2,000 minutos/mes)
4. **EasyCron** (gratis hasta 100 ejecuciones/día)

Pero cron-job.org es la opción más simple y gratuita.
