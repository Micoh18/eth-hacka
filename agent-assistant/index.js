/**
 * Agente Asistente (Cliente)
 * 
 * Este agente actúa en nombre del usuario para descubrir y usar máquinas IoT
 * siguiendo el protocolo x402 sobre HTTP estándar.
 */

import 'dotenv/config';
import axios from 'axios';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createPublicClient } from 'viem';

// Configuration
const MACHINE_API_URL = process.env.MACHINE_API_URL || 'http://localhost:8000';
const WALLET_KEY = process.env.WALLET_KEY;
const MAX_AUTO_PAY_AMOUNT = parseFloat(process.env.MAX_AUTO_PAY_AMOUNT || '0.05');
const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.org';

// Setup wallet (only if WALLET_KEY is provided)
let account = null;
let walletClient = null;
let publicClient = null;

if (WALLET_KEY) {
  account = privateKeyToAccount(WALLET_KEY);
  walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC_URL),
  });

  publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });
}

/**
 * Step 1: Service Discovery - Get machine capabilities
 */
async function discoverMachineCapabilities() {
  console.log('🔍 Discovering machine capabilities...');
  
  try {
    const response = await axios.get(`${MACHINE_API_URL}/ai-manifest`);
    console.log('✅ Machine capabilities discovered:');
    console.log(`   Name: ${response.data.name}`);
    console.log(`   Capabilities: ${response.data.capabilities.length}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to discover machine:', error.message);
    throw error;
  }
}

/**
 * Step 2: Execute action with automatic x402 payment handling
 */
async function executeWithPayment(capability, params = {}) {
  console.log(`\n🚀 Executing: ${capability.description}`);
  console.log(`   Endpoint: ${capability.method} ${capability.endpoint}`);
  
  const url = capability.endpoint.replace('{device_id}', params.device_id || '');
  const fullUrl = `${MACHINE_API_URL}${url}`;
  
  try {
    // First attempt (will get 402)
    const response = await axios({
      method: capability.method.toLowerCase(),
      url: fullUrl,
      data: params,
      validateStatus: (status) => status === 200 || status === 402, // Accept 402 as valid
    });
    
    if (response.status === 200) {
      console.log('✅ Action completed successfully (no payment required)');
      return response.data;
    }
    
    // Handle 402 Payment Required
    if (response.status === 402) {
      const paymentDetails = response.data.detail.paymentDetails;
      const amount = parseFloat(paymentDetails.amount);
      
      console.log(`\n💰 Payment Required: ${amount} ${paymentDetails.token}`);
      console.log(`   Recipient: ${paymentDetails.recipient}`);
      console.log(`   Chain: ${paymentDetails.chainName}`);
      
      // Check if wallet is configured
      if (!walletClient || !publicClient || !account) {
        throw new Error('Wallet not configured. WALLET_KEY environment variable is required for automatic payments.');
      }
      
      // Check if amount is within auto-pay limit
      if (amount > MAX_AUTO_PAY_AMOUNT) {
        throw new Error(
          `Payment amount ${amount} exceeds auto-pay limit of ${MAX_AUTO_PAY_AMOUNT}`
        );
      }
      
      // Check wallet balance before payment
      console.log('🔍 Checking wallet balance...');
      const balance = await publicClient.getBalance({ address: account.address });
      const balanceEth = Number(balance) / 1e18;
      console.log(`   Balance: ${balanceEth.toFixed(6)} ETH`);
      
      const requiredAmount = parseEther(paymentDetails.amount);
      const estimatedGas = 21000n; // Standard ETH transfer
      const gasPrice = await publicClient.getGasPrice();
      const totalCost = requiredAmount + (estimatedGas * gasPrice);
      const totalCostEth = Number(totalCost) / 1e18;
      
      console.log(`   Required: ${totalCostEth.toFixed(6)} ETH (${paymentDetails.amount} ETH + gas)`);
      
      if (balance < totalCost) {
        throw new Error(
          `Insufficient balance. Have ${balanceEth.toFixed(6)} ETH, need ${totalCostEth.toFixed(6)} ETH`
        );
      }
      
      // Execute payment
      console.log('💸 Executing payment...');
      const txHash = await walletClient.sendTransaction({
        to: paymentDetails.recipient,
        value: parseEther(paymentDetails.amount),
      });
      
      console.log(`✅ Payment sent: ${txHash}`);
      console.log('⏳ Waiting for transaction confirmation...');
      
      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log('✅ Transaction confirmed on-chain');
      
      // Retry with payment proof
      console.log('\n🔄 Retrying request with payment proof...');
      const retryResponse = await axios({
        method: capability.method.toLowerCase(),
        url: fullUrl,
        data: params,
        headers: {
          Authorization: `Bearer ${txHash}`,
        },
      });
      
      console.log('✅ Action completed after payment!');
      return retryResponse.data;
    }
  } catch (error) {
    if (error.response && error.response.status === 402) {
      // This shouldn't happen as we handle 402 above, but just in case
      throw new Error('Payment required but auto-pay failed');
    }
    throw error;
  }
}

/**
 * Main function: Discover and use machine
 */
async function main() {
  // Check if wallet is configured
  if (!WALLET_KEY || !account || !walletClient || !publicClient) {
    console.error('❌ Missing WALLET_KEY environment variable');
    console.error('   Please set WALLET_KEY in your .env file to use the agent assistant');
    process.exit(1);
  }

  console.log('🤖 Agent Assistant Starting...\n');
  console.log(`📡 Machine API: ${MACHINE_API_URL}`);
  console.log(`💰 Max auto-pay: ${MAX_AUTO_PAY_AMOUNT} ETH`);
  console.log(`🔑 Wallet Address: ${account.address}`);
  console.log(`🌐 RPC URL: ${RPC_URL}`);
  console.log(`🔗 Chain: Ethereum Sepolia (Chain ID: ${sepolia.id})\n`);
  
  // Verify RPC connection
  try {
    const blockNumber = await publicClient.getBlockNumber();
    console.log(`✅ Connected to Ethereum Sepolia (Block: ${blockNumber})\n`);
  } catch (error) {
    console.error(`❌ Failed to connect to RPC: ${error.message}\n`);
  }
  
  try {
    // Step 1: Discover capabilities
    const manifest = await discoverMachineCapabilities();
    
    // Step 2: List available devices
    console.log('\n📋 Listing available devices...');
    const devicesResponse = await axios.get(`${MACHINE_API_URL}/status`);
    const devices = devicesResponse.data;
    
    console.log(`\n✅ Found ${devices.length} devices:`);
    devices.forEach((device) => {
      console.log(`   - ${device.name} (${device.id}): ${device.status}`);
    });
    
    // Step 3: Find unlock capability
    const unlockCapability = manifest.capabilities.find(
      (cap) => cap.id === 'unlock_device'
    );
    
    if (!unlockCapability) {
      throw new Error('Unlock capability not found in manifest');
    }
    
    // Step 4: Unlock a device (example: smart lock)
    const smartLock = devices.find((d) => d.type === 'smart_lock');
    if (smartLock) {
      console.log(`\n🔓 Attempting to unlock: ${smartLock.name}`);
      const result = await executeWithPayment(unlockCapability, {
        device_id: smartLock.id,
      });
      
      console.log('\n✅ Success!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n⚠️  No smart lock device found');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Don't run main automatically - only run when explicitly called
// This allows the script to be used as a module without auto-executing

// To run manually, use: node index.js --run
if (process.argv.includes('--run')) {
  main();
}

export { discoverMachineCapabilities, executeWithPayment, main };

