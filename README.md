# ChainMachina - IoT Command Center

Hey! This is ChainMachina, a decentralized IoT device control system. Think of it as a command center where you can control smart devices (3D printers, EV chargers, smart locks, vending machines) using natural language and blockchain payments.

## What You Need

Before we start, make sure you have:
- **Docker** and **Docker Compose** installed (for the backend API)
- **Node.js** (v18 or higher) and **npm** (for the frontend)
- A code editor (VS Code, whatever you like)

## Quick Start Guide

### Step 1: Start the Backend (Docker)

The backend is a FastAPI server that simulates IoT devices. We run it in Docker because it's easier.

```bash
# Make sure you're in the project root directory
cd "path/to/your/project"

# Start Docker containers
docker-compose up --build
```

This will:
- Build the Docker image
- Start the API server on `http://localhost:8000`
- You should see logs showing the server is running

**Note:** If you make changes to `main.py` or `models.py`, you'll need to rebuild:
```bash
docker-compose up --build
```

Keep this terminal open - the Docker container needs to keep running.

### Step 2: Set Up the Frontend (Webapp)

Open a **new terminal** (keep Docker running in the first one) and navigate to the webapp directory:

```bash
# Navigate to webapp folder
cd webapp

# Install dependencies (this might take a few minutes)
npm install
```

If you get errors during `npm install`, try:
```bash
npm install --legacy-peer-deps
```

### Step 3: Configure Environment Variables

The webapp needs some API keys and configuration. Copy the example file:

```bash
# In the webapp directory
cp .envexample .env.local
```

Now open `.env.local` and fill in the values:


### Step 4: Run the Frontend

Still in the `webapp` directory:

```bash
npm run dev
```

This starts the Next.js development server. You should see:
```
✓ Ready in X seconds
○ Local: http://localhost:3000
```

Open your browser and go to `http://localhost:3000`

## How It Works

1. **Backend (Docker)**: Simulates IoT devices and handles the x402 payment protocol
2. **Frontend (Next.js)**: The web interface where you type commands like "Print document" or "Unlock door"
3. **ENS Resolution**: The system tries to resolve device names using ENS (Ethereum Name Service), but falls back to direct API calls if ENS is unavailable


## Common Issues

**"Cannot connect to API"**
- Make sure Docker is running (`docker-compose up`)
- Check that `NEXT_PUBLIC_MACHINE_API_URL` in `.env` is `http://localhost:8000`

**"LLM not understanding commands"**
- Make sure `ANTHROPIC_API_KEY` is set in `.env`
- Check the browser console for errors

**"ENS resolution failed"**
- This is normal! The system will automatically fall back to direct API calls
- Make sure the backend is running on `http://localhost:8000`

**"npm install fails"**
- Try `npm install --legacy-peer-deps`
- Delete `node_modules` and `package-lock.json`, then try again

## Development Tips

- **Backend changes**: After editing `main.py`, restart Docker: `docker-compose restart`
- **Frontend changes**: Next.js hot-reloads automatically, just save your files
- **View logs**: Docker logs are in the terminal where you ran `docker-compose up`
- **Reset everything**: Stop Docker (`Ctrl+C`), then `docker-compose down` and start again

## What's Next?

Once everything is running:
1. Connect your wallet (metamask recommended)
2. Try commands like "Print document" or "Unlock door"
3. The system will discover devices, resolve ENS, and execute actions
4. If payment is required, you'll see a payment request

Enjoy! 🚀

