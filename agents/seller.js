const { Agent } = require('@xmtp/agent-sdk');
const { createPublicClient, http, parseUnits } = require('viem');
const { baseSepolia } = require('viem/chains');
const axios = require('axios');
require('dotenv').config();

// Configuration
const MACHINE_PRICE_USDC = "0.01"; // Low price for testing
const MACHINE_WALLET = process.env.VENDOR_ADDRESS;
const IOT_API_URL = "http://iot-api:8000"; // Internal Docker network alias

// Blockchain Client (for verification)
const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL || "https://sepolia.base.org")
});

async function main() {
    if (!process.env.VENDOR_PRIVATE_KEY) {
        console.error("Missing VENDOR_PRIVATE_KEY");
        process.exit(1);
    }

    const agent = await Agent.create(process.env.VENDOR_PRIVATE_KEY, {
        env: "production" // Hackathon usually uses production network for XMTP
    });

    console.log(`🤖 Seller Agent started. Address: ${agent.address}`);
    console.log(`Listening for commands...`);

    agent.onMessage(async (message) => {
        const sender = message.sender.address;
        const content = message.content.text;

        console.log(`Received message from ${sender}: ${content}`);

        // 1. Check for Payment Proof
        if (content.includes("X-PAYMENT-PROOF:")) {
            const txHash = content.split("X-PAYMENT-PROOF:")[1].trim();
            console.log(`Verifying payment tx: ${txHash}`);

            try {
                const tx = await publicClient.getTransaction({ hash: txHash });

                // Basic verification (in production, check amount, recipient, token, etc.)
                if (tx.to.toLowerCase() === MACHINE_WALLET.toLowerCase()) {
                    console.log("✅ Payment verified on-chain!");

                    // Trigger IoT Action
                    try {
                        const response = await axios.get(`${IOT_API_URL}/status`);
                        const devices = response.data;

                        await message.reply(`✅ Payment received! Access granted.\n\nDevice Status:\n${JSON.stringify(devices, null, 2)}`);
                    } catch (apiError) {
                        console.error("IoT API Error:", apiError.message);
                        await message.reply("✅ Payment verified, but failed to connect to IoT device.");
                    }
                } else {
                    await message.reply("❌ Invalid payment: Recipient mismatch.");
                }
            } catch (err) {
                console.error("Verification failed:", err);
                await message.reply("❌ Payment verification failed. Check transaction hash.");
            }
            return;
        }

        // 2. Default: Send 402 Offer
        console.log("Sending 402 Payment Request...");

        const x402Offer = {
            error: "402 Payment Required",
            details: {
                amount: MACHINE_PRICE_USDC,
                currency: "ETH",
                recipient: MACHINE_WALLET,
                chainId: 84532, // Base Sepolia
                reason: "IoT Device Access Fee"
            }
        };

        await message.reply(JSON.stringify(x402Offer));
    });

    await agent.start();
}

main().catch(console.error);
