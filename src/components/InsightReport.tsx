import React, { useState } from "react";
import { Cpu, RefreshCw, FileText, Check, AlertCircle, Eye, ShieldCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { EnergyLog, Vehicle, TripLog } from "../types";

interface InsightReportProps {
  logs: EnergyLog[];
  tripLogs: TripLog[];
  vehicle: Vehicle;
}

export default function InsightReport({ logs, tripLogs, vehicle }: InsightReportProps) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drivingNotes, setDrivingNotes] = useState("");

  // Aggregate stats
  const totalCost = logs.reduce((sum, log) => sum + log.totalAmount, 0);
  
  const totalEnergy = logs.reduce((sum, log) => {
    if (log.type === "EV") {
      return sum + (log as any).energyKwh;
    } else {
      return sum + (log as any).volumeLiters;
    }
  }, 0);

  // Total distance driven (sum of difference if odometer is recorded, or direct distanceKm if available)
  // Let's compute distance based on logs:
  const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let totalDistance = 0;
  
  // Calculate odometer diff
  if (sortedLogs.length >= 2) {
    const odoms = sortedLogs.map((l) => l.odometerReading).filter((o) => o !== undefined) as number[];
    if (odoms.length >= 2) {
      totalDistance = Math.max(...odoms) - Math.min(...odoms);
    }
  }

  // If total distance is 0, let's estimate or fallback to 0
  if (totalDistance === 0) {
    // If we have distanceKm on logs, sum them up
    totalDistance = logs.reduce((sum, log) => sum + (log.distanceKm || 0), 0);
  }

  // Fallback distance if none is specified, say, 100km per log average
  const displayDistance = totalDistance > 0 ? totalDistance : logs.length * 150;

  const handleGenerateInsight = async () => {
    if (logs.length === 0 && tripLogs.length === 0) {
      alert("กรุณาบันทึกข้อมูลระบบพลังงานหรือทริปการเดินทางก่อนการประมวลผลวิเคราะห์");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleType: vehicle.type,
          vehicleModel: vehicle.model,
          totalDistance: displayDistance,
          totalEnergy: totalEnergy.toFixed(2),
          totalCost: totalCost.toFixed(2),
          notes: drivingNotes || "ขับขี่เฉลี่ยทั่วไปทั้งในเมืองและนอกเมือง",
          tripStats: {
            totalTripsCount: tripLogs.length,
            totalTripDistance: tripLogs.reduce((sum, t) => sum + t.distanceKm, 0),
            trips: tripLogs.slice(0, 15).map(t => ({
              date: t.date,
              title: t.title,
              distanceKm: t.distanceKm,
              tripType: t.tripType,
              batteryDrop: t.startBatteryPct !== undefined && t.endBatteryPct !== undefined ? `${t.startBatteryPct}% → ${t.endBatteryPct}%` : undefined
            }))
          }
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์วิเคราะห์ได้");
      }

      const resData = await response.json();
      if (resData.status === "success") {
        setInsight(resData.insight);
      } else {
        throw new Error(resData.error || "การวิเคราะห์ล้มเหลว");
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการวิเคราะห์ด้วย Gemini AI");
    } finally {
      setLoading(false);
    }
  };

  // Light helper to render markdown lines into neat blocks
  const renderInsightText = (text: string) => {
    if (!text) return null;
    
    // Split into lines or double-newlines
    const blocks = text.split("\n");
    return blocks.map((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;

      // Header handling
      if (trimmed.startsWith("###")) {
        return (
          <h5 key={idx} className="font-bold text-indigo-100 text-sm mt-4 mb-2">
            {trimmed.replace("###", "").trim()}
          </h5>
        );
      }
      if (trimmed.startsWith("##") || trimmed.startsWith("1.") || trimmed.startsWith("2.") || trimmed.startsWith("3.")) {
        return (
          <h4 key={idx} className="font-bold text-white text-base mt-5 mb-2.5 flex items-center gap-1.5 border-b border-white/10 pb-1">
            {trimmed}
          </h4>
        );
      }

      // Bullets
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        return (
          <li key={idx} className="text-indigo-200 text-sm ml-4 list-disc leading-relaxed mb-1.5">
            {trimmed.substring(1).trim()}
          </li>
        );
      }

      return (
        <p key={idx} className="text-indigo-100 text-sm leading-relaxed mb-2">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="bg-indigo-950 text-white rounded-3xl shadow-xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[480px]">
      {/* Decorative background element */}
      <div className="absolute bottom-0 right-0 opacity-5 transform translate-x-1/4 translate-y-1/4 pointer-events-none">
        <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm11-4.24l-1.2-1.2C11.12 5.88 10.15 5.54 9 5.54c-2.46 0-4.46 2-4.46 4.46 0 1.15.34 2.12 1.02 2.8l1.2 1.2c.68.68 1.65 1.02 2.8 1.02 1.15 0 2.12-.34 2.8-1.02l.64-.64.64.64c.68.68 1.65 1.02 2.8 1.02 2.46 0 4.46-2 4.46-4.46 0-1.15-.34-2.12-1.02-2.8l-1.2-1.2c-.68-.68-1.65-1.02-2.8-1.02-1.15 0-2.12.34-2.8 1.02l-.64.64-.64-.64z"></path>
        </svg>
      </div>

      <div className="relative z-10 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
            <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">AI Energy Insight</span>
          </div>
          <span className="px-2 py-0.5 bg-white/10 border border-white/10 rounded-md text-[10px] font-bold text-indigo-200">
            AI Copilot
          </span>
        </div>

        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">ประสิทธิภาพการใช้งานพลังงาน</h2>
          <p className="text-indigo-300 text-xs mt-1">วิเคราะห์ความประหยัดเฉพาะบุคคล และสูตรคำนวณถอดค่าขับขี่</p>
        </div>

        {/* Driving Notes Area */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <label className="block text-indigo-200 font-bold text-[10px] uppercase tracking-wider mb-2">
            พฤติกรรมขับขี่เพิ่มเติม (ช่วยให้ AI วิเคราะห์แม่นยำขึ้น):
          </label>
          <textarea
            rows={2}
            placeholder="เช่น ขับรถติดในเมืองเป็นหลัก / เน้นเดินทางไกล / เปิดแอร์เย็นมาก..."
            value={drivingNotes}
            onChange={(e) => setDrivingNotes(e.target.value)}
            className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-white/30 transition-all resize-none"
          />
        </div>

        {logs.length === 0 ? (
          <div className="p-6 text-center border border-white/10 bg-white/5 rounded-2xl text-indigo-300">
            <p className="font-bold text-sm text-white">ยังไม่มีประวัติให้ประมวลผล</p>
            <p className="text-xs mt-1">เพิ่มข้อมูลประวัติการเดินทางหรือเติมพลังงานเพื่อดูสถิติ</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Quick Metrics display inside AI block */}
            <div className="grid grid-cols-3 gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl text-center">
              <div>
                <div className="text-[9px] text-indigo-300 font-bold uppercase tracking-wider">Distance</div>
                <div className="text-sm font-extrabold text-white">{displayDistance.toLocaleString()} กม.</div>
              </div>
              <div>
                <div className="text-[9px] text-indigo-300 font-bold uppercase tracking-wider">Energy</div>
                <div className="text-sm font-extrabold text-white">
                  {totalEnergy.toFixed(1)} {vehicle.type === "EV" ? "kWh" : "ลิตร"}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-indigo-300 font-bold uppercase tracking-wider">Total Cost</div>
                <div className="text-sm font-extrabold text-indigo-200">฿{totalCost.toLocaleString()}</div>
              </div>
            </div>

            <button
              onClick={handleGenerateInsight}
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-950/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  กำลังสรุปประมวลผล...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  วิเคราะห์ประสิทธิภาพด้วย AI
                </>
              )}
            </button>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-rose-505/10 border border-rose-500/20 text-rose-200 rounded-2xl text-xs flex gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <p className="font-bold">เกิดข้อผิดพลาดในการวิเคราะห์</p>
                    <p className="text-rose-300 mt-1">{error}</p>
                  </div>
                </motion.div>
              )}

              {insight && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10 text-white"
                >
                  <div className="flex items-center gap-1.5 text-xs text-indigo-200 font-bold mb-3">
                    <Eye className="w-4 h-4" /> บทรายงานวิเคราะห์โดย AI Consultant
                  </div>
                  <div className="text-indigo-50 space-y-1">
                    {renderInsightText(insight)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
