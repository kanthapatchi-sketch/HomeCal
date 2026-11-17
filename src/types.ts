export type VehicleType = "ICE" | "EV";

export interface Vehicle {
  type: VehicleType;
  model: string;
  batteryCapacity?: number; // for EV in kWh
  batteryType?: "LFP" | "NMC" | "NCA"; // Battery Chemistry
  fuelCapacity?: number;    // for ICE in Liters
}

export interface FuelLog {
  id: string;
  type: "ICE";
  date: string;
  stationName: string;
  stationBranch?: string;
  fuelType: string;
  volumeLiters: number;
  pricePerLiter: number;
  totalAmount: number;
  odometerReading?: number;
  distanceKm?: number; // Distance driven since last fill
  tripA?: number;     // Trip A odometer in km
  tripB?: number;     // Trip B odometer in km
}

export interface ChargeLog {
  id: string;
  type: "EV";
  date: string;
  stationName: string;
  stationBranch?: string;
  chargerType: string; // AC, DC, Home
  energyKwh: number;
  totalAmount: number;
  odometerReading?: number;
  distanceKm?: number; // Distance driven since last charge
  tripA?: number;     // Trip A odometer in km
  tripB?: number;     // Trip B odometer in km
  startBatteryPct?: number; // Battery % at start of charge
  endBatteryPct?: number;   // Battery % at end of charge
}

export type EnergyLog = FuelLog | ChargeLog;

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TripLog {
  id: string;
  date: string;
  title: string;
  tripType: "A" | "B";
  distanceKm: number;
  odometerReading?: number;
  startOdometerReading?: number;
  notes?: string;
  startBatteryPct?: number; // EV Battery % at trip start
  endBatteryPct?: number;   // EV Battery % at trip end
  drivingMode?: "ECO" | "Comfort" | "Sport";
  // Route and Map visualization properties
  originName?: string;
  destinationName?: string;
  startCoords?: Coordinates;
  endCoords?: Coordinates;
  waypoints?: Coordinates[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface TouStation {
  id: string;
  stationCode: string; // e.g. "AE0007A1GP1C00089M"
  name: string;        // Station name or nickname
  offPeakRate?: number; // Off-Peak electricity rate (THB/kWh)
  onPeakRate?: number;  // On-Peak electricity rate (THB/kWh)
  notes?: string;
  isDefault?: boolean;
}

