import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Zap, Clock, Calendar, Sparkles, AlertTriangle, ShieldCheck, HelpCircle, Flame, BatteryCharging } from "lucide-react";
import { Vehicle, EnergyLog, ChargeLog, TripLog } from "../types";

interface ChargingCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  logs: EnergyLog[];
  tripLogs: TripLog[];
}

export default function ChargingCalculatorModal({
  isOpen,
  onClose,
  vehicle,
  logs,
  tripLogs,
}: ChargingCalculatorModalProps) {
  // Try to find the latest battery percentage from driving trip logs (TripLog) or charging logs (ChargeLog) to set as default start percent
  const getLatestBatteryPct = () => {
    const candidates: { pct: number; timestamp: number }[] = [];

    // Check TripLogs (Driving records)
    if (tripLogs && Array.isArray(tripLogs)) {
      tripLogs.forEach((trip) => {
        if (trip.endBatteryPct !== undefined && trip.endBatteryPct !== null) {
          const t = (trip as any).createdAt 
            ? new Date((trip as any).createdAt).getTime() 
            : new Date(trip.date).getTime();
          candidates.push({ pct: trip.endBatteryPct, timestamp: t });
        }
      });
    }

    // Check ChargeLogs (Charging records)
    if (logs && Array.isArray(logs)) {
      (logs as ChargeLog[]).forEach((log) => {
        if (log.type === "EV" && log.endBatteryPct !== undefined && log.endBatteryPct !== null) {
          const t = new Date(log.date).getTime();
          candidates.push({ pct: log.endBatteryPct, timestamp: t });
        }
      });
    }

    // Sort by timestamp descending (newest first)
    candidates.sort((a, b) => b.timestamp - a.timestamp);

    if (candidates.length > 0) {
      return candidates[0].pct;
    }
    return 20; // Default fallback
  };

  const getInitialStartTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  // State Variables as Strings so users can delete and type freely
  const [currentBatteryPctStr, setCurrentBatteryPctStr] = useState("20");
  const [targetBatteryPctStr, setTargetBatteryPctStr] = useState("80");
  const [isDC, setIsDC] = useState(false);
  const [chargerAmp, setChargerAmp] = useState(32); // For AC
  const [chargerVolt, setChargerVolt] = useState(220); // For AC
  const [isThreePhase, setIsThreePhase] = useState(false); // For AC
  const [dcKw, setDcKw] = useState(50); // For DC
  const [startTime, setStartTime] = useState("");

  // Derived numeric battery percentages
  const currentBatteryPct = currentBatteryPctStr === "" ? 0 : Math.max(0, Math.min(100, parseInt(currentBatteryPctStr, 10) || 0));
  const targetBatteryPct = targetBatteryPctStr === "" ? 0 : Math.max(0, Math.min(100, parseInt(targetBatteryPctStr, 10) || 0));

  // AI Response States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    estimatedTimeMinutes: number;
    addedKwh: number;
    estimatedRangeKm: number;
    batteryInsight: string;
    costEstimateThb: string;
    smartAdvice: string;
  } | null>(null);

  // Set initial states when modal opens
  useEffect(() => {
    if (isOpen) {
      const latestPct = getLatestBatteryPct();
      setCurrentBatteryPctStr(latestPct.toString());
      setTargetBatteryPctStr("80");
      setStartTime(getInitialStartTime());
      setAiResult(null);
      setAiError(null);
    }
  }, [isOpen, logs, tripLogs]);

  // Real-time calculation math
  const batteryCapacity = vehicle.batteryCapacity || 60; // Defaults to 60 kWh if none set
  const addedKwh = Math.max(0, ((targetBatteryPct - currentBatteryPct) / 100) * batteryCapacity);

  // Derived charging power in kW
  const getChargerKw = () => {
    if (isDC) {
      return dcKw;
    } else {
      // AC Charging Power formula: (V * A * Phases) / 1000
      const phases = isThreePhase ? 3 : 1;
      return (chargerVolt * chargerAmp * phases) / 1000;
    }
  };

  const chargerKw = getChargerKw();

  // Calculate actual charging duration in hours (incorporating realistic slowdown curves)
  const calculateChargingDuration = () => {
    if (chargerKw <= 0 || addedKwh <= 0) return 0;

    // Efficiency factors
    const efficiency = isDC ? 0.95 : 0.90; // DC is slightly more efficient than AC charger converter
    const netPowerKw = chargerKw * efficiency;

    // Below 80% SoC: linear charging
    let timeHours = 0;
    if (currentBatteryPct < 80) {
      const targetForLinear = Math.min(80, targetBatteryPct);
      const addedKwhLinear = ((targetForLinear - currentBatteryPct) / 100) * batteryCapacity;
      timeHours += addedKwhLinear / netPowerKw;
    }

    // Above 80% SoC: exponential charging slowdown (CV Phase)
    if (targetBatteryPct > 80) {
      const startForSlow = Math.max(80, currentBatteryPct);
      const addedKwhSlow = ((targetBatteryPct - startForSlow) / 100) * batteryCapacity;
      // In the CV phase, AC slows down slightly (~20%), DC slows down dramatically (~65% speed drop)
      const slowdownFactor = isDC ? 0.35 : 0.80; 
      timeHours += addedKwhSlow / (netPowerKw * slowdownFactor);
    }

    return timeHours;
  };

  const timeHours = calculateChargingDuration();
  const totalMinutesRounded = Math.round(timeHours * 60);
  const displayHours = Math.floor(totalMinutesRounded / 60);
  const displayMinutes = totalMinutesRounded % 60;

  // Calculate completion clock time
  const getCompletionTime = () => {
    if (!startTime || totalMinutesRounded <= 0) return { clock: "--:--", isNextDay: false, daysAhead: 0 };
    const [hStr, mStr] = startTime.split(":");
    const startH = parseInt(hStr, 10) || 0;
    const startM = parseInt(mStr, 10) || 0;

    const totalM = startM + totalMinutesRounded;
    const totalH = startH + Math.floor(totalM / 60);
    const endM = totalM % 60;
    const endH = totalH % 24;
    const daysAhead = Math.floor(totalH / 24);
    const isNextDay = daysAhead > 0;

    return {
      clock: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")} น.`,
      isNextDay,
      daysAhead,
    };
  };

  const completion = getCompletionTime();

  // Call server-side Gemini AI for deep analysis
  const handleFetchAiRecommendation = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/calculate-charging-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle,
          currentBatteryPct,
          targetBatteryPct,
          chargerAmp,
          chargerVolt,
          isThreePhase,
          startTime,
          chargerKw,
        }),
      });

      if (!response.ok) {
        throw new Error("ระบบวิเคราะห์ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง");
      }

      const resData = await response.json();
      if (resData.status === "success" && resData.result) {
        setAiResult(resData.result);
      } else {
        throw new Error("การคำนวณของ AI ไม่สมบูรณ์");
      }
    } catch (err: any) {
      setAiError(err.message || "เกิดข้อผิดพลาดในการติดต่อระบบ AI");
    } finally {
      setAiLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-slate-900 text-slate-100 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-md h-[92vh] sm:h-[85vh] overflow-hidden flex flex-col relative z-10"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/10 rounded-xl text-amber-400">
                <BatteryCharging className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white">เครื่องคำนวณเวลาชาร์จ (AI)</h3>
                <p className="text-[10px] text-slate-400 font-bold">{vehicle.model}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/80 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content - Scrollable to fit all content on mobile without overflows */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            
            {/* Charger Type Toggle */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800/80 shrink-0">
              <button
                type="button"
                onClick={() => setIsDC(false)}
                className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  !isDC
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> AC ชาร์จช้า / Home
              </button>
              <button
                type="button"
                onClick={() => setIsDC(true)}
                className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isDC
                    ? "bg-amber-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> DC ชาร์จเร็ว / ตู้
              </button>
            </div>

            {/* Input Parameters Controls Grid */}
            <div className="space-y-4 bg-slate-950/30 border border-slate-800/60 p-4 rounded-2xl">
              
              {/* Battery State Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">🔋 แบตเตอรี่เริ่มต้น</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={currentBatteryPctStr}
                      onChange={(e) => {
                        const valStr = e.target.value;
                        if (valStr === "") {
                          setCurrentBatteryPctStr("");
                          return;
                        }
                        const val = parseInt(valStr, 10);
                        if (!isNaN(val)) {
                          setCurrentBatteryPctStr(Math.max(0, Math.min(100, val)).toString());
                        }
                      }}
                      onBlur={() => {
                        let cur = parseInt(currentBatteryPctStr, 10);
                        if (isNaN(cur) || currentBatteryPctStr === "") {
                          cur = 0;
                        }
                        cur = Math.max(0, Math.min(99, cur));
                        setCurrentBatteryPctStr(cur.toString());

                        // If start >= target, update target to cur + 5 (max 100)
                        const tgt = parseInt(targetBatteryPctStr, 10) || 0;
                        if (cur >= tgt) {
                          setTargetBatteryPctStr(Math.min(100, cur + 5).toString());
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold font-mono focus:outline-none focus:border-indigo-500 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">🎯 แบตเตอรี่เป้าหมาย</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={currentBatteryPct + 1}
                      max="100"
                      value={targetBatteryPctStr}
                      onChange={(e) => {
                        const valStr = e.target.value;
                        if (valStr === "") {
                          setTargetBatteryPctStr("");
                          return;
                        }
                        const val = parseInt(valStr, 10);
                        if (!isNaN(val)) {
                          setTargetBatteryPctStr(Math.max(0, Math.min(100, val)).toString());
                        }
                      }}
                      onBlur={() => {
                        let tgt = parseInt(targetBatteryPctStr, 10);
                        if (isNaN(tgt) || targetBatteryPctStr === "") {
                          tgt = Math.min(100, currentBatteryPct + 5);
                        }
                        tgt = Math.max(currentBatteryPct + 1, Math.min(100, tgt));
                        setTargetBatteryPctStr(tgt.toString());
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold font-mono focus:outline-none focus:border-indigo-500 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">%</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Charger Settings based on AC / DC selection */}
              {!isDC ? (
                // AC Charging Controls
                <div className="space-y-3.5 pt-2 border-t border-slate-800/60">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">🔌 ตั้งค่ากระแสไฟ (Amp)</label>
                      <select
                        value={chargerAmp}
                        onChange={(e) => setChargerAmp(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-200 font-bold font-mono focus:outline-none focus:border-indigo-500"
                      >
                        {Array.from({ length: 32 - 7 + 1 }, (_, i) => 7 + i).map((amp) => (
                          <option key={amp} value={amp}>
                            {amp} A {amp === 8 ? "(ไฟบ้านทั่วไป)" : amp === 16 ? "(เครื่องชาร์จพกพา)" : amp === 32 ? "(Wallbox มาตรฐาน)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">⚡ แรงดันไฟระบบ</label>
                      <select
                        value={chargerVolt}
                        onChange={(e) => setChargerVolt(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-bold font-mono focus:outline-none focus:border-indigo-500"
                      >
                        <option value={220}>220 V (1 เฟสทั่วไป)</option>
                        <option value={230}>230 V (1 เฟสยุโรป)</option>
                        <option value={380}>380 V (3 เฟสอุตสาหกรรม)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold">ระบบไฟฟ้าแบบ 3 เฟส (Three-phase)</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isThreePhase}
                        onChange={(e) => setIsThreePhase(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              ) : (
                // DC Fast Charger Controls
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-400 font-bold uppercase">⚡ กำลังไฟตู้ชาร์จ DC (kW)</label>
                    <span className="text-xs font-black text-amber-400 font-mono">{dcKw} kW</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="150"
                    step="10"
                    value={dcKw}
                    onChange={(e) => setDcKw(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                  />
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[20, 50, 90, 120].map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => setDcKw(kw)}
                        className={`py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                          dcKw === kw
                            ? "bg-amber-600/30 border border-amber-500 text-amber-200"
                            : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {kw}kW
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Time Config */}
              <div className="pt-2.5 border-t border-slate-800/60 grid grid-cols-2 gap-4 items-center">
                <label className="text-[10px] text-slate-400 font-bold uppercase">⏰ เวลาเริ่มชาร์จ</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-200 font-bold font-mono focus:outline-none focus:border-indigo-500 text-center"
                />
              </div>
            </div>

            {/* Instant Math Calculation Result Dashboard Card */}
            <div className="bg-gradient-to-br from-indigo-950/40 to-slate-950 border border-indigo-500/20 rounded-2xl p-4.5 space-y-3.5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-indigo-500/10 pointer-events-none">
                <Clock className="w-16 h-16" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-left space-y-0.5">
                  <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">ระยะเวลาชาร์จทั้งหมด</span>
                  <div className="flex items-baseline gap-1 text-emerald-400">
                    <span className="text-2xl font-black font-mono leading-none">
                      {displayHours > 0 ? `${displayHours}` : `${displayMinutes}`}
                    </span>
                    <span className="text-xs font-black">
                      {displayHours > 0 ? "ชม." : "นาที"}
                    </span>
                    {displayHours > 0 && displayMinutes > 0 && (
                      <>
                        <span className="text-xl font-black font-mono ml-1">{displayMinutes}</span>
                        <span className="text-xs font-black">นาที</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right space-y-0.5">
                  <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">คาดว่าจะชาร์จเสร็จตอน</span>
                  <div className="text-white font-black font-mono text-lg flex items-center justify-end gap-1 leading-none mt-0.5">
                    {completion.clock}
                    {completion.isNextDay && (
                      <span className="text-[8px] bg-indigo-900 text-indigo-200 font-extrabold px-1.5 py-0.5 rounded-md self-center">
                        +{completion.daysAhead} วัน
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Added Energy and Power Spec badges */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-800/80 pt-2.5">
                <span>ปริมาณไฟฟ้าที่จะได้รับ:</span>
                <span className="text-slate-200 font-mono font-black">{addedKwh.toFixed(2)} kWh</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                <span>กำลังไฟชาร์จจริง (เน็ต):</span>
                <span className="text-slate-200 font-mono font-black">{chargerKw.toFixed(2)} kW</span>
              </div>
            </div>

            {/* AI Deep Analysis Section */}
            <div className="space-y-3 shrink-0">
              {aiResult ? (
                // AI Result Display Card
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 text-left space-y-3.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-black text-white">วิเคราะห์เจาะลึกสำเร็จด้วย AI</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold">ความจุรถ: {vehicle.batteryCapacity || 60} kWh</span>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed">
                    {/* Added Driving Range Box */}
                    <div className="bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-xl flex items-center gap-2.5">
                      <div className="text-emerald-400 p-1.5 bg-emerald-500/10 rounded-lg">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold">คาดการณ์ระยะทางขับขี่ที่ได้เพิ่ม</div>
                        <div className="text-sm font-black text-white">+{aiResult.estimatedRangeKm} กิโลเมตร</div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <h4 className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> วิเคราะห์สุขภาพแบตเตอรี่ (Battery Care)
                        </h4>
                        <p className="text-slate-300 font-medium pl-4.5 mt-0.5">{aiResult.batteryInsight}</p>
                      </div>

                      <div>
                        <h4 className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> การประหยัดค่าไฟ (Cost / TOU Plan)
                        </h4>
                        <p className="text-slate-300 font-medium pl-4.5 mt-0.5">{aiResult.costEstimateThb}</p>
                      </div>

                      <div>
                        <h4 className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> คำแนะนำอัจฉริยะ (Smart Tip)
                        </h4>
                        <p className="text-slate-300 font-medium pl-4.5 mt-0.5">{aiResult.smartAdvice}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleFetchAiRecommendation}
                    disabled={aiLoading}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Clock className="w-3.5 h-3.5" /> อัปเดตข้อมูลวิเคราะห์ใหม่
                  </button>
                </motion.div>
              ) : (
                // Button to Trigger AI
                <button
                  type="button"
                  onClick={handleFetchAiRecommendation}
                  disabled={aiLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl font-black text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  {aiLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>กำลังส่งให้ AI คำนวณความเร็วและสุขภาพ...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                      <span>🔮 วิเคราะห์และพยากรณ์เชิงลึกด้วย AI</span>
                    </>
                  )}
                </button>
              )}

              {aiError && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 text-xs rounded-xl font-bold text-left flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{aiError}</span>
                </div>
              )}
            </div>

          </div>

          {/* Bottom disclaimer or quick tip */}
          <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[8px] text-slate-500 font-bold shrink-0">
            <span>* พลังงานจริงอาจผันผวนตามอุณหภูมิและสุขภาพรถ (SOH)</span>
            <span>กูรูแบตเตอรี่ AI ⚡</span>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
