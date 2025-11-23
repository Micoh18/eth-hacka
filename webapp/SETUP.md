# 🚀 Guía de Configuración

## Variables de Entorno

### Ubicación del archivo `.env.local`

**IMPORTANTE:** El archivo `.env.local` debe estar en el directorio `webapp/`, no en `agent-assistant/`.

```
webapp/
├── .env.local          ← AQUÍ debe estar tu archivo
├── env.example         ← Archivo de ejemplo
└── ...
```

### ¿Por qué en `webapp/`?

- El parseo con LLM se ejecuta en `webapp/app/api/agent/parse/route.ts`
- Next.js lee las variables de entorno desde el directorio raíz de la aplicación
- `agent-assistant/` es un script independiente que no usa estas API keys

## Configuración Paso a Paso

### 1. Crear el archivo `.env.local`

```bash
cd webapp
cp env.example .env.local
```

### 2. Obtener tu API Key de Anthropic

1. Ve a https://console.anthropic.com/
2. Crea una cuenta o inicia sesión
3. Ve a "API Keys"
4. Crea una nueva API key
5. Copia la key (formato: `sk-ant-api03-...`)

### 3. Editar `.env.local`

Abre `webapp/.env.local` y configura:

#### 3.1 API Key de Anthropic (Requerido)
```env
ANTHROPIC_API_KEY=sk-ant-api03-tu-api-key-aqui
```

#### 3.2 Direcciones y Keys de Agentes
```env
# Buyer Agent (Cliente que paga)
BUYER_ADDRESS=0x495B29117Ee2D250f58D7E1726F32dE91286B9e3
BUYER_PRIVATE_KEY=0x16ce06506611e54a20f0f07ae00527c7643b1d6792ad7c33e91a3435a709483f

# Vendor/Seller Agent (Recibe pagos)
VENDOR_ADDRESS=0x13EB37a124F98A76c973c3fce0F3FF829c7df57C
VENDOR_PRIVATE_KEY=0x...
```

**Nota:** En la webapp, el usuario conecta su propia wallet para pagar. Las keys de buyer/vendor se usan para operaciones del sistema o pruebas.

#### 3.3 Variables Opcionales
```env
# Machine API URL (si tu servidor FastAPI está en otro puerto)
NEXT_PUBLIC_MACHINE_API_URL=http://localhost:8000

# RPC URL para blockchain
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org

# Máximo de pago automático (en ETH)
MAX_AUTO_PAY_AMOUNT=0.05
```

## Verificación

Después de configurar, inicia el servidor:

```bash
cd webapp
npm run dev
```

En los logs deberías ver:
```
[API] /api/agent/parse - API keys check: { hasAnthropic: true, hasOpenAI: false }
[API] /api/agent/parse - Attempting Anthropic parsing
```

Si ves `hasAnthropic: false`, verifica que:
- El archivo esté en `webapp/.env.local` (no en `webapp/env.local` ni en otro lugar)
- El nombre de la variable sea exactamente `ANTHROPIC_API_KEY`
- No haya espacios alrededor del `=`
- Reinicies el servidor después de crear/editar el archivo

## Nota sobre `agent-assistant/`

El directorio `agent-assistant/` tiene su propio `.env` con `WALLET_KEY` para pagos. Eso es independiente y no afecta el parseo de comandos.

