# Plan: Actualizar modelo de Gemini

## Problema identificado

Los modelos de Gemini que se probaron están **deprecados** (shut down):
- ❌ gemini-2.0-flash-exp
- ❌ gemini-2.0-flash
- ❌ gemini-1.5-flash
- ❌ gemini-2.5-flash
- ❌ gemini-pro

Todos retornan error 404: "model is not found for API version v1beta"

## Solución

Actualizar el modelo a **`gemini-3.5-flash-lite`** que es el modelo lite más reciente de Gemini.

### Por qué gemini-3.5-flash-lite

Según la documentación oficial de Gemini:
- ✅ Es el modelo lite más reciente y estable
- ✅ Más rápido y económico de la familia 3.5
- ✅ Optimizado para tareas de alto throughput
- ✅ Perfecto para parsing de texto estructurado
- ✅ Costo significativamente menor que modelos completos
- ✅ Suficiente inteligencia para convertir mensajes a JSON

### Alternativas consideradas

- `gemini-3.6-flash` - Más inteligente pero más caro, innecesario para parsing simple
- `gemini-3.5-flash` - Similar, pero no es lite
- `gemini-3.1-flash-lite` - Más antiguo, usar 3.5-lite que es más reciente

## Pasos de implementación

### 1. Actualizar archivo `backend/src/services/gemini.ts`

Cambiar línea 47:
```typescript
// ANTES
model: 'gemini-pro',

// DESPUÉS
model: 'gemini-3.5-flash-lite',
```

### 2. Actualizar `.env.local` (local)

No requiere cambios, la API key actual funciona con todos los modelos.

### 3. Commit y push

```bash
git add backend/src/services/gemini.ts
git commit -m "Actualizar modelo a gemini-3.5-flash-lite (modelos anteriores deprecados)"
git push
```

### 4. Verificar deploy en Render

Render detectará el push automáticamente y hará deploy en 2-3 minutos.

### 5. Probar funcionalidad

Enviar mensaje de prueba al bot de Telegram:
- "mañana comprar cemento para la obra"
- "urgente llamar al banco antes del viernes"

Verificar que el parser responde correctamente con acciones estructuradas.

## Criterios de éxito

- ✅ El bot responde sin errores
- ✅ El parser genera acciones estructuradas (tareas, gastos, notas)
- ✅ Los logs de Render muestran "🤖 Parser generó X acciones"
- ✅ Las acciones se guardan correctamente en la base de datos Neon

## Rollback (si algo falla)

Si `gemini-3.5-flash-lite` no funciona, probar en este orden:
1. `gemini-3.1-flash-lite`
2. `gemini-3.6-flash`
3. `gemini-3.5-flash`

## Referencias

- Documentación de modelos: https://ai.google.dev/gemini-api/docs/models/gemini
- Deprecaciones: https://ai.google.dev/gemini-api/docs/deprecations
