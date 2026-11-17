import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  Zap,
  TrendingDown,
  Info,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Activity,
  Calendar,
  Gauge,
  HelpCircle,
  Plus,
  RefreshCw,
  Car,
} from "lucide-react";
import { EnergyLog, Vehicle } from "../types";
import { StationBadgeCell } from "../utils/stationBadges";

interface BatteryHealthDashboardProps {
  logs: EnergyLog[];
  vehicle: Vehicle;
  setLogs: React.Dispatch<React.SetStateAction<EnergyLog[]>>;
  setVehicle: React.Dispatch<React.SetStateAction<Vehicle>>;
  initialTab?: "analysis" | "history" | "tips" | "charge100";
}

export default function BatteryHealthDashboard({
  logs,
  vehicle,
  setLogs,
  setVehicle,
  initialTab,
}: BatteryHealthDashboardProps) {
  const [activeTab, setActiveTab] = useState<"analysis" | "history" | "tips" | "charge100">(initialTab || "analysis");
  const [charge100Analysis, setCharge100Analysis] = useState<any>(null);
  const [loading100, setLoading100] = useState(false);
  const [error100, setError100] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState("");

  // Sync with initialTab from parent
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Load cached analysis on mount
  React.useEffect(() => {
    const cached = localStorage.getItem("ai_charge_100_analysis");
    if (cached) {
      try {
        setCharge100Analysis(JSON.parse(cached));
      } catch (e) {
        // ignore cached parse error
      }
    }
  }, []);

  const handleAnalyze100 = async () => {
    setLoading100(true);
    setError100(null);
    try {
      let tLogs = [];
      const savedTrips = localStorage.getItem("trip_logs");
      if (savedTrips) {
        tLogs = JSON.parse(savedTrips);
      }

      // Find last known battery percentage
      const sorted = [...logs]
        .filter((l) => l.type === "EV")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastBatteryPct = sorted[0]?.endBatteryPct !== undefined ? sorted[0].endBatteryPct : 100;

      const response = await fetch("/api/analyze-charge-100", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle,
          logs,
          tripLogs: tLogs,
          currentBatteryPct: lastBatteryPct,
          userNotes: userNotes.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "ขออภัย ระบบบริการวิเคราะห์ AI ขัดข้องชั่วคราว");
      }

      const resData = await response.json();
      if (resData.status === "success") {
        setCharge100Analysis(resData.analysis);
        localStorage.setItem("ai_charge_100_analysis", JSON.stringify(resData.analysis));
      } else {
        throw new Error(resData.error || "การวิเคราะห์ล้มเหลว");
      }
    } catch (err: any) {
      setError100(err.message || "เกิดข้อผิดพลาดในการติดต่อระบบวิเคราะห์");
    } finally {
      setLoading100(false);
    }
  };

  // Auto trigger analysis if tab is charge100 and no cache is present
  React.useEffect(() => {
    if (activeTab === "charge100" && !charge100Analysis && !loading100) {
      handleAnalyze100();
    }
  }, [activeTab]);

  // Filter EV charge logs that have necessary battery percentage information
  const evChargeLogs = logs.filter(
    (log) =>
      log.type === "EV" &&
      log.startBatteryPct !== undefined &&
      log.endBatteryPct !== undefined &&
      log.endBatteryPct > log.startBatteryPct &&
      log.energyKwh > 0
  ) as any[];

  // Sort logs by date / odometer chronologically
  const sortedChargeLogs = [...evChargeLogs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const nominalCapacity = vehicle.batteryCapacity || 60; // default to 60 kWh if not specified

  // Calculate degradation data points
  // EV charging has an efficiency loss of 8-15% (heat loss in OBC / charger).
  // We assume a net efficiency factor of 90% (or we can estimate the battery capacity directly).
  // Net Capacity = (Energy Delivered * 100 / Percentage Added) * Efficiency
  const EFFICIENCY_FACTOR = 0.90; // Standard charging efficiency factor for AC/DC chargers (energy that actually enters cells)

  let emaSoh = 100;
  const alpha = 0.3; // Smoothing factor for Exponential Moving Average

  const dashboardPoints = sortedChargeLogs.map((log, index) => {
    const pctDiff = log.endBatteryPct - log.startBatteryPct;
    // Estimate gross capacity first
    const rawEstCapacity = (log.energyKwh * 100) / pctDiff;
    // Adjust with the standard charging efficiency factor to get estimated net battery capacity
    const netEstCapacity = rawEstCapacity * EFFICIENCY_FACTOR;
    const rawSoh = (netEstCapacity / nominalCapacity) * 100;

    // Limit SOH to realistic boundaries (e.g., 70% to 105%) to handle anomalies or rounding mistakes in individual entries
    const cappedRawSoh = Math.min(105, Math.max(70, rawSoh));

    // Calculate smoothed SOH via Exponential Moving Average (EMA) to show a beautiful, clean degradation curve
    if (index === 0) {
      emaSoh = cappedRawSoh;
    } else {
      emaSoh = alpha * cappedRawSoh + (1 - alpha) * emaSoh;
    }

    return {
      id: log.id,
      date: log.date,
      dateStr: new Date(log.date).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      odometer: log.odometerReading || 0,
      rawSoh: Number(cappedRawSoh.toFixed(1)),
      soh: Number(emaSoh.toFixed(1)),
      estimatedCapacity: Number((nominalCapacity * (emaSoh / 100)).toFixed(1)),
      energyKwh: log.energyKwh,
      chargeRange: `${log.startBatteryPct}% → ${log.endBatteryPct}%`,
      pctAdded: pctDiff,
      stationName: log.stationName || "สถานีทั่วไป",
      chargerType: log.chargerType || "AC Charge",
    };
  });

  // Calculate key metrics
  const totalCharges = sortedChargeLogs.length;
  const hasEnoughData = totalCharges >= 2;

  const currentSoh = hasEnoughData ? dashboardPoints[dashboardPoints.length - 1].soh : 100;
  const currentCapacity = hasEnoughData ? dashboardPoints[dashboardPoints.length - 1].estimatedCapacity : nominalCapacity;
  const totalCapacityLoss = nominalCapacity - currentCapacity;
  const totalCapacityLossPct = 100 - currentSoh;

  // DC vs AC charging analysis
  const dcCharges = sortedChargeLogs.filter((log) => log.chargerType?.includes("DC")).length;
  const acCharges = totalCharges - dcCharges;
  const dcRatio = totalCharges > 0 ? (dcCharges / totalCharges) * 100 : 0;

  let batteryCareRating = "ดีเยี่ยม";
  let batteryCareDesc = "เน้นชาร์จช้ากระแสสลับ (AC) ช่วยยืดอายุการใช้งานและลดความร้อนสะสมของแบตเตอรี่ได้ดีที่สุด";
  let ratingColor = "text-emerald-600 bg-emerald-50 border-emerald-100";

  if (dcRatio > 65) {
    batteryCareRating = "ควรเฝ้าระวัง";
    batteryCareDesc = "มีการชาร์จเร็ว DC Fast Charge สัดส่วนสูง แนะนำสลับชาร์จแบบ AC ช้าบ้างเพื่อรักษาสมดุลแรงดันในเซลล์แบตเตอรี่";
    ratingColor = "text-amber-600 bg-amber-50 border-amber-100";
  } else if (dcRatio > 35) {
    batteryCareRating = "ดีตามมาตรฐาน";
    batteryCareDesc = "สัดส่วนชาร์จเร็วชาร์จช้ามีความสมดุล แบตเตอรี่เสื่อมสภาพตามมาตรฐานการใช้งานปกติ";
    ratingColor = "text-indigo-600 bg-indigo-50 border-indigo-100";
  }

  // Calculate degradation rate per 10,000 km
  let degradationRatePer10k = 0;
  let remainingKmTo70 = 0;
  let hasOdoData = false;

  if (hasEnoughData) {
    const firstPoint = dashboardPoints[0];
    const lastPoint = dashboardPoints[dashboardPoints.length - 1];
    const odometerDiff = lastPoint.odometer - firstPoint.odometer;
    const sohDiff = firstPoint.soh - lastPoint.soh;

    if (odometerDiff > 1000 && sohDiff > 0.1) {
      hasOdoData = true;
      degradationRatePer10k = (sohDiff / odometerDiff) * 10000;
      // Calculate remaining km to hit 70% SOH (standard warranty end-of-life)
      const remainingSohCapacity = lastPoint.soh - 70;
      remainingKmTo70 = (remainingSohCapacity / sohDiff) * odometerDiff;
    }
  }

  // Helper to switch vehicle type to EV
  const handleSwitchToEV = () => {
    const updatedVehicle: Vehicle = {
      type: "EV",
      model: vehicle.model.includes("EV") ? vehicle.model : `${vehicle.model} EV`,
      batteryCapacity: 60,
    };
    setVehicle(updatedVehicle);
    localStorage.setItem("vehicle_profile", JSON.stringify(updatedVehicle));
    alert("เปลี่ยนโปรไฟล์รถเป็นรถยนต์ไฟฟ้า (EV) ความจุแบตเตอรี่ 60 kWh สำเร็จแล้ว!");
  };

  // Generate 15 Mock Charge Logs with gradual degradation
  const handleAddMockLogs = () => {
    const baseDate = new Date();
    const mockLogs: EnergyLog[] = [];
    const nominalCap = 60; // 60 kWh battery
    
    // Stations list
    const stations = [
      { name: "PEA Volta Highway", type: "DC Fast Charge" },
      { name: "PTT EV Station Pluz", type: "DC Fast Charge" },
      { name: "Home Charger TOU", type: "Home Charger (TOU)" },
      { name: "EA Anywhere Super Charge", type: "DC Fast Charge" },
      { name: "Evolt Charge Station", type: "AC Normal Charge" },
      { name: "PTT EV Station Pluz", type: "DC Fast Charge" },
      { name: "Home Charger TOU", type: "Home Charger (TOU)" },
      { name: "MG Super Charge", type: "DC Fast Charge" },
      { name: "PEA Volta City", type: "DC Fast Charge" },
      { name: "Home Charger TOU", type: "Home Charger (TOU)" },
      { name: "Evolt AC Tower", type: "AC Normal Charge" },
      { name: "PTT EV Station Pluz", type: "DC Fast Charge" },
      { name: "Home Charger TOU", type: "Home Charger (TOU)" },
      { name: "EA Anywhere Mall", type: "AC Normal Charge" },
      { name: "Home Charger TOU", type: "Home Charger (TOU)" },
    ];

    // Generate logs over the past 12 months with decaying capacity
    // SOH will degrade from 100.0% down to 94.2% smoothly
    for (let i = 0; i < 15; i++) {
      const monthsAgo = 12 - (i * 0.8);
      const date = new Date(baseDate.getTime() - monthsAgo * 30 * 24 * 60 * 60 * 1000);
      const odometer = 1500 + i * 2100 + Math.floor(Math.random() * 400);
      
      // Calculate SOH at this point (simulated degradation)
      // Exponential decay: initially faster, then slows down
      const soh = 100 - (2.2 * Math.pow((odometer / 31000), 0.75)) - (i * 0.2) + (Math.random() * 0.2 - 0.1);
      const actualCapacity = nominalCap * (soh / 100);
      
      // Charge bounds
      const startPct = [20, 15, 30, 10, 25, 20, 35, 15, 10, 40, 20, 15, 30, 25, 15][i];
      const endPct = [80, 90, 100, 85, 90, 80, 90, 85, 100, 80, 90, 85, 100, 95, 80][i];
      const pctDiff = endPct - startPct;
      
      // Calculate delivered energy based on current capacity & charger efficiency loss
      // delivered_energy = capacity_needed / efficiency
      const netEnergyNeeded = (actualCapacity * pctDiff) / 100;
      const energyKwh = Number((netEnergyNeeded / EFFICIENCY_FACTOR).toFixed(2));
      
      const station = stations[i];
      const isDC = station.type.includes("DC");
      const pricePerKwh = isDC ? 7.5 : 4.5;
      const totalAmount = Math.round(energyKwh * pricePerKwh);

      const mockLog: EnergyLog = {
        id: `mock-ev-charge-${i}-${Date.now()}`,
        type: "EV",
        date: date.toISOString().split("T")[0],
        stationName: station.name,
        chargerType: station.type,
        energyKwh,
        totalAmount,
        odometerReading: odometer,
        startBatteryPct: startPct,
        endBatteryPct: endPct,
        distanceKm: i > 0 ? odometer - mockLogs[i - 1].odometerReading! : 200,
        createdAt: new Date(date.getTime() + i * 1000).toISOString(),
      } as any;
      mockLogs.push(mockLog);
    }

    // Append and save
    setLogs((prev) => {
      // Filter out previous mocks if any to prevent clutter
      const filtered = prev.filter((l) => !l.id.startsWith("mock-ev-charge-"));
      const combined = [...filtered, ...mockLogs];
      localStorage.setItem("energy_logs", JSON.stringify(combined));
      return combined;
    });

    // Make sure the vehicle type is EV to display charts
    if (vehicle.type !== "EV") {
      const updatedVehicle: Vehicle = {
        type: "EV",
        model: vehicle.model.includes("EV") ? vehicle.model : `${vehicle.model} EV`,
        batteryCapacity: 60,
      };
      setVehicle(updatedVehicle);
      localStorage.setItem("vehicle_profile", JSON.stringify(updatedVehicle));
    }

    alert("สร้างรายการเติมพลังงานและชาร์จแบตเตอรี่จำลองจำนวน 15 รายการ สำเร็จแล้ว! กราฟสุขภาพแบตเตอรี่ประมวลผลพร้อมใช้งานแล้ว");
  };

  const handleClearMockLogs = () => {
    setLogs((prev) => {
      const filtered = prev.filter((l) => !l.id.startsWith("mock-ev-charge-"));
      localStorage.setItem("energy_logs", JSON.stringify(filtered));
      return filtered;
    });
    alert("ล้างข้อมูลจำลองเสร็จเรียบร้อยแล้ว");
  };

  const hasMockLogs = logs.some((l) => l.id.startsWith("mock-ev-charge-"));

  // Check if current vehicle is NOT EV
  if (vehicle.type !== "EV") {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center space-y-6">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-base">ระบบวิเคราะห์สุขภาพแบตเตอรี่ (SOH Dashboard)</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              ฟีเจอร์นี้ออกแบบขึ้นมาเฉพาะสำหรับรถยนต์ไฟฟ้า 100% (EV) และระบบไฮบริดเสียบปลั๊ก (PHEV) เท่านั้น เพื่อติดตามความเสื่อมสภาพของเซลล์แบตเตอรี่เทียบกับระยะทางสะสม
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleSwitchToEV}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
            >
              <Car className="w-4 h-4" /> เปลี่ยนรถคุณเป็นระบบไฟฟ้า (EV)
            </button>
            <button
              onClick={handleAddMockLogs}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-amber-400" /> สร้างรถและข้อมูลชาร์จจำลอง
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if there are no charge logs or insufficient logs for rendering
  if (!hasEnoughData) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center space-y-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Activity className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-800 text-base">ต้องการข้อมูลชาร์จมากกว่านี้สำหรับการวิเคราะห์</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              เพื่อคำนวณและพล็อตกราฟการเสื่อมของสุขภาพแบตเตอรี่ (SOH) ระบบต้องการบันทึกประวัติการชาร์จรถไฟฟ้าที่มีการระบุเปอร์เซ็นต์ <span className="font-bold text-slate-700">🔋 แบตเตอรี่ก่อนชาร์จ</span> และ <span className="font-bold text-slate-700">🔋 แบตเตอรี่หลังชาร์จ</span> อย่างน้อย <span className="font-bold text-indigo-600">2 รายการ</span> ขึ้นไป
            </p>
          </div>

          <div className="bg-white border border-slate-150 rounded-2xl p-4 text-left space-y-2">
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">วิธีการกรอกข้อมูลที่ถูกต้อง:</span>
            <ul className="text-slate-500 text-[11px] list-disc list-inside space-y-1.5 font-medium leading-relaxed">
              <li>ใช้แบบฟอร์มด้านบนในแถบรายการชาร์จรถยนต์ไฟฟ้า</li>
              <li>ระบุเปอร์เซ็นต์แบตเตอรี่ เช่น ชาร์จจาก <strong className="text-slate-700">20%</strong> ไปถึง <strong className="text-slate-700">80%</strong></li>
              <li>ระบุปริมาณไฟฟ้าที่เติมเข้าไปจริงเป็นหน่วย <strong className="text-slate-700">kWh (หน่วยไฟ)</strong> เช่น <strong className="text-slate-700">38.4 kWh</strong></li>
              <li>ระบุ <strong className="text-slate-700">เลขไมล์ (Odometer)</strong> เสมอ เพื่อการพล็อตสถิติเปรียบเทียบระยะวิ่งสะสม</li>
            </ul>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleAddMockLogs}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" /> โหลดชุดข้อมูลการชาร์จจำลองเพื่อทดสอบระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation inside Dashboard */}
      <div className="flex border-b border-slate-100 pb-3 gap-4 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("analysis")}
          className={`font-bold text-xs pb-1 px-1 transition-all flex items-center gap-1.5 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === "analysis"
              ? "border-indigo-600 text-indigo-950"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" /> วิเคราะห์การเสื่อมสภาพ
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`font-bold text-xs pb-1 px-1 transition-all flex items-center gap-1.5 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === "history"
              ? "border-indigo-600 text-indigo-950"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> ประวัติประเมินความจุ
        </button>
        <button
          onClick={() => setActiveTab("tips")}
          className={`font-bold text-xs pb-1 px-1 transition-all flex items-center gap-1.5 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === "tips"
              ? "border-indigo-600 text-indigo-950"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" /> เคล็ดลับถนอมแบตเตอรี่
        </button>
        <button
          onClick={() => setActiveTab("charge100")}
          className={`font-bold text-xs pb-1 px-1 transition-all flex items-center gap-1.5 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === "charge100"
              ? "border-indigo-600 text-indigo-950"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> รอบชาร์จเต็ม 100% (AI)
        </button>
      </div>

      {activeTab === "analysis" && (
        <div className="space-y-6">
          {/* Top Row: Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Metric 1: SOH */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                สุขภาพแบตเตอรี่ (SOH)
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800">{currentSoh}%</span>
                <span className="text-[10px] text-emerald-600 font-bold">หมวดหมู่ดี</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">จากความจุเริ่มต้นเดิม</span>
            </div>

            {/* Metric 2: Net Capacity */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                ความจุแบตเตอรี่จริง
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800">{currentCapacity}</span>
                <span className="text-xs font-bold text-slate-500">kWh</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">จากพิกัดเต็มเดิม {nominalCapacity} kWh</span>
            </div>

            {/* Metric 3: Total Lost */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                ความจุที่เสื่อมสภาพไป
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-rose-600">-{totalCapacityLoss.toFixed(1)}</span>
                <span className="text-xs font-bold text-rose-500">kWh</span>
              </div>
              <span className="text-[10px] text-rose-500 font-bold">-{totalCapacityLossPct.toFixed(1)}% เสื่อมลงสะสม</span>
            </div>

            {/* Metric 4: DC Charging Ratio */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                อัตราชาร์จด่วน (DC Ratio)
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800">{Math.round(dcRatio)}%</span>
                <span className="text-[10px] text-slate-400">ของ {totalCharges} ครั้ง</span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold">ชาร์จ DC {dcCharges} / AC {acCharges} ครั้ง</span>
            </div>
          </div>

          {/* Degradation Chart Card */}
          <div className="bg-white border border-slate-150 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-indigo-600" /> กราฟประเมินการเสื่อมสภาพสุขภาพแบตเตอรี่ (SOH)
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  จุดกลมสีน้ำเงินแสดงค่าดิบจากการประเมินรายครั้ง เส้นทึบสีน้ำเงินแสดงแนวโน้มเสื่อมจริงที่หักล้างสัญญาณรบกวนแล้ว (%)
                </p>
              </div>
              <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg text-[10px] text-indigo-700 font-bold font-mono shrink-0">
                <Gauge className="w-3 h-3" /> แกนนอน: เลขไมล์สะสม (กิโลเมตร)
              </div>
            </div>

            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dashboardPoints}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="odometer"
                    tickFormatter={(v) => `${v.toLocaleString()} กม.`}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    type="number"
                    domain={["dataMin", "dataMax"]}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    domain={[70, 105]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-slate-150 p-3 rounded-xl shadow-lg space-y-1 text-xs">
                            <p className="font-bold text-slate-800">{data.dateStr}</p>
                            <p className="text-slate-500">
                              เลขไมล์: <span className="font-bold text-slate-700 font-mono">{data.odometer.toLocaleString()} กม.</span>
                            </p>
                            <p className="text-slate-500">
                              ปริมาณชาร์จ: <span className="font-bold text-slate-700 font-mono">{data.chargeRange} ({data.energyKwh} kWh)</span>
                            </p>
                            <p className="text-slate-500">
                              ตู้ชาร์จ: <span className="font-semibold text-indigo-600">{data.stationName} ({data.chargerType})</span>
                            </p>
                            <div className="pt-1.5 border-t border-slate-100 flex justify-between gap-4">
                              <span className="text-slate-400">ประเมินรายครั้ง: <strong className="text-slate-700">{data.rawSoh}%</strong></span>
                              <span className="text-indigo-600 font-bold font-sans">สุขภาพเฉลี่ย: {data.soh}%</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rawSoh"
                    name="ค่าดิบประเมินรายครั้ง"
                    stroke="#818cf8"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={{ r: 3, fill: "#4f46e5" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="soh"
                    name="สุขภาพแบตเตอรี่เฉลี่ย (SOH %)"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Intelligence Hub and Advanced Diagnostic Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Charger Health Impact and Care Rating */}
            <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
              <div className="flex flex-col space-y-1">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> ดัชนีการดูแลและประเมินพฤติกรรมการชาร์จ
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  วิเคราะห์ผลกระทบของประเภทตู้ชาร์จพลังงานที่เลือกใช้งานต่อเซลล์แบตเตอรี่
                </p>
              </div>

              <div className={`p-3.5 rounded-xl border flex flex-col gap-2 ${ratingColor}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider">คะแนนการชาร์จถนอมเซลล์</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-white/60 uppercase">{batteryCareRating}</span>
                </div>
                <p className="text-[11px] leading-relaxed font-semibold">
                  {batteryCareDesc}
                </p>
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed space-y-1 bg-white p-3 rounded-xl border border-slate-150">
                <span className="font-bold text-slate-700 block mb-0.5">💡 คำแนะนำเสริมอัจฉริยะ:</span>
                การนำพารถเข้าชาร์จด้วย DC Fast Charge จากเปอร์เซ็นต์ที่ต่ำจัดไปถึง 100% บ่อยครั้งจะทำให้เกิดแรงดันสะสมความร้อนสูง หากจำกัดการชาร์จเร็วให้อยู่ในช่วง <strong className="text-indigo-600">20% - 80%</strong> จะเป็นประโยชน์สูงสุดในการถนอมโครงสร้างเคมีแบตเตอรี่
              </div>
            </div>

            {/* AI Lifespan remaining prediction */}
            <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> การประเมินอายุการใช้งานแบตเตอรี่ที่เหลือ
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  ใช้โมเดลวิเคราะห์ความสัมพันธ์ระยะทางสะสมเพื่อคำนวณอัตราเสื่อมและทำนายระยะวิ่ง
                </p>
              </div>

              {hasOdoData ? (
                <div className="space-y-3">
                  <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] text-indigo-700 font-bold uppercase tracking-wider">
                      <span>อัตราการเสื่อมสภาพเฉลี่ย:</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-150">-{degradationRatePer10k.toFixed(2)}% / 10,000 กม.</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-800 font-bold text-sm">
                      <span>ระยะทางคาดการณ์จนถึง 70% SOH:</span>
                      <span className="text-indigo-700 font-black font-mono">~{Math.round(remainingKmTo70).toLocaleString()} กม.</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed bg-white p-3 rounded-xl border border-slate-150">
                    <span className="font-bold text-slate-700 block">📊 โมเดลคณิตศาสตร์ทำนาย:</span>
                    ประเมินว่ารถของคุณจะมีระยะทางรวมสะสมประมาณ <strong className="text-slate-800">{(Math.round(dashboardPoints[dashboardPoints.length - 1].odometer + remainingKmTo70)).toLocaleString()} กม.</strong> ก่อนที่แบตเตอรี่จะเหลือความจุน้อยกว่า 70% ซึ่งถือเป็นช่วงประสิทธิภาพคุ้มทุนของแบตเตอรี่ลิเทียมยานยนต์
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-4 bg-white border border-slate-150 rounded-xl space-y-1">
                  <Gauge className="w-6 h-6 text-slate-300" />
                  <span className="text-[11px] font-bold text-slate-600">รอประเมินอัตราเสื่อมเฉลี่ย</span>
                  <span className="text-[10px] text-slate-400 max-w-[220px]">
                    ต้องการประวัติที่ระบุระยะทางวิ่งห่างกันอย่างน้อย 1,000 กม. เพื่อคำนวณแนวโน้มอายุการใช้งานแบตเตอรี่
                  </span>
                </div>
              )}

              {/* Utility action footer to clean simulated logs */}
              {hasMockLogs && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-[9px] text-amber-600 font-bold">⚠️ แสดงผลข้อมูลการชาร์จจำลอง (Mock Data Active)</span>
                  <button
                    onClick={handleClearMockLogs}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <RefreshCw className="w-3 h-3" /> ล้างประวัติจำลอง
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-slate-800 text-sm">ประวัติสรุปการตรวจวัดแบตเตอรี่รายรอบการชาร์จ</h4>
            <span className="text-xs text-slate-400">พบ {dashboardPoints.length} รายการวิเคราะห์ที่สมบูรณ์</span>
          </div>

          <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">ตู้บริการ / สถานี</th>
                  <th className="px-4 py-3">ประเภทชาร์จ</th>
                  <th className="px-4 py-3 text-right">เลขไมล์ (กม.)</th>
                  <th className="px-4 py-3 text-center">ระดับแบตเตอรี่</th>
                  <th className="px-4 py-3 text-right">พลังงานชาร์จ (kWh)</th>
                  <th className="px-4 py-3 text-right text-indigo-700">ประเมิน SOH</th>
                  <th className="px-4 py-3 text-right text-indigo-700">SOH เฉลี่ย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboardPoints.map((pt, i) => (
                  <tr key={pt.id} className="hover:bg-slate-50/50 transition-colors font-medium">
                    <td className="px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap align-top">
                      {pt.date}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <StationBadgeCell
                        stationName={pt.stationName}
                        logType="EV"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 align-top whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                        pt.chargerType.includes("DC")
                          ? "bg-amber-50 text-amber-700 border border-amber-200/80"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                      }`}>
                        <Zap className="w-2.5 h-2.5" />
                        {pt.chargerType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">
                      {pt.odometer.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-600">
                      {pt.chargeRange} (+{pt.pctAdded}%)
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">
                      {pt.energyKwh.toFixed(1)} kWh
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-500">
                      {pt.rawSoh}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-600">
                      {pt.soh}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "tips" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-150 bg-white rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 text-indigo-600">
              🔋 กฎเหล็กถนอมแบตเตอรี่รถยนต์ไฟฟ้า 100% (SOH Care Guidelines)
            </h4>
            <div className="space-y-3 text-xs text-slate-600 font-medium leading-relaxed">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <span className="font-bold text-slate-800 block mb-0.5">1. หลีกเลี่ยงระดับแบตเตอรี่สุดขั้ว (Rule of 20-80)</span>
                การรักษาระดับแบตเตอรี่ให้อยู่ระหว่าง <strong className="text-indigo-600">20% - 80%</strong> ในการใช้งานชีวิตประจำวัน จะช่วยลดความเครียดภายในเซลล์และการเสื่อมสภาพของขั้วแอโนดได้ดีที่สุด
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <span className="font-bold text-slate-800 block mb-0.5">2. เลี่ยงจอดรถทิ้งไว้เมื่อแบตเตอรี่เต็ม 100% หรือ 0%</span>
                การจอดรถทิ้งไว้นานกว่า 24 ชั่วโมงที่มีกระแสไฟฟ้าแรงดันสูง 100% (หรือต่ำสุดขีด 0%) จะเร่งให้แบตเตอรี่เกิดการสึกกร่อนทางเคมีและสูญเสียลิเทียมไอออนอย่างถาวร
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <span className="font-bold text-slate-800 block mb-0.5">3. ให้ความสำคัญกับ AC Charge ประจำสัปดาห์</span>
                การชาร์จกระแสสลับ AC ช้าๆ ข้ามคืนอย่างน้อยอาทิตย์ละครั้ง จะเอื้อประโยชน์ให้ระบบจัดการแบตเตอรี่ (BMS) ได้ทำกระบวนการบาลานซ์เซลล์แรงดันให้อยู่ในระดับเท่ากันทุกประจุ
              </div>
            </div>
          </div>

          <div className="border border-slate-150 bg-white rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 text-amber-600">
              ⚠️ ปัจจัยแวดล้อมที่กระตุ้นให้แบตเตอรี่เสื่อมเร็วขึ้น
            </h4>
            <div className="space-y-3 text-xs text-slate-600 font-medium leading-relaxed">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <span className="font-bold text-slate-800 block mb-0.5">1. ความร้อนและอุณหภูมิแวดล้อมสูง</span>
                การจอดรถตากแดดกลางแจ้งจัดของประเทศไทยบ่อยครั้ง จะทำให้แบตเตอรี่มีความร้อนสะสมเคมีเร่งปฏิกิริยาเสื่อมตัวเร็วขึ้น หากเลือกได้ควรจอดในที่ร่มหรืออาคารจอดรถเสมอ
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <span className="font-bold text-slate-800 block mb-0.5">2. การใช้ DC Fast Charge ซ้ำต่อเนื่อง</span>
                การเดินทางไกลที่ชาร์จตู้ชาร์จเร็วกระแสสูง 80kW - 150kW สองหรือสามตู้ติดต่อกันโดยไม่มีการปล่อยให้แบตเตอรี่ได้พักเย็นตัว จะทำให้โมดูลเกิดความร้อนสูงสุด ควรรอให้แบตเตอรี่คลายความร้อนก่อนขับขี่เต็มพิกัด
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <span className="font-bold text-slate-800 block mb-0.5">3. พฤติกรรมขับขี่กระชากคันเร่งรุนแรง</span>
                การกดคันเร่งกระชากกำลังไฟ (Draw Current) สูงๆ บ่อยครั้งจากจุดหยุดนิ่ง จะเหนี่ยวนำให้เกิดอุณหภูมิความร้อนในแพ็กสูงขึ้น แนะนำรักษาจังหวะขับเคลื่อนนุ่มนวลในการเดินทางปกติ
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "charge100" && (
        <div className="space-y-6">
          {/* Header Description & Chemistry Selector */}
          <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border border-indigo-100 rounded-3xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="space-y-1">
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5 uppercase tracking-wide">
                  <Sparkles className="w-4 h-4 text-amber-500 animate-spin-slow" /> ระบบวิเคราะห์จังหวะชาร์จ 100% อัจฉริยะ (AI 100% Charge Advisor)
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl font-medium">
                  ระบบวิเคราะห์จากฐานข้อมูลเคมีแบตเตอรี่รถยนต์ไฟฟ้า (LFP หรือ NMC/NCA) ร่วมกับความถี่ในการใช้งาน ทริปเดินทาง เพื่อคำนวณช่วงเวลาที่เหมาะสมที่สุดในการชาร์จกระแสไฟฟ้าเต็ม 100% สำหรับทำกระบวนการ Cell Balancing และคาลิเบรตชิปวัดประจุ (BMS)
                </p>
              </div>
              <button
                onClick={handleAnalyze100}
                disabled={loading100}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading100 ? "animate-spin" : ""}`} /> 
                {loading100 ? "กำลังวิเคราะห์..." : "ประมวลผลวิเคราะห์ใหม่"}
              </button>
            </div>

            {/* Quick Battery Chemistry Selector */}
            <div className="pt-3 border-t border-indigo-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">ระบุประเภทเคมีแบตเตอรี่รถของคุณ:</span>
                <span className="text-[10px] text-slate-500">({vehicle.model})</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...vehicle, batteryType: "LFP" as const };
                    setVehicle(updated);
                    localStorage.setItem("vehicle_profile", JSON.stringify(updated));
                    setTimeout(() => handleAnalyze100(), 100);
                  }}
                  className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                    vehicle.batteryType === "LFP" || (!vehicle.batteryType && charge100Analysis?.isLfp)
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>แบตเตอรี่ LFP (Lithium Iron Phosphate)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...vehicle, batteryType: "NMC" as const };
                    setVehicle(updated);
                    localStorage.setItem("vehicle_profile", JSON.stringify(updated));
                    setTimeout(() => handleAnalyze100(), 100);
                  }}
                  className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                    vehicle.batteryType === "NMC" || vehicle.batteryType === "NCA" || (!vehicle.batteryType && charge100Analysis && !charge100Analysis?.isLfp)
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>แบตเตอรี่ NMC / NCA</span>
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading100 && (
            <div className="border border-slate-150 rounded-3xl p-10 bg-white flex flex-col justify-center items-center text-center space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-indigo-600 absolute animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700 block">กำลังเชื่อมต่อ AI และวิเคราะห์ข้อมูลเคมีแบตเตอรี่...</span>
                <span className="text-[11px] text-slate-400 max-w-sm block">
                  วิเคราะห์ข้อมูลรถรุ่น {vehicle.model} ขนาดความจุ {nominalCapacity} kWh ร่วมกับทริปล่าสุดและประวัติชาร์จ เพื่อตรวจสอบรอบ Cell Balancing
                </span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error100 && !loading100 && (
            <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">เกิดข้อผิดพลาดในการวิเคราะห์ข้อมูลด้วย AI:</span>
                <p className="font-semibold">{error100}</p>
                <button
                  onClick={handleAnalyze100}
                  className="mt-2 text-[11px] font-bold underline text-rose-800 hover:text-rose-950 block"
                >
                  คลิกที่นี่เพื่อลองใหม่อีกครั้ง
                </button>
              </div>
            </div>
          )}

          {/* AI Result View */}
          {charge100Analysis && !loading100 && (
            <div className="space-y-5 animate-fade-in">
              {/* Alert Card Banner based on shouldChargeTo100 */}
              <div className={`p-5 rounded-3xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                charge100Analysis.shouldChargeTo100 
                  ? "bg-amber-50/75 border-amber-200 text-amber-900" 
                  : "bg-emerald-50/75 border-emerald-200 text-emerald-900"
              }`}>
                <div className="flex gap-3.5 items-start">
                  <div className={`p-3 rounded-2xl shrink-0 mt-0.5 ${
                    charge100Analysis.shouldChargeTo100 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {charge100Analysis.shouldChargeTo100 ? (
                      <AlertTriangle className="w-6 h-6 animate-bounce" />
                    ) : (
                      <ShieldCheck className="w-6 h-6" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm uppercase tracking-wide">
                        {charge100Analysis.shouldChargeTo100 
                          ? "⚠️ แนะนำ: ถึงเวลาชาร์จไฟเต็ม 100% แล้ว!" 
                          : "✅ แบตเตอรี่สมดุลดี: ยังไม่จำเป็นต้องชาร์จเต็ม 100%"}
                      </h4>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        charge100Analysis.urgency === "high"
                          ? "bg-rose-100 text-rose-700 border border-rose-200"
                          : charge100Analysis.urgency === "medium"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      }`}>
                        ความเร่งด่วน: {
                          charge100Analysis.urgency === "high" ? "สูง (High)" :
                          charge100Analysis.urgency === "medium" ? "ปานกลาง (Medium)" : "ต่ำ (Low)"
                        }
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90 max-w-xl font-medium">
                      {charge100Analysis.explanation}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 bg-white/70 backdrop-blur-xs px-4 py-3 rounded-2xl border border-black/5 font-mono text-center min-w-[130px]">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">ประเภทแบตเตอรี่</span>
                  <span className="text-base font-black text-indigo-700">{charge100Analysis.batteryChemistry}</span>
                </div>
              </div>

              {/* Advanced Diagnostics Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">การชาร์จเต็ม 100% ล่าสุด</span>
                  <span className="text-sm font-black text-slate-800 block leading-tight">{charge100Analysis.calculatedDaysSinceLast100 || charge100Analysis.daysSinceLast100}</span>
                  <span className="text-[10px] text-slate-400 block">ดึงข้อมูลเชิงลึกจากประวัติในระบบ</span>
                </div>

                <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">จำนวนทริปหลังชาร์จ 100%</span>
                  <span className="text-sm font-black text-slate-800 block leading-tight">
                    {charge100Analysis.calculatedTripsSinceLast100 !== undefined ? `${charge100Analysis.calculatedTripsSinceLast100} ทริป` : charge100Analysis.tripsSinceLast100}
                  </span>
                  <span className="text-[10px] text-slate-400 block">ระยะทางสะสม: {charge100Analysis.calculatedOdometerSinceLast100 || "ไม่มีข้อมูล"}</span>
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block flex items-center gap-1">
                    🎯 แผนความถี่ชาร์จ 100% ครั้งถัดไป
                  </span>
                  <span className="text-xs font-black text-indigo-950 block leading-tight">{charge100Analysis.nextChargeRecommendation}</span>
                  <span className="text-[10px] text-indigo-400 block">รอบเวลาที่ AI สรุปตามเคมีและพฤติกรรม</span>
                </div>
              </div>

              {/* AI Details Details card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Calibration analysis */}
                <div className="border border-slate-150 bg-white rounded-2xl p-5 space-y-3">
                  <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Activity className="w-4 h-4 text-indigo-600" /> การวิเคราะห์สมดุลเซลล์และการคาลิเบรต BMS
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                    {charge100Analysis.calibUrgency}
                  </p>
                </div>

                {/* Battery specific Pro Tips */}
                <div className="border border-slate-150 bg-white rounded-2xl p-5 space-y-3">
                  <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> คำแนะนำแบบโปรเฉพาะประเภทแบตเตอรี่คุณ
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                    {charge100Analysis.proTips}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Trip Planner and Context submissions */}
          {!loading100 && (
            <div className="border border-slate-150 bg-white rounded-3xl p-5 space-y-4">
              <div className="space-y-1">
                <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" /> บันทึกสถานการณ์หรือเพิ่มข้อมูลแผนเดินทางสำหรับการประเมิน
                </h5>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  หากคุณมีทริปท่องเที่ยวทางไกลที่กำลังจะมาถึง หรือพบความผิดปกติ เช่น เปอร์เซ็นต์แบตเตอรี่ลดลงเร็วผิดปกติ กรุณาระบุรายละเอียดที่นี่เพื่อให้ระบบวิเคราะห์เชิงลึกยิ่งขึ้น
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="ตัวอย่างเช่น: 'มีทริปขับรถไปหัวหินช่วงสุดสัปดาห์นี้ ระยะทางประมาณ 220 กม.' หรือ 'รู้สึกว่าเปอร์เซ็นต์แบตลดแกว่งแปลกๆ'"
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 font-medium"
                />
                <button
                  onClick={handleAnalyze100}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" /> อัปเดตและวิเคราะห์ด้วย AI
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
