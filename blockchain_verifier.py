"""
Blockchain Transaction Verifier
Verifies on-chain transactions for x402 protocol
"""

from typing import Optional
import os

# Optional: Use web3.py for blockchain verification
try:
    from web3 import Web3
    WEB3_AVAILABLE = True
except ImportError:
    WEB3_AVAILABLE = False
    print("⚠️  web3.py not installed. Using simplified verification.")


async def verify_transaction_on_chain(
    tx_hash: str,
    expected_recipient: str,
    expected_amount: str,
    rpc_url: Optional[str] = None
) -> bool:
    """
    Verify that a transaction exists on-chain and matches expected parameters.
    
    Args:
        tx_hash: Transaction hash to verify
        expected_recipient: Expected recipient address
        expected_amount: Expected amount in ETH (as string)
        rpc_url: RPC endpoint URL (defaults to Ethereum Sepolia)
    
    Returns:
        True if transaction is valid, False otherwise
    """
    if not WEB3_AVAILABLE:
        # Simplified verification for hackathon demo
        # In production, always verify on-chain
        return tx_hash.startswith("0x") and len(tx_hash) == 66
    
    rpc_url = rpc_url or os.getenv("RPC_URL", "https://sepolia.base.org")
    
    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        
        # Get transaction receipt
        tx_receipt = w3.eth.get_transaction_receipt(tx_hash)
        
        if not tx_receipt or tx_receipt.status != 1:
            return False
        
        # Get transaction details
        tx = w3.eth.get_transaction(tx_hash)
        
        # Verify recipient
        if tx.to and tx.to.lower() != expected_recipient.lower():
            return False
        
        # Verify amount (convert to wei for comparison)
        expected_amount_wei = w3.to_wei(float(expected_amount), 'ether')
        if tx.value != expected_amount_wei:
            return False
        
        return True
    except Exception as e:
        print(f"Error verifying transaction: {e}")
        return False

