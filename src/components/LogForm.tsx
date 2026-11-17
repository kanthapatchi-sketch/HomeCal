import React, { useState, useEffect } from "react";
import { Plus, Check, RefreshCw, Calendar, MapPin, Gauge, Zap, Settings, Sparkles } from "lucide-react";
import { FuelLog, ChargeLog, EnergyLog, VehicleType, TripLog, TouStation } from "../types";
import { getStoredTouStations, isTouStationMatch } from "./TouStationSettingsModal";

interface LogFormProps {
  vehicleType: VehicleType;
  scannedData: Partial<EnergyLog> | null;
  onSaveLog: (log: Omit<EnergyLog, "id">) => void;
  onClearScan: () => void;
  logs: EnergyLog[];
  tripLogs: TripLog[];
  onOpenTouSettings?: () => void;
  touStations?: TouStation[];
}

const EV_STATION_OPTIONS = [
  "EV Station PluZ",
  "EleXA / EleX by EGAT",
  "MEA EV",
  "PEA VOLTA",
  "Charge+ / ChargePlus",
  "Other",
];

export default function LogForm({ vehicleType, scannedData, onSaveLog, onClearScan, logs, tripLogs, onOpenTouSettings, touStations: propTouStations }: LogFormProps) {
  // Input fields state
  const [logType, setLogType] = useState<VehicleType>(vehicleType);
  const [date, setDate] = useState("");
  const [stationName, setStationName] = useState("");
  const [stationBranch, setStationBranch] = useState("");
  const [selectedEvNetwork, setSelectedEvNetwork] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState("");
  const [odometerReading, setOdometerReading] = useState("");

  // TOU Charger Auto-Detection State
  const [activeTouStations, setActiveTouStations] = useState<TouStation[]>([]);
  const [touDetectedInfo, setTouDetectedInfo] = useState<TouStation | null>(null);

  // ICE specific
  const [fuelType, setFuelType] = useState("Gasohol 95");
  const [volumeLiters, setVolumeLiters] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");

  // EV specific
  const [chargerType, setChargerType] = useState("DC Fast Charge");
  const [energyKwh, setEnergyKwh] = useState("");
  const [startBatteryPct, setStartBatteryPct] = useState("");
  const [endBatteryPct, setEndBatteryPct] = useState("");

  // Load TOU stations list from props or localStorage
  useEffect(() => {
    if (propTouStations && propTouStations.length > 0) {
      setActiveTouStations(propTouStations);
    } else {
      setActiveTouStations(getStoredTouStations());
    }
  }, [propTouStations]);

  // Keep selectedEvNetwork in sync with stationName when in EV mode
  useEffect(() => {
    if (logType === "EV") {
      if (EV_STATION_OPTIONS.includes(stationName)) {
        setSelectedEvNetwork(stationName);
      } else if (stationName) {
        setSelectedEvNetwork("Other");
      } else {
        setSelectedEvNetwork("");
      }
    }
  }, [stationName, logType]);

  // Handle EV Charging Station Dropdown Selection
  const handleEvNetworkSelect = (val: string) => {
    setSelectedEvNetwork(val);
    if (val === "Other") {
      if (EV_STATION_OPTIONS.slice(0, -1).includes(stationName)) {
        setStationName("");
      }
    } else if (val === "") {
      setStationName("");
    } else {
      setStationName(val);
      // และให้ขึ้นประเภท ⚡ DC Fast Charge (ชาร์จเร็ว) อัตโนมัติ แต่สามารถ แก้ไขได้
      setChargerType("DC Fast Charge");
    }
  };

  // Auto-detect TOU Charging Station (e.g., AE0007A1GP1C00089M)
  useEffect(() => {
    if (!stationName) {
      setTouDetectedInfo(null);
      return;
    }

    const matched = isTouStationMatch(stationName, activeTouStations);
    if (matched) {
      setTouDetectedInfo(matched);
      // Automatically switch to EV & Home Charger (TOU)
      setLogType("EV");
      setChargerType("Home Charger");
    } else {
      setTouDetectedInfo(null);
    }
  }, [stationName, activeTouStations]);


  // Draft States
  const [hasDraft, setHasDraft] = useState(false);

  // Track if user manually edited to prevent auto-suggest overrides while typing
  const [isOdometerEdited, setIsOdometerEdited] = useState(false);
  const [isStartBatteryEdited, setIsStartBatteryEdited] = useState(false);

  // Find the most recent odometer reading from either previous energy logs or travel logs
  const getSuggestedOdometer = (): number | null => {
    // Latest trip log with odometer
    const lastTripWithOdometer = tripLogs.find((t) => t.odometerReading !== undefined);
    const lastTripOdo = lastTripWithOdometer?.odometerReading;

    // Latest energy log with odometer
    const lastEnergyWithOdometer = logs.find((l) => l.odometerReading !== undefined);
    const lastEnergyOdo = lastEnergyWithOdometer?.odometerReading;

    if (lastTripOdo !== undefined && lastEnergyOdo !== undefined) {
      return Math.max(lastTripOdo, lastEnergyOdo);
    }
    return lastTripOdo !== undefined ? lastTripOdo : (lastEnergyOdo !== undefined ? lastEnergyOdo : null);
  };

  // Find the most recent end battery percentage from either previous energy logs (ChargeLog) or travel logs (TripLog)
  const getSuggestedStartBatteryPct = (): number | null => {
    // 1. Get all EV charge logs with endBatteryPct, sorted newest by date first, then by createdAt, then by odometer
    const evLogs = [...logs]
      .filter((l) => l.type === "EV" && (l as ChargeLog).endBatteryPct !== undefined)
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateB - dateA;
        
        // If dates are identical, use createdAt as a tie-breaker
        const createA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const createB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        if (createA !== createB) return createB - createA;
        
        // Fallback to odometer
        const odoA = a.odometerReading || 0;
        const odoB = b.odometerReading || 0;
        return odoB - odoA;
      }) as ChargeLog[];

    // 2. Get all trips with endBatteryPct, sorted newest by date first, then by createdAt, then by odometer
    const evTrips = [...tripLogs]
      .filter((t) => t.endBatteryPct !== undefined)
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateB - dateA;
        
        // If dates are identical, use createdAt as a tie-breaker
        const createA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const createB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        if (createA !== createB) return createB - createA;
        
        // Fallback to odometer
        const odoA = a.odometerReading || 0;
        const odoB = b.odometerReading || 0;
        return odoB - odoA;
      });

    const lastEnergy = evLogs[0];
    const lastTrip = evTrips[0];

    if (lastEnergy && lastTrip) {
      const energyTime = new Date(lastEnergy.date).getTime();
      const tripTime = new Date(lastTrip.date).getTime();
      
      if (energyTime > tripTime) {
        return lastEnergy.endBatteryPct!;
      } else if (tripTime > energyTime) {
        return lastTrip.endBatteryPct!;
      } else {
        // Equal dates! Let's do fine-grained tie-breaking
        // Tie-breaker 1: createdAt
        const energyCreate = (lastEnergy as any).createdAt ? new Date((lastEnergy as any).createdAt).getTime() : 0;
        const tripCreate = (lastTrip as any).createdAt ? new Date((lastTrip as any).createdAt).getTime() : 0;
        if (energyCreate !== tripCreate) {
          return energyCreate > tripCreate ? lastEnergy.endBatteryPct! : lastTrip.endBatteryPct!;
        }
        
        // Tie-breaker 2: odometerReading
        const energyOdo = lastEnergy.odometerReading || 0;
        const tripOdo = lastTrip.odometerReading || 0;
        if (energyOdo !== tripOdo) {
          return energyOdo > tripOdo ? lastEnergy.endBatteryPct! : lastTrip.endBatteryPct!;
        }
        
        // Tie-breaker 3: If trip.startBatteryPct === lastEnergy.endBatteryPct, trip happened after charge
        if (lastTrip.startBatteryPct === lastEnergy.endBatteryPct) {
          return lastTrip.endBatteryPct!;
        }
        
        // Tie-breaker 4: Default to the one that has a lower battery percentage (usually trip after charge)
        return lastTrip.endBatteryPct! < lastEnergy.endBatteryPct! ? lastTrip.endBatteryPct! : lastEnergy.endBatteryPct!;
      }
    }

    if (lastEnergy) return lastEnergy.endBatteryPct!;
    if (lastTrip) return lastTrip.endBatteryPct!;
    return null;
  };

  // Auto-prefill suggested odometer when logs/trips change and user has not manually edited yet
  useEffect(() => {
    if (!isOdometerEdited) {
      const suggestedOdo = getSuggestedOdometer();
      if (suggestedOdo !== null) {
        setOdometerReading(suggestedOdo.toString());
      }
    }
  }, [logs, tripLogs, isOdometerEdited]);

  // Auto-prefill suggested battery percentage when logs/trips change and user has not manually edited yet
  useEffect(() => {
    if (!isStartBatteryEdited) {
      const suggestedBattery = getSuggestedStartBatteryPct();
      if (suggestedBattery !== null) {
        setStartBatteryPct(suggestedBattery.toString());
      }
    }
  }, [logs, tripLogs, isStartBatteryEdited]);

  useEffect(() => {
    const savedDraft = localStorage.getItem("energy_log_draft");
    if (savedDraft) {
      setHasDraft(true);
    }
  }, []);

  const handleSaveDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    const draftData = {
      logType,
      date,
      stationName,
      stationBranch,
      totalAmount,
      odometerReading,
      fuelType,
      volumeLiters,
      pricePerLiter,
      chargerType,
      energyKwh,
      startBatteryPct,
      endBatteryPct,
    };
    localStorage.setItem("energy_log_draft", JSON.stringify(draftData));
    setHasDraft(true);
    alert("บันทึกแบบร่างสำเร็จ!");
  };

  const handleLoadDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    const savedDraft = localStorage.getItem("energy_log_draft");
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setLogType(draft.logType || "ICE");
        setDate(draft.date || "");
        setStationName(draft.stationName || "");
        setStationBranch(draft.stationBranch || "");
        setTotalAmount(draft.totalAmount || "");
        setOdometerReading(draft.odometerReading || "");
        setFuelType(draft.fuelType || "Gasohol 95");
        setVolumeLiters(draft.volumeLiters || "");
        setPricePerLiter(draft.pricePerLiter || "");
        setChargerType(draft.chargerType || "DC Fast Charge");
        setEnergyKwh(draft.energyKwh || "");
        setStartBatteryPct(draft.startBatteryPct || "");
        setEndBatteryPct(draft.endBatteryPct || "");
        alert("เรียกคืนข้อมูลแบบร่างเรียบร้อยแล้ว!");
      } catch (err) {
        console.error("Failed to load draft", err);
      }
    }
  };

  const handleClearDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem("energy_log_draft");
    setHasDraft(false);
    alert("ล้างแบบร่างเรียบร้อยแล้ว");
  };

  // Auto-fill values when scannedData changes or vehicleType changes
  useEffect(() => {
    if (scannedData) {
      setLogType(scannedData.type || vehicleType);
      setDate(scannedData.date || new Date().toISOString().split("T")[0]);
      setStationName(scannedData.stationName || "");
      setTotalAmount(scannedData.totalAmount?.toString() || "");

      if (scannedData.type === "EV") {
        const evData = scannedData as Partial<ChargeLog>;
        setChargerType(evData.chargerType || "DC Fast Charge");
        setEnergyKwh(evData.energyKwh?.toString() || "");
        setStartBatteryPct(evData.startBatteryPct?.toString() || "");
        setEndBatteryPct(evData.endBatteryPct?.toString() || "");
      } else {
        const iceData = scannedData as Partial<FuelLog>;
        setFuelType(iceData.fuelType || "Gasohol 95");
        setVolumeLiters(iceData.volumeLiters?.toString() || "");
        setPricePerLiter(iceData.pricePerLiter?.toString() || "");
      }

      if (scannedData.odometerReading !== undefined) {
        setOdometerReading(scannedData.odometerReading.toString());
      } else {
        const suggestedOdo = getSuggestedOdometer();
        setOdometerReading(suggestedOdo ? suggestedOdo.toString() : "");
      }

      setIsOdometerEdited(true);
      setIsStartBatteryEdited(true);
    } else {
      // Clean start or reset
      setLogType(vehicleType);
      setDate(new Date().toISOString().split("T")[0]);
      setStationName("");
      setStationBranch("");
      setTotalAmount("");
      setVolumeLiters("");
      setPricePerLiter("");
      setEnergyKwh("");
      
      const suggestedBattery = getSuggestedStartBatteryPct();
      setStartBatteryPct(suggestedBattery ? suggestedBattery.toString() : "");
      
      setEndBatteryPct("");
      
      const suggestedOdo = getSuggestedOdometer();
      setOdometerReading(suggestedOdo ? suggestedOdo.toString() : "");

      setIsOdometerEdited(false);
      setIsStartBatteryEdited(false);
    }
  }, [scannedData ? JSON.stringify(scannedData) : null, vehicleType]);

  // Handle dynamic mathematical calculations:
  // For ICE: Total Amount = Price * Volume. If user changes Price or Volume, update Total Amount.
  // Or vice-versa. Let's make it intuitive!
  const handleVolumeChange = (val: string) => {
    setVolumeLiters(val);
    const v = Number(val);
    const p = Number(pricePerLiter);
    if (v && p) {
      setTotalAmount((v * p).toFixed(2));
    }
  };

  const handlePriceChange = (val: string) => {
    setPricePerLiter(val);
    const p = Number(val);
    const v = Number(volumeLiters);
    if (v && p) {
      setTotalAmount((v * p).toFixed(2));
    }
  };

  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val);
    if (logType === "ICE") {
      const t = Number(val);
      const p = Number(pricePerLiter);
      const v = Number(volumeLiters);
      if (t && p) {
        setVolumeLiters((t / p).toFixed(2));
      } else if (t && v) {
        setPricePerLiter((t / v).toFixed(2));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !stationName || !totalAmount) {
      alert("กรุณากรอกข้อมูล วันที่, สถานี และ ยอดชำระรวม");
      return;
    }

    const finalStationName = stationBranch.trim()
      ? `${stationName.trim()} (${stationBranch.trim()})`
      : stationName.trim();

    const baseLog = {
      date,
      stationName: finalStationName,
      stationBranch: stationBranch.trim() || undefined,
      totalAmount: Number(totalAmount),
      odometerReading: odometerReading ? Number(odometerReading) : undefined,
    };

    if (logType === "ICE") {
      const fuelLog: Omit<FuelLog, "id"> = {
        ...baseLog,
        type: "ICE",
        fuelType,
        volumeLiters: Number(volumeLiters) || 0,
        pricePerLiter: Number(pricePerLiter) || 0,
      };
      onSaveLog(fuelLog);
    } else {
      const chargeLog: Omit<ChargeLog, "id"> = {
        ...baseLog,
        type: "EV",
        chargerType,
        energyKwh: Number(energyKwh) || 0,
        startBatteryPct: startBatteryPct ? Number(startBatteryPct) : undefined,
        endBatteryPct: endBatteryPct ? Number(endBatteryPct) : undefined,
      };
      onSaveLog(chargeLog);
    }

    // Reset Form fields
    setStationName("");
    setStationBranch("");
    setTotalAmount("");
    setVolumeLiters("");
    setPricePerLiter("");
    setEnergyKwh("");
    setStartBatteryPct("");
    setEndBatteryPct("");
    setOdometerReading("");
    setIsOdometerEdited(false);
    setIsStartBatteryEdited(false);
    onClearScan();

    // Clear draft on successful save
    localStorage.removeItem("energy_log_draft");
    setHasDraft(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 relative overflow-hidden">
      {scannedData && (
        <div className="absolute top-0 right-0 left-0 bg-indigo-50 text-indigo-800 text-xs px-4 py-2 font-semibold flex justify-between items-center border-b border-indigo-100">
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> ตรวจพบข้อมูลจาก AI OCR เรียบร้อยแล้ว! กรุณาตรวจสอบความถูกต้องด้านล่าง
          </span>
          <button
            onClick={onClearScan}
            className="hover:underline text-indigo-900 font-bold"
          >
            รีเซ็ต
          </button>
        </div>
      )}

      {hasDraft && (
        <div className="mb-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">📂</span>
            <div>
              <div className="font-bold text-amber-900 text-xs">พบข้อมูลแบบร่างที่ยังไม่บันทึก</div>
              <div className="text-[10px] text-amber-600 font-medium">คุณสามารถดึงข้อมูลแบบร่างล่าสุดกลับคืนมาทำงานต่อได้</div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
            <button
              onClick={handleLoadDraft}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              เรียกคืนข้อมูล
            </button>
            <button
              onClick={handleClearDraft}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200"
            >
              ล้างร่าง
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={scannedData ? "pt-6" : ""}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-slate-800 text-lg">
            {scannedData ? "🔍 ยืนยันข้อมูลสแกน" : "📝 บันทึกประวัติพลังงาน"}
          </h3>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setLogType("ICE");
                if (!scannedData) {
                  setVolumeLiters("");
                  setPricePerLiter("");
                }
              }}
              className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                logType === "ICE"
                  ? "bg-white text-indigo-950 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              รถน้ำมัน
            </button>
            <button
              type="button"
              onClick={() => {
                setLogType("EV");
                if (!scannedData) {
                   setEnergyKwh("");
                }
              }}
              className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                logType === "EV"
                  ? "bg-white text-indigo-950 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              รถไฟฟ้า EV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* วันที่บันทึก */}
          <div>
            <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">วันที่ตามใบเสร็จ</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* ชื่อสถานี */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                {logType === "ICE" ? "ปั๊มน้ำมัน / แบรนด์" : "สถานีชาร์จ / แบรนด์"}
              </label>
              {onOpenTouSettings && (
                <button
                  type="button"
                  onClick={onOpenTouSettings}
                  className="text-[10px] text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Settings className="w-3 h-3" /> ตั้งค่าสถานีชาร์จ TOU
                </button>
              )}
            </div>

            {logType === "EV" ? (
              <div className="space-y-2">
                {/* ดรอปดาวน์เพื่อเลือกสถานีชาร์จ */}
                <select
                  value={selectedEvNetwork}
                  onChange={(e) => handleEvNetworkSelect(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800 transition-all cursor-pointer"
                >
                  <option value="">-- เลือกสถานีชาร์จ --</option>
                  <option value="EV Station PluZ">EV Station PluZ</option>
                  <option value="EleXA / EleX by EGAT">EleXA / EleX by EGAT</option>
                  <option value="MEA EV">MEA EV</option>
                  <option value="PEA VOLTA">PEA VOLTA</option>
                  <option value="Charge+ / ChargePlus">Charge+ / ChargePlus</option>
                  <option value="Other">Other/อื่นๆ....... ให้ระบุ</option>
                </select>

                {/* ช่องระบุชื่อสถานีด้วยตนเอง (แสดงเมื่อเลือก Other หรือ มีการพิมพ์ระบุชื่อเฉพาะ) */}
                {(selectedEvNetwork === "Other" || (!EV_STATION_OPTIONS.includes(selectedEvNetwork) && selectedEvNetwork !== "")) && (
                  <div className="relative animate-in fade-in duration-150">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="ระบุชื่อสถานีชาร์จ เช่น ปั๊ม PTT บางนา, AE0007A..."
                      value={stationName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStationName(val);
                        if (EV_STATION_OPTIONS.includes(val)) {
                          setSelectedEvNetwork(val);
                        } else {
                          setSelectedEvNetwork("Other");
                        }
                      }}
                      className={`w-full pl-9 pr-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                        touDetectedInfo
                          ? "border-amber-400 bg-amber-50/30 focus:ring-amber-500 font-medium"
                          : "border-slate-200 focus:ring-indigo-500 focus:border-transparent"
                      }`}
                    />
                  </div>
                )}

                {/* ช่องระบุสาขาของสถานีชาร์จ */}
                <div className="relative animate-in fade-in duration-150">
                  <input
                    type="text"
                    placeholder="🏢 ระบุสาขา / สถานที่ (เช่น บางนา, ลาดพร้าว, ปั๊ม PTT รังสิต)"
                    value={stationBranch}
                    onChange={(e) => setStationBranch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400 bg-slate-50/50"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="เช่น PTT, Shell, Bangchak"
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🏢 ระบุสาขา / สถานที่ (ถ้ามี)"
                    value={stationBranch}
                    onChange={(e) => setStationBranch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400 bg-slate-50/50"
                  />
                </div>
              </div>
            )}

            {/* Quick TOU Station Select Chips */}
            {activeTouStations.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-400 font-bold">ปุ่มลัด TOU:</span>
                {activeTouStations.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setStationName(st.stationCode);
                      setSelectedEvNetwork("Other");
                      setLogType("EV");
                      setChargerType("Home Charger");
                    }}
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                      stationName === st.stationCode
                        ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800"
                    }`}
                  >
                    <Zap className="w-2.5 h-2.5 fill-current" /> {st.stationCode}
                  </button>
                ))}
              </div>
            )}

            {/* TOU Auto-detected Notification Banner */}
            {touDetectedInfo && (
              <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-300/80 rounded-xl p-2.5 text-xs text-amber-950 font-medium flex items-center justify-between shadow-2xs animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-amber-500 text-white rounded-lg text-[9px] font-black font-mono shadow-2xs">
                    ⚡ TOU AUTO
                  </span>
                  <span>
                    ตรวจพบสถานีชาร์จบ้าน TOU (<strong>{touDetectedInfo.stationCode}</strong>) &rarr; ตั้งเป็น <strong>Home Charger (TOU)</strong> อัตโนมัติ
                  </span>
                </div>
                {touDetectedInfo.offPeakRate && (
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-200/80 px-2 py-0.5 rounded-md shrink-0">
                    Off-Peak {touDetectedInfo.offPeakRate} บ./kWh
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ICE Specific fields */}
          {logType === "ICE" ? (
            <>
              <div>
                <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ประเภทน้ำมัน</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
                >
                  <option value="Gasohol 95">Gasohol 95</option>
                  <option value="Gasohol 91">Gasohol 91</option>
                  <option value="Gasohol E20">Gasohol E20</option>
                  <option value="Gasohol E85">Gasohol E85</option>
                  <option value="Benzene 95">Benzene 95 (เบนซินล้วน)</option>
                  <option value="Diesel B7">Diesel B7</option>
                  <option value="Diesel Premium">Diesel Premium</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ราคา (บาท/ลิตร)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={pricePerLiter}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ปริมาณ (ลิตร)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={volumeLiters}
                    onChange={(e) => handleVolumeChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </>
          ) : (
            // EV Specific fields
            <>
              <div>
                <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ประเภทตู้ชาร์จ</label>
                <select
                  value={chargerType}
                  onChange={(e) => setChargerType(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white font-medium ${
                    chargerType === "Home Charger" || chargerType.toLowerCase().includes("tou")
                      ? "border-amber-400 ring-2 ring-amber-400/20 text-amber-950 font-bold"
                      : "border-slate-200 focus:ring-indigo-500"
                  }`}
                >
                  <option value="Home Charger">⚡ Home Charger (TOU) - ไฟบ้าน TOU</option>
                  <option value="Home Charger (Normal)">🏠 Home Charger (Normal) - ไฟบ้านปกติ</option>
                  <option value="DC Fast Charge">⚡ DC Fast Charge (ชาร์จเร็ว)</option>
                  <option value="AC Normal Charge">🔌 AC Normal Charge (ชาร์จปกติ)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">หน่วยไฟที่ชาร์จ (kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={energyKwh}
                  onChange={(e) => setEnergyKwh(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider">แบตเตอรี่เริ่มต้น (%)</label>
                    {getSuggestedStartBatteryPct() !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setStartBatteryPct(getSuggestedStartBatteryPct()!.toString());
                          setIsStartBatteryEdited(false);
                        }}
                        className="text-[9px] sm:text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-all cursor-pointer border border-indigo-150"
                        title="คลิกเพื่อป้อนแบตเตอรี่เริ่มต้นที่แนะนำ"
                      >
                        💡 แนะนำ: {getSuggestedStartBatteryPct()}%
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="เช่น 20"
                    value={startBatteryPct}
                    onChange={(e) => {
                      setStartBatteryPct(e.target.value);
                      setIsStartBatteryEdited(true);
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">แบตเตอรี่หลังชาร์จ (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="เช่น 80"
                    value={endBatteryPct}
                    onChange={(e) => setEndBatteryPct(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </>
          )}

          {/* ยอดเงินรวม */}
          <div>
            <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ยอดจ่ายรวม (บาท)</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) => handleTotalAmountChange(e.target.value)}
              className="w-full px-3 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-800"
            />
          </div>

          {/* เลขไมล์ (Odometer) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-slate-400" /> เลขไมล์ปัจจุบัน (กม.)
              </label>
              {getSuggestedOdometer() !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setOdometerReading(getSuggestedOdometer()!.toString());
                    setIsOdometerEdited(false);
                  }}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-all cursor-pointer border border-indigo-150"
                  title="คลิกเพื่อป้อนเลขไมล์ที่แนะนำโดยอัตโนมัติ"
                >
                  💡 แนะนำ: {getSuggestedOdometer()!.toLocaleString()} กม.
                </button>
              )}
            </div>
            <input
              type="number"
              placeholder="เช่น 45020"
              value={odometerReading}
              onChange={(e) => {
                setOdometerReading(e.target.value);
                setIsOdometerEdited(true);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200 shadow-2xs"
          >
            💾 เซฟดราฟต์ข้อมูล
          </button>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {scannedData ? "ยืนยันและบันทึกข้อมูล" : "บันทึกข้อมูลใช้พลังงาน"}
          </button>
        </div>
      </form>
    </div>
  );
}
