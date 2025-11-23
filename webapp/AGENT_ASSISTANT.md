# Agent Assistant Integration

El Agent Assistant ahora está integrado en la webapp y se activa automáticamente cuando el usuario ejecuta una tarea desde la interfaz.

## Cómo Funciona

### Flujo de Ejecución

1. **Usuario escribe un comando** en la interfaz web
2. **Parse del intent** - La webapp parsea el comando del usuario
3. **Descubrimiento de máquinas** - Se buscan máquinas disponibles
4. **Descubrimiento de capacidades** - Se obtienen las capacidades de la máquina
5. **Búsqueda de dispositivo** - Se encuentra el dispositivo correspondiente
6. **Ejecución vía Agent Assistant API** - Se llama a `/api/agent/execute`
7. **Manejo de pago (si es necesario)** - Si se requiere pago, se muestra al usuario
8. **Confirmación y ejecución** - El usuario aprueba el pago y se ejecuta la acción

### API Route: `/api/agent/execute`

Esta ruta encapsula toda la lógica del Agent Assistant:

- **Endpoint**: `POST /api/agent/execute`
- **Body**:
  ```json
  {
    "machineUrl": "http://localhost:8000",
    "capability": {
      "id": "unlock_device",
      "endpoint": "/v1/devices/{device_id}/unlock",
      "method": "POST",
      "description": "Unlock a device"
    },
    "params": {
      "device_id": "smart-lock-01"
    },
    "txHash": "0x..." // Opcional, para retry después del pago
  }
  ```

- **Respuestas**:
  - `200 OK`: Acción completada exitosamente
  - `402 Payment Required`: Se requiere pago (incluye detalles de pago)
  - `500 Error`: Error en la ejecución

### Ventajas de la Integración

✅ **No requiere terminales separadas** - Todo funciona desde la webapp  
✅ **Activación por interacción del usuario** - Se ejecuta cuando el usuario lo necesita  
✅ **Misma lógica del agent-assistant** - Mantiene toda la funcionalidad original  
✅ **Logging integrado** - Todos los logs aparecen en la consola del servidor Next.js  
✅ **Manejo de errores mejorado** - Errores más descriptivos y logging detallado  

## Configuración

Las variables de entorno se configuran en `.env.local`:

```env
NEXT_PUBLIC_MACHINE_API_URL=http://localhost:8000
MAX_AUTO_PAY_AMOUNT=0.05
```

## Uso

Simplemente ejecuta la webapp:

```bash
cd webapp
npm run dev
```

Y el Agent Assistant se activará automáticamente cuando el usuario ejecute una tarea desde la interfaz.

