# Command Center UI

Modern, action-oriented interface for IoT device agents using the x402 payment protocol.

## Features

- **Command Center Design**: Clean, task-focused interface (not a chatbot)
- **Visual Task States**: Real-time progress visualization for agent tasks
- **Wallet Integration**: Secure wallet connection using Wagmi (no private keys)
- **x402 Protocol**: Full implementation of payment-required protocol
- **Intent Parsing**: AI-powered command understanding (OpenAI/Anthropic)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.local.example .env.local
```

3. Configure `.env.local`:
- `NEXT_PUBLIC_RPC_URL`: Base Sepolia RPC URL (default: https://sepolia.base.org)
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: For intent parsing (optional, falls back to regex)
- `NEXT_PUBLIC_MACHINE_API_URL`: Backend API URL (default: http://localhost:8000)

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Architecture

- **Frontend**: Next.js 14+ with App Router, React, TypeScript, Tailwind CSS
- **Wallet**: Wagmi + Viem for blockchain interactions
- **Backend Integration**: Connects to FastAPI backend for IoT device control
- **Intent Parsing**: Server-side API route for secure AI parsing

## Usage

1. Connect your wallet (MetaMask, Coinbase Wallet, etc.)
2. Enter a command in the input bar (e.g., "Unlock smart lock in office")
3. The agent will:
   - Parse your intent
   - Discover available machines
   - Find matching capabilities
   - Show payment quote if required
   - Execute payment and action

## Project Structure

```
webapp/
├── app/              # Next.js App Router
│   ├── api/          # API routes (intent parsing)
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Main page
├── components/        # React components
│   ├── CommandInput.tsx
│   ├── TaskStage.tsx
│   ├── Sidebar.tsx
│   └── WalletButton.tsx
├── lib/              # Business logic
│   ├── agent.ts      # Agent logic
│   ├── api.ts        # API client
│   ├── wallet.ts     # Wallet config
│   └── directory.json # Machine directory
├── hooks/            # Custom hooks
│   └── useTask.ts    # Task state management
├── providers/        # Context providers
│   └── WalletProvider.tsx
└── types/            # TypeScript types
```

