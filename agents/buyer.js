const { Agent } = require('@xmtp/agent-sdk');
const { createWalletClient, http, parseEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

// Configuration
const MAX_AUTO_PAY_AMOUNT = "0.05"; // ETH
const SELLER_ADDRESS = process.env.VENDOR_ADDRESS; // The address of the Seller Agent

// Wallet Setup
const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.RPC_URL || "https://sepolia.base.org")
});

async function main() {
    const agent = await Agent.create(process.env.BUYER_PRIVATE_KEY, {
        env: "production"
    });

    console.log(`🕵️ Buyer Agent started. Address: ${agent.address}`);
    console.log(`Ready to pay for services up to ${MAX_AUTO_PAY_AMOUNT} ETH.`);

    agent.onMessage(async (message) => {
        const sender = message.sender.address;
        const content = message.content.text;

        console.log(`Received message from ${sender}: ${content}`);

        // 1. Handle 402 Payment Requests
        try {
            // Attempt to parse JSON
            if (content.trim().startsWith('{')) {
                const data = JSON.parse(content);

                if (data.error === "402 Payment Required") {
                    const { amount, recipient } = data.details;
                    console.log(`💰 Received payment request: ${amount} ETH for ${recipient}`);

                    if (parseFloat(amount) <= parseFloat(MAX_AUTO_PAY_AMOUNT)) {
                        console.log("✅ Amount is within limit. Paying...");
                        await message.reply(`💸 Paying ${amount} ETH...`);

                        try {
                            const hash = await walletClient.sendTransaction({
                                to: recipient,
                                value: parseEther(amount)
                            });
                            console.log(`Transaction sent: ${hash}`);

                            // Send Proof back to Seller
                            await message.reply(`X-PAYMENT-PROOF: ${hash}`);
                        } catch (txError) {
                            console.error("Transaction failed:", txError);
                            await message.reply(`❌ Payment failed: ${txError.message}`);
                        }
                    } else {
                        console.log("⚠️ Amount exceeds limit.");
                        await message.reply(`⚠️ Payment request of ${amount} ETH exceeds my auto-pay limit.`);
                    }
                    return;
                }
            }
        } catch (e) {
            // Not JSON, ignore
        }

        // 2. Handle User Commands (Trigger)
        if (content.toLowerCase().includes("start") || content.toLowerCase().includes("buy")) {
            console.log(`Initiating contact with Seller: ${SELLER_ADDRESS}`);
            try {
                const conversation = await agent.client.conversations.newConversation(SELLER_ADDRESS);
                await conversation.send("I want to use the IoT device. Please unlock.");
                console.log("Sent initial request to Seller.");
                await message.reply("Sent request to Seller. Waiting for 402 offer...");
            } catch (err) {
                console.error("Failed to start conversation:", err);
                await message.reply("Failed to contact seller.");
            }
        }
    });

    // Auto-start for testing
    setTimeout(async () => {
        console.log(`⏰ Auto-triggering contact with Seller: ${SELLER_ADDRESS}`);
        try {
            const conversation = await agent.client.conversations.newConversation(SELLER_ADDRESS);
            await conversation.send("I want to use the IoT device. Please unlock.");
            console.log("Sent initial request to Seller.");
        } catch (err) {
            console.error("Failed to start conversation:", err);
        }
    }, 5000);

    await agent.start();
}

main().catch(console.error);
