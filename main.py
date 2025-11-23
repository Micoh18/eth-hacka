from fastapi import FastAPI, HTTPException, Header, Request
from typing import List, Optional
import asyncio
import os
from models import (
    DeviceSimulator,
    EVStation,
    Printer3D,
    SmartLock,
    VendingMachine,
    SecurityCamera,
    DeviceDetail,
    DeviceSummary
)
from pydantic import BaseModel

app = FastAPI(title="IoT Simulator API", version="1.0.0")

# Initialize devices
devices: List[DeviceSimulator] = [
    EVStation(),
    Printer3D(),
    SmartLock(),
    VendingMachine(),
    SecurityCamera()
]

device_map = {d.id: d for d in devices}

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulation_loop())

async def simulation_loop():
    while True:
        for device in devices:
            device.update()
        await asyncio.sleep(5)

@app.get("/status", response_model=List[DeviceSummary])
async def get_all_status():
    """
    Get a summary list of all devices.
    """
    return [d.get_status_summary() for d in devices]

@app.get("/status/{device_id}", response_model=DeviceDetail)
async def get_device_status(device_id: str):
    """
    Get detailed telemetry for a specific device.
    """
    if device_id not in device_map:
        raise HTTPException(status_code=404, detail="Device not found")
    
    return device_map[device_id].get_detail()

@app.get("/")
async def root():
    return {"message": "IoT Simulator API is running. Go to /docs for Swagger UI."}

# ============================================================================
# x402 Protocol & AI Manifest Endpoints
# ============================================================================

@app.get("/ai-manifest")
async def get_ai_manifest():
    """
    Service Discovery: Returns machine capabilities in a format that AI agents can understand.
    This is the "intercambio de funciones" - the machine tells the agent what it can do.
    """
    return {
        "name": "IoT Device Simulator",
        "version": "1.0.0",
        "description": "Simulated IoT devices with x402 payment protocol",
        "capabilities": [
            {
                "id": "unlock_device",
                "endpoint": "/v1/devices/{device_id}/unlock",
                "method": "POST",
                "description": "Unlock a specific IoT device (requires payment)",
                "schema": {
                    "type": "object",
                    "properties": {
                        "device_id": {
                            "type": "string",
                            "description": "ID of the device to unlock"
                        }
                    },
                    "required": ["device_id"]
                },
                "payment_required": True,
                "default_amount_eth": "0.001"
            },
            {
                "id": "get_device_status",
                "endpoint": "/status/{device_id}",
                "method": "GET",
                "description": "Get detailed status of a specific device",
                "schema": {
                    "type": "object",
                    "properties": {
                        "device_id": {
                            "type": "string",
                            "description": "ID of the device"
                        }
                    },
                    "required": ["device_id"]
                },
                "payment_required": False
            },
            {
                "id": "list_all_devices",
                "endpoint": "/status",
                "method": "GET",
                "description": "Get summary of all available devices",
                "payment_required": False
            }
        ],
        "payment_config": {
            "chainId": 84532,  # Base Sepolia
            "chainName": "Base Sepolia",
            "token": "ETH",  # Native ETH
            "recipient": os.getenv("VENDOR_ADDRESS", "0x13EB37a124F98A76c973c3fce0F3FF829c7df57C"),  # seller-agent
            "rpcUrl": "https://sepolia.base.org"
        }
    }

class UnlockRequest(BaseModel):
    device_id: str

@app.post("/v1/devices/{device_id}/unlock")
async def unlock_device(
    device_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    x402 Protocol Implementation: Unlock device after payment verification.
    
    Flow:
    1. First request (no auth) -> Returns 402 Payment Required
    2. Client pays and gets transaction hash
    3. Second request (with tx hash in Authorization header) -> Verifies payment and unlocks
    """
    if device_id not in device_map:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device = device_map[device_id]
    
    # Check if payment proof is provided
    if not authorization:
        # Step 1: Return 402 Payment Required (x402 protocol)
        raise HTTPException(
            status_code=402,
            detail={
                "error": "Payment Required",
                "paymentDetails": {
                    "chainId": 84532,  # Base Sepolia
                    "chainName": "Base Sepolia",
                    "token": "ETH",
                    "recipient": os.getenv("VENDOR_ADDRESS", "0x13EB37a124F98A76c973c3fce0F3FF829c7df57C"),  # seller-agent
                    "amount": "0.001",  # Default price
                    "description": f"Unlock device {device_id}"
                }
            }
        )
    
    # Step 2: Verify payment (authorization header contains transaction hash)
    tx_hash = authorization.replace("Bearer ", "").strip()
    
    # TODO: Implement actual blockchain verification
    # For now, we'll accept any valid-looking transaction hash
    if not tx_hash.startswith("0x") or len(tx_hash) != 66:
        raise HTTPException(
            status_code=401,
            detail="Invalid payment proof. Transaction hash must be a valid hex string (0x...)"
        )
    
    # Verify transaction on-chain
    try:
        # Import verifier (optional - can work without it for demo)
        try:
            from blockchain_verifier import verify_transaction_on_chain
            
            # Get payment config from manifest
            payment_config = {
                "recipient": os.getenv("VENDOR_ADDRESS", "0x13EB37a124F98A76c973c3fce0F3FF829c7df57C"),  # seller-agent
                "amount": "0.001",
                "rpcUrl": os.getenv("RPC_URL", "https://sepolia.base.org")
            }
            
            # Verify transaction (async, but we'll use sync for simplicity in FastAPI)
            # For hackathon: simplified verification
            # In production: use async verification
            is_valid = tx_hash.startswith("0x") and len(tx_hash) == 66
            
            # TODO: Uncomment for real blockchain verification
            # is_valid = await verify_transaction_on_chain(
            #     tx_hash,
            #     payment_config["recipient"],
            #     payment_config["amount"],
            #     payment_config["rpcUrl"]
            # )
            
            if not is_valid:
                raise HTTPException(
                    status_code=401,
                    detail="Payment verification failed. Invalid transaction."
                )
        except ImportError:
            # Fallback: basic format validation
            if not (tx_hash.startswith("0x") and len(tx_hash) == 66):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid transaction hash format"
                )
        
        # Unlock the device
        if hasattr(device, 'is_locked'):
            device.is_locked = False
            if hasattr(device, 'last_unlocked_by'):
                device.last_unlocked_by = tx_hash[:10] + "..."  # Use tx hash prefix
        
        device.update()
        
        return {
            "success": True,
            "message": f"Device {device_id} unlocked successfully",
            "transaction_hash": tx_hash,
            "device_status": device.get_detail()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to unlock device: {str(e)}"
        )
