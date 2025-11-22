from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import random
import time
from datetime import datetime

# --- Base Models ---

class DeviceCommon(BaseModel):
    id: str
    name: str
    type: str
    ens_domain: str

class DeviceSummary(DeviceCommon):
    status: str
    ens: str # The user asked for 'ens' in the list view, but 'ens_domain' in the detail. I'll keep both or map them.
    # Actually the user example showed 'ens' in list view and 'ens_domain' in detail.
    # My previous code used 'ens_domain' for both in DeviceBase, but mapped it to 'ens' in get_status_summary.
    # Let's fix the models.

class DeviceDetail(DeviceCommon):
    last_updated: str
    payment_config: Optional[Dict[str, Any]] = None
    telemetry: Dict[str, Any]

# --- Simulation Logic Classes ---

class DeviceSimulator:
    def __init__(self, id: str, name: str, type: str, ens_domain: str):
        self.id = id
        self.name = name
        self.type = type
        self.ens_domain = ens_domain
        self.last_updated = datetime.utcnow()
    
    def update(self):
        self.last_updated = datetime.utcnow()

    def get_status_summary(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "status": self._get_status_string(),
            "ens": self.ens_domain,
            "ens_domain": self.ens_domain
        }

    def get_detail(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "ens_domain": self.ens_domain,
            "last_updated": self.last_updated.isoformat() + "Z",
            "payment_config": self._get_payment_config(),
            "telemetry": self._get_telemetry()
        }

    def _get_status_string(self) -> str:
        return "UNKNOWN"

    def _get_payment_config(self) -> Optional[Dict[str, Any]]:
        return None

    def _get_telemetry(self) -> Dict[str, Any]:
        return {}


class EVStation(DeviceSimulator):
    def __init__(self):
        super().__init__("ev-station-01", "Tesla Supercharger - Centro", "ev_charger", "evcharger.eth")
        self.max_power_kw = 22.0
        self.connector_type = "Type 2 (Mennekes)"
        
        # Dynamic state
        self.status = "CHARGING" # AVAILABLE | CHARGING | COMPLETE | FAULT
        self.vehicle_connected = True
        self.current_power_kw = 11.5
        self.total_energy_delivered_kwh = 45.2
        self.battery_percent = 78
        self.estimated_time_remaining_min = 45

    def update(self):
        super().update()
        if self.status == "CHARGING":
            # Simulate power fluctuation
            self.current_power_kw = 18.0 + random.uniform(-0.5, 0.5)
            # Simulate energy delivery
            self.total_energy_delivered_kwh += (self.current_power_kw / 3600) * 5 # assuming 5 sec update
            # Simulate battery charging
            if self.battery_percent < 100:
                self.battery_percent += 0.1
            else:
                self.status = "COMPLETE"
                self.current_power_kw = 0.0
                self.estimated_time_remaining_min = 0

    def _get_status_string(self) -> str:
        return self.status

    def _get_telemetry(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "vehicle_connected": self.vehicle_connected,
            "current_power_kw": round(self.current_power_kw, 2),
            "session_kwh": round(self.total_energy_delivered_kwh, 2), # Using total as session for simplicity
            "battery_simulation": {
                "percent": int(self.battery_percent)
            }
        }

class Printer3D(DeviceSimulator):
    def __init__(self):
        super().__init__("printer-3d-01", "Prusa Lab", "3d_printer", "3dprinter.eth")
        self.model = "Prusa i3 MK3S"
        self.material = "PLA"
        self.nozzle_diameter = 0.4
        
        # Dynamic state
        self.status = "PRINTING" # IDLE | HEATING | PRINTING | COOLING
        self.progress_percent = 45.5
        self.nozzle_temp_c = 210.0
        self.bed_temp_c = 60.0
        self.current_file = "benchy_boat.gcode"
        self.time_remaining_sec = 1240

    def update(self):
        super().update()
        if self.status == "PRINTING":
            # Thermal noise
            self.nozzle_temp_c = 210.0 + random.uniform(-0.5, 0.5)
            self.bed_temp_c = 60.0 + random.uniform(-0.2, 0.2)
            
            # Progress
            if self.progress_percent < 100:
                self.progress_percent += 0.5
                self.time_remaining_sec = max(0, self.time_remaining_sec - 5)
            else:
                self.status = "COOLING"

        elif self.status == "COOLING":
            self.nozzle_temp_c = max(25, self.nozzle_temp_c - 5)
            if self.nozzle_temp_c < 50:
                self.status = "IDLE"
                self.progress_percent = 0

    def _get_status_string(self) -> str:
        return self.status

    def _get_payment_config(self) -> Optional[Dict[str, Any]]:
        return {
            "price_per_min": 0.10,
            "currency": "USDC"
        }

    def _get_telemetry(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "progress_percent": round(self.progress_percent, 1),
            "nozzle_temp_c": round(self.nozzle_temp_c, 1),
            "bed_temp_c": round(self.bed_temp_c, 1),
            "current_file": self.current_file,
            "time_remaining_sec": int(self.time_remaining_sec)
        }

class SmartLock(DeviceSimulator):
    def __init__(self):
        super().__init__("smart-lock-01", "Puerta Principal - Sala 402", "smart_lock", "smartlock.eth")
        self.location = "Puerta Principal - Sala 402"
        self.model = "August Wi-Fi Smart Lock Gen 4"
        
        # Dynamic state
        self.is_locked = True
        self.battery_level = 88.0
        self.last_unlocked_by = "0x123...abc"
        self.auto_lock_timer_sec = 0
        self.access_log_count = 12

    def update(self):
        super().update()
        # Battery drain
        self.battery_level = max(0, self.battery_level - 0.001)
        
        if not self.is_locked:
            if self.auto_lock_timer_sec > 0:
                self.auto_lock_timer_sec -= 5
            else:
                self.is_locked = True
                self.auto_lock_timer_sec = 0

    def _get_status_string(self) -> str:
        return "LOCKED" if self.is_locked else "UNLOCKED"

    def _get_telemetry(self) -> Dict[str, Any]:
        return {
            "is_locked": self.is_locked,
            "battery_level": f"{int(self.battery_level)}%",
            "last_unlocked_by": self.last_unlocked_by,
            "auto_lock_timer_sec": self.auto_lock_timer_sec,
            "access_log_count": self.access_log_count
        }

class VendingMachine(DeviceSimulator):
    def __init__(self):
        super().__init__("vending-machine-01", "Dispensador Hall", "vending_machine", "vendingmachine.eth")
        self.slots = 6
        self.products = ["Coke", "Water", "Snack"]
        
        # Dynamic state
        self.stock_level = {"A1": 5, "A2": 2, "B1": 8, "B2": 1, "C1": 10, "C2": 4}
        self.temperature_internal = 4.2
        self.last_dispensed = datetime.utcnow().isoformat()
        self.is_jammed = False

    def update(self):
        super().update()
        # Temp fluctuation
        self.temperature_internal = 4.2 + random.uniform(-0.3, 0.3)
        
        # Randomly simulate a purchase (very rare)
        if random.random() < 0.01:
            keys = list(self.stock_level.keys())
            slot = random.choice(keys)
            if self.stock_level[slot] > 0:
                self.stock_level[slot] -= 1
                self.last_dispensed = datetime.utcnow().isoformat()

    def _get_status_string(self) -> str:
        return "JAMMED" if self.is_jammed else "OK"

    def _get_telemetry(self) -> Dict[str, Any]:
        return {
            "stock_level": self.stock_level,
            "temperature_internal": round(self.temperature_internal, 1),
            "last_dispensed": self.last_dispensed,
            "is_jammed": self.is_jammed
        }

class SecurityCamera(DeviceSimulator):
    def __init__(self):
        super().__init__("camera-01", "Cámara Pasillo", "security_camera", "camera.eth")
        self.resolution = "1080p"
        self.codec = "H.264"
        
        # Dynamic state
        self.is_streaming = True
        self.active_viewers = 2
        self.bandwidth_usage_mbps = 4.5
        self.privacy_mode = False

    def update(self):
        super().update()
        
        if self.privacy_mode:
            self.bandwidth_usage_mbps = 0.1
            self.active_viewers = 0
        else:
            self.active_viewers = random.randint(0, 5)
            self.bandwidth_usage_mbps = 4.0 + (self.active_viewers * 0.5) + random.uniform(-0.2, 0.2)

    def _get_status_string(self) -> str:
        return "PRIVACY" if self.privacy_mode else "STREAMING"

    def _get_telemetry(self) -> Dict[str, Any]:
        return {
            "is_streaming": self.is_streaming,
            "active_viewers": self.active_viewers,
            "bandwidth_usage_mbps": round(self.bandwidth_usage_mbps, 1),
            "privacy_mode": "ON" if self.privacy_mode else "OFF"
        }
