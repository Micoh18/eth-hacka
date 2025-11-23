# 🤖 IoT Device Agent System - x402 Protocol

Sistema de agentes para controlar dispositivos IoT usando el protocolo **x402 Payment Required** sobre HTTP estándar.

## ⚡ Inicio Rápido

```bash
# Terminal 1: Iniciar API IoT
uvicorn main:app --reload --port 8000

# Terminal 2: Webapp (incluye Agent Assistant integrado)
cd webapp
npm install
npm run dev
```

El Agent Assistant ahora está **integrado en la webapp** y se activa automáticamente cuando el usuario ejecuta una tarea desde la interfaz. Ya no necesitas ejecutar el agent-assistant por separado.

> **Nota**: Si quieres usar el agent-assistant como script independiente (para pruebas), aún puedes hacerlo desde `agent-assistant/`.

## 🏗️ Arquitectura

```
┌─────────────────────┐         ┌──────────────────────┐
│  Agent Assistant   │  HTTP   │   IoT API (FastAPI) │
│     (Cliente)      │ ──────> │  (Agente Máquina)   │
│   Node.js/JS       │         │      Python         │
└────────────────────┘         └──────────────────────┘
         │                                │
         │                                │
         v                                v
    Blockchain                      Blockchain
    (Pagos ETH)                    (Verificación)
```

## 🔄 Flujo x402

1. **Descubrimiento**: Cliente consulta `/ai-manifest` para conocer capacidades
2. **Solicitud**: Cliente intenta ejecutar acción (ej: `/v1/devices/{id}/unlock`)
3. **402 Payment Required**: Servidor responde con detalles de pago
4. **Pago**: Cliente paga automáticamente en blockchain
5. **Reintento**: Cliente reintenta con hash de transacción en header `Authorization`
6. **Verificación**: Servidor verifica pago on-chain
7. **Éxito**: Servidor ejecuta la acción (desbloquea dispositivo)

## 📁 Estructura

```
.
├── main.py                    # API IoT (FastAPI)
├── models.py                  # Modelos de dispositivos
├── blockchain_verifier.py    # Verificación on-chain
├── webapp/                    # Webapp Next.js (incluye Agent Assistant integrado)
│   ├── app/
│   │   ├── api/
│   │   │   └── agent/
│   │   │       ├── parse/     # API para parsear intents
│   │   │       └── execute/  # API del Agent Assistant
│   │   └── page.tsx          # Interfaz principal
│   └── lib/
│       └── agent.ts          # Funciones del agente
├── agent-assistant/           # Agente Cliente (script independiente, opcional)
│   ├── index.js
│   └── package.json
└── requirements.txt
```

## 📡 Endpoints de la API

### `GET /ai-manifest`

**Service Discovery**: Retorna las capacidades de la máquina en formato JSON.

**Respuesta:**
```json
{
  "name": "IoT Device Simulator",
  "capabilities": [
    {
      "id": "unlock_device",
      "endpoint": "/v1/devices/{device_id}/unlock",
      "method": "POST",
      "payment_required": true
    }
  ],
  "payment_config": {
    "chainId": 84532,
    "token": "ETH",
    "recipient": "0x...",
    "amount": "0.001"
  }
}
```

### `POST /v1/devices/{device_id}/unlock`

**x402 Protocol**: Desbloquea un dispositivo después de verificar el pago.

**Primera llamada (sin auth):**
- **Status**: `402 Payment Required`
- **Body**: Detalles de pago

**Segunda llamada (con auth):**
- **Header**: `Authorization: Bearer 0x<transaction_hash>`
- **Status**: `200 OK`
- **Body**: Estado del dispositivo desbloqueado

### `GET /status`

Lista todos los dispositivos disponibles.

### `GET /status/{device_id}`

Obtiene el estado detallado de un dispositivo específico.

## 🧪 Probar el Sistema

### Opción 1: Usar la Webapp (Recomendado)

```bash
cd webapp
npm run dev
```

Abre `http://localhost:3000` en tu navegador y:
1. Conecta tu wallet
2. Escribe un comando (ej: "Desbloquear smart lock")
3. El Agent Assistant se activará automáticamente
4. Si se requiere pago, se mostrará un diálogo
5. Aprueba el pago desde tu wallet
6. La acción se ejecutará automáticamente

### Opción 2: Usar el Agent Assistant como Script (Solo para pruebas)

```bash
cd agent-assistant
npm install
# Crear .env con WALLET_KEY
npm start  # o npm run dev para modo watch
```

> **Nota**: El agent-assistant ahora solo se ejecuta cuando se llama explícitamente con `npm start` o `npm run dev`. No se ejecuta automáticamente al importar el módulo.

El agente automáticamente:
1. Descubrirá las capacidades
2. Listará los dispositivos
3. Intentará desbloquear un dispositivo
4. Pagará automáticamente si está dentro del límite
5. Desbloqueará el dispositivo

### Opción 2: Probar manualmente con curl

```bash
# 1. Descubrir capacidades
curl http://localhost:8000/ai-manifest

# 2. Intentar desbloquear (recibirá 402)
curl -X POST http://localhost:8000/v1/devices/smart-lock-01/unlock

# 3. Pagar (usar tu wallet)
# ... ejecutar transacción en blockchain ...

# 4. Reintentar con proof de pago
curl -X POST http://localhost:8000/v1/devices/smart-lock-01/unlock \
  -H "Authorization: Bearer 0x<tu_transaction_hash>"
```

## 🎯 Ventajas de esta Arquitectura

✅ **Simple**: HTTP estándar, sin dependencias complejas  
✅ **Estándar**: Protocolo x402 bien definido  
✅ **Dinámico**: Descubrimiento automático de capacidades  
✅ **Escalable**: Fácil agregar nuevas máquinas y capacidades  
✅ **Web3**: Integración con blockchain para pagos  
✅ **Hackathon-friendly**: Rápido de implementar y probar  


