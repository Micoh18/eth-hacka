from fastapi import FastAPI, HTTPException
from typing import List
import asyncio
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
