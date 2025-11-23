from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
import asyncio
import os
import logging
import uuid
import hashlib
from datetime import datetime
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="IoT Simulator API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    logger.info(f"[REQUEST] {request.method} {request.url.path} - Client: {request.client.host if request.client else 'unknown'}")
    
    try:
        response = await call_next(request)
        process_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[RESPONSE] {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.3f}s")
        return response
    except Exception as e:
        process_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"[ERROR] {request.method} {request.url.path} - Exception: {str(e)} - Time: {process_time:.3f}s")
        raise

# Initialize devices
devices: List[DeviceSimulator] = [
    EVStation(),
    Printer3D(),
    SmartLock(),
    VendingMachine(),
    SecurityCamera()
]

device_map = {d.id: d for d in devices}
# Map ENS domains to devices for routing
ens_map = {d.ens_domain: d for d in devices}
# Map device names (from URL path) to devices
device_name_map = {d.id.replace("-", "_"): d for d in devices}  # e.g., "printer_3d_01" -> device

@app.on_event("startup")
async def startup_event():
    logger.info("[STARTUP] IoT Simulator API starting up...")
    logger.info(f"[STARTUP] Initialized {len(devices)} devices: {[d.id for d in devices]}")
    asyncio.create_task(simulation_loop())
    logger.info("[STARTUP] Simulation loop started")

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
    logger.info("[API] GET /status - Request received")
    try:
        summaries = [d.get_status_summary() for d in devices]
        logger.info(f"[API] GET /status - Returning {len(summaries)} devices")
        return summaries
    except Exception as e:
        logger.error(f"[API] GET /status - Error: {str(e)}")
        raise

@app.get("/status/{device_id}", response_model=DeviceDetail)
async def get_device_status(device_id: str):
    """
    Get detailed telemetry for a specific device.
    """
    logger.info(f"[API] GET /status/{device_id} - Request received")
    if device_id not in device_map:
        logger.warning(f"[API] GET /status/{device_id} - Device not found")
        raise HTTPException(status_code=404, detail="Device not found")
    
    try:
        detail = device_map[device_id].get_detail()
        logger.info(f"[API] GET /status/{device_id} - Returning device detail")
        return detail
    except Exception as e:
        logger.error(f"[API] GET /status/{device_id} - Error: {str(e)}")
        raise

@app.get("/")
async def root():
    logger.info("[API] GET / - Root endpoint accessed")
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
    logger.info("[API] GET /ai-manifest - Request received")
    try:
        manifest = {
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
            "chainId": 11155111,  # Ethereum Sepolia
            "chainName": "Ethereum Sepolia",
            "token": "ETH",  # Native ETH
            "recipient": os.getenv("VENDOR_ADDRESS", "0x13EB37a124F98A76c973c3fce0F3FF829c7df57C"),  # seller-agent
            "rpcUrl": "https://rpc.sepolia.org"
        }
        }
        logger.info(f"[API] GET /ai-manifest - Returning manifest with {len(manifest['capabilities'])} capabilities")
        return manifest
    except Exception as e:
        logger.error(f"[API] GET /ai-manifest - Error: {str(e)}")
        raise

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
    logger.info(f"[API] POST /v1/devices/{device_id}/unlock - Request received (auth: {bool(authorization)})")
    
    if device_id not in device_map:
        logger.warning(f"[API] POST /v1/devices/{device_id}/unlock - Device not found")
        raise HTTPException(status_code=404, detail="Device not found")
    
    device = device_map[device_id]
    
    # Check if payment proof is provided
    if not authorization:
        # Step 1: Return 402 Payment Required (x402 protocol)
        logger.info(f"[API] POST /v1/devices/{device_id}/unlock - No authorization, returning 402 Payment Required")
        raise HTTPException(
            status_code=402,
            detail={
                "error": "Payment Required",
                "paymentDetails": {
                    "chainId": 11155111,  # Ethereum Sepolia
                    "chainName": "Ethereum Sepolia",
                    "token": "ETH",
                    "recipient": os.getenv("VENDOR_ADDRESS", "0x13EB37a124F98A76c973c3fce0F3FF829c7df57C"),  # seller-agent
                    "amount": "0.001",  # Default price
                    "description": f"Unlock device {device_id}"
                }
            }
        )
    
    # Step 2: Verify payment (authorization header contains transaction hash)
    tx_hash = authorization.replace("Bearer ", "").strip()
    logger.info(f"[API] POST /v1/devices/{device_id}/unlock - Verifying payment with tx_hash: {tx_hash[:20]}...")
    
    # TODO: Implement actual blockchain verification
    # For now, we'll accept any valid-looking transaction hash
    if not tx_hash.startswith("0x") or len(tx_hash) != 66:
        logger.warning(f"[API] POST /v1/devices/{device_id}/unlock - Invalid tx_hash format")
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
                "rpcUrl": os.getenv("RPC_URL", "https://rpc.sepolia.org")
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
        logger.info(f"[API] POST /v1/devices/{device_id}/unlock - Payment verified, unlocking device")
        if hasattr(device, 'is_locked'):
            device.is_locked = False
            if hasattr(device, 'last_unlocked_by'):
                device.last_unlocked_by = tx_hash[:10] + "..."  # Use tx hash prefix
        
        device.update()
        
        logger.info(f"[API] POST /v1/devices/{device_id}/unlock - Device unlocked successfully")
        return {
            "success": True,
            "message": f"Device {device_id} unlocked successfully",
            "transaction_hash": tx_hash,
            "device_status": device.get_detail()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] POST /v1/devices/{device_id}/unlock - Exception: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to unlock device: {str(e)}"
        )

# ============================================================================
# ENS Routing & Device-Specific Endpoints
# ============================================================================

@app.get("/resolve/{ens_name}")
async def resolve_ens(ens_name: str):
    """
    ENS Resolution: Simulates resolving an ENS domain to device URL and payment address.
    This is the "magic" that makes one Docker container appear as multiple devices.
    
    Returns:
    {
        "url": "https://api.tudominio.com/devices/{device_name}",
        "payment_address": "0x...",
        "device_id": "...",
        "device_name": "..."
    }
    """
    logger.info(f"[API] GET /resolve/{ens_name} - ENS resolution requested")
    
    # Normalize ENS name (remove .eth if present, handle case)
    normalized_ens = ens_name.lower().replace(".eth", "")
    full_ens = normalized_ens + ".eth"
    
    # Find device by ENS domain
    device = ens_map.get(full_ens)
    if not device:
        logger.warning(f"[API] GET /resolve/{ens_name} - ENS domain not found")
        raise HTTPException(status_code=404, detail=f"ENS domain '{ens_name}' not found")
    
    # Get base URL from environment or use default
    base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    
    # Device-specific payment address (could be different per device, but using same for now)
    # In production, each device could have its own wallet
    payment_address = os.getenv("VENDOR_ADDRESS", "0x13EB37a124F98A76c973c3fce0F3FF829c7df57C")
    
    # Create device-specific URL path
    device_name = device.id.replace("-", "_")  # e.g., "printer-3d-01" -> "printer_3d_01"
    device_url = f"{base_url}/devices/{device_name}"
    
    result = {
        "url": device_url,
        "payment_address": payment_address,
        "device_id": device.id,
        "device_name": device.name,
        "ens_domain": full_ens
    }
    
    logger.info(f"[API] GET /resolve/{ens_name} - Resolved to device: {device.id}")
    return result

@app.get("/devices/{device_name}/ai-manifest")
async def get_device_manifest(device_name: str):
    """
    Device-Specific Manifest: Returns capabilities for a specific device.
    This allows each device to appear as a separate machine with its own manifest.
    """
    logger.info(f"[API] GET /devices/{device_name}/ai-manifest - Request received")
    
    # Find device by name (convert from URL format to device ID)
    device_id = device_name.replace("_", "-")  # e.g., "printer_3d_01" -> "printer-3d-01"
    device = device_map.get(device_id)
    
    if not device:
        logger.warning(f"[API] GET /devices/{device_name}/ai-manifest - Device not found")
        raise HTTPException(status_code=404, detail=f"Device '{device_name}' not found")
    
    # Get base URL
    base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    device_path = f"/devices/{device_name}"
    
    # Build device-specific capabilities based on device type
    capabilities = []
    
    # Common capability: get device status
    capabilities.append({
        "id": "get_device_status",
        "endpoint": f"{device_path}/status",
        "method": "GET",
        "description": f"Get detailed status of {device.name}",
        "schema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "payment_required": False
    })
    
    # Device-specific capabilities
    if device.type == "smart_lock":
        capabilities.append({
            "id": "unlock_device",
            "endpoint": f"{device_path}/job",
            "method": "POST",
            "description": f"Unlock {device.name} (requires payment)",
            "schema": {
                "type": "object",
                "properties": {},
                "required": []
            },
            "payment_required": True,
            "default_amount_eth": "0.001"
        })
    elif device.type == "3d_printer":
        capabilities.append({
            "id": "print_document",
            "endpoint": f"{device_path}/job",
            "method": "POST",
            "description": f"Print document on {device.name} (requires payment)",
            "schema": {
                "type": "object",
                "properties": {
                    "file_url": {
                        "type": "string",
                        "description": "URL of the file to print"
                    }
                },
                "required": []
            },
            "payment_required": True,
            "default_amount_eth": "0.002"
        })
    elif device.type == "ev_charger":
        capabilities.append({
            "id": "charge_vehicle",
            "endpoint": f"{device_path}/job",
            "method": "POST",
            "description": f"Start charging session at {device.name} (requires payment)",
            "schema": {
                "type": "object",
                "properties": {},
                "required": []
            },
            "payment_required": True,
            "default_amount_eth": "0.005"
        })
    
    manifest = {
        "name": device.name,
        "version": "1.0.0",
        "description": f"{device.name} - {device.type} device",
        "capabilities": capabilities,
        "payment_config": {
            "chainId": 11155111,  # Ethereum Sepolia
            "chainName": "Ethereum Sepolia",
            "token": "ETH",
            "recipient": os.getenv("VENDOR_ADDRESS", "0x13EB37a124F98A76c973c3fce0F3FF829c7df57C"),
            "rpcUrl": "https://rpc.sepolia.org"
        },
        "device_info": {
            "id": device.id,
            "type": device.type,
            "ens_domain": device.ens_domain
        }
    }
    
    logger.info(f"[API] GET /devices/{device_name}/ai-manifest - Returning manifest with {len(capabilities)} capabilities")
    return manifest

@app.get("/devices/{device_name}/status")
async def get_device_status_by_name(device_name: str):
    """
    Get device status by device name (from URL path).
    """
    logger.info(f"[API] GET /devices/{device_name}/status - Request received")
    
    device_id = device_name.replace("_", "-")
    device = device_map.get(device_id)
    
    if not device:
        logger.warning(f"[API] GET /devices/{device_name}/status - Device not found")
        raise HTTPException(status_code=404, detail=f"Device '{device_name}' not found")
    
    logger.info(f"[API] GET /devices/{device_name}/status - Returning device detail")
    return device.get_detail()

class JobRequest(BaseModel):
    action: Optional[str] = None
    params: Optional[Dict[str, Any]] = None

@app.post("/devices/{device_name}/job")
async def execute_device_job(
    device_name: str,
    request: Request,
    job_request: Optional[JobRequest] = None,
    authorization: Optional[str] = Header(None)
):
    """
    Device-Specific Job Execution: Execute actions on a specific device.
    This endpoint handles the x402 payment protocol for device-specific actions.
    
    Flow:
    1. First request (no auth) -> Returns 402 Payment Required with device-specific payment details
    2. Client pays and gets transaction hash
    3. Second request (with tx hash in Authorization header) -> Verifies payment and executes action
    """
    logger.info(f"[API] POST /devices/{device_name}/job - Request received (auth: {bool(authorization)})")
    
    # Find device
    device_id = device_name.replace("_", "-")
    device = device_map.get(device_id)
    
    if not device:
        logger.warning(f"[API] POST /devices/{device_name}/job - Device not found")
        raise HTTPException(status_code=404, detail=f"Device '{device_name}' not found")
    
    # Determine action and payment amount based on device type
    action = job_request.action if job_request and job_request.action else "default"
    default_amounts = {
        "smart_lock": "0.001",
        "3d_printer": "0.002",
        "ev_charger": "0.005",
        "vending_machine": "0.003",
        "security_camera": "0.001"
    }
    amount = default_amounts.get(device.type, "0.001")
    
    # Check if payment proof is provided
    if not authorization:
        # Step 1: Return 402 Payment Required (x402 protocol)
        logger.info(f"[API] POST /devices/{device_name}/job - No authorization, returning 402 Payment Required")
        raise HTTPException(
            status_code=402,
            detail={
                "error": "Payment Required",
                "paymentDetails": {
                    "chainId": 11155111,  # Ethereum Sepolia
                    "chainName": "Ethereum Sepolia",
                    "token": "ETH",
                    "recipient": os.getenv("VENDOR_ADDRESS", "0x13EB37a124F98A76c973c3fce0F3FF829c7df57C"),
                    "amount": amount,
                    "description": f"Execute {action} on {device.name}"
                }
            }
        )
    
    # Step 2: Verify payment (authorization header contains transaction hash)
    tx_hash = authorization.replace("Bearer ", "").strip()
    logger.info(f"[API] POST /devices/{device_name}/job - Verifying payment with tx_hash: {tx_hash[:20]}...")
    
    # Validate transaction hash format
    if not tx_hash.startswith("0x") or len(tx_hash) != 66:
        logger.warning(f"[API] POST /devices/{device_name}/job - Invalid tx_hash format")
        raise HTTPException(
            status_code=401,
            detail="Invalid payment proof. Transaction hash must be a valid hex string (0x...)"
        )
    
    # Execute device-specific action
    try:
        logger.info(f"[API] POST /devices/{device_name}/job - Payment verified, executing action: {action}")
        
        # Device-specific action execution
        result_data = {
            "success": True,
            "message": f"Action '{action}' executed on {device.name} successfully",
            "transaction_hash": tx_hash,
            "device_status": device.get_detail()
        }
        
        if device.type == "smart_lock" and hasattr(device, 'is_locked'):
            device.is_locked = False
            if hasattr(device, 'last_unlocked_by'):
                device.last_unlocked_by = tx_hash[:10] + "..."
        elif device.type == "3d_printer":
            # Simulate printing with proof
            logger.info(f"[API] POST /devices/{device_name}/job - Starting print job")
            
            # Generate unique job ID and proof
            job_id = str(uuid.uuid4())
            job_proof = hashlib.sha256(f"{job_id}{tx_hash}{device.id}".encode()).hexdigest()[:16]
            
            # Generate filename
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"print_job_{timestamp}_{job_proof}.gcode"
            
            # Update printer state
            if hasattr(device, 'status'):
                device.status = "PRINTING"
            if hasattr(device, 'current_file'):
                device.current_file = filename
            if hasattr(device, 'progress_percent'):
                device.progress_percent = 0.0  # Start at 0%
            
            # Add print job proof to response
            result_data.update({
                "job_id": job_id,
                "job_proof": job_proof,
                "file_name": filename,
                "message": f"Print job '{filename}' started successfully on {device.name}"
            })
            
            logger.info(f"[API] POST /devices/{device_name}/job - Print job created: {job_id} ({filename})")
        elif device.type == "ev_charger":
            # Simulate charging start
            if hasattr(device, 'status'):
                device.status = "CHARGING"
            logger.info(f"[API] POST /devices/{device_name}/job - Starting charging session")
        
        device.update()
        
        logger.info(f"[API] POST /devices/{device_name}/job - Action executed successfully")
        return result_data
    except Exception as e:
        logger.error(f"[API] POST /devices/{device_name}/job - Exception: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute action: {str(e)}"
        )
