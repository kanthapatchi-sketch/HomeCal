import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Gauge,
  TrendingDown,
  ShieldAlert,
  Lightbulb,
  CheckCircle2,
  Sparkles,
  Zap,
  RotateCcw
} from "lucide-react";
import { EfficiencyAlertResult } from "../utils/efficiencyMonitor";

interface EfficiencyAlertBannerProps {
  alert: EfficiencyAlertResult;
  onDismiss?: () => void;
}

export default function EfficiencyAlertBanner({
  alert,
  onDismiss,
}: EfficiencyAlertBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isCritical = alert.severity === "critical";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-3xl border shadow-sm transition-all ${
        isCritical
          ? "bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-amber-500/10 border-rose-300/90 text-rose-950"
          : "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-orange-500/10 border-amber-300/90 text-amber-950"
      }`}
    >
      {/* Decorative accent top line */}
      <div
        className={`h-1.5 w-full ${
          isCritical ? "bg-rose-500" : "bg-amber-500"
        }`}
      />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Banner Header Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3.5">
            {/* Icon Box */}
            <div
              className={`p-2.5 rounded-2xl shrink-0 shadow-xs ${
                isCritical
                  ? "bg-rose-500 text-white"
                  : "bg-amber-500 text-white"
              }`}
            >
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs ${
                    isCritical
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : "bg-amber-100 text-amber-900 border-amber-200"
                  }`}
                >
                  Efficiency Alert ⚡
                </span>

                {alert.dropPercentage > 0 && (
                  <span className="text-[10px] font-extrabold bg-rose-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    <TrendingDown className="w-3 h-3" />
                    กินพลังงานสูงขึ้น +{alert.dropPercentage}%
                  </span>
                )}
              </div>

              <h4 className="font-black text-sm sm:text-base tracking-tight flex items-center gap-2">
                เตือน: ตรวจพบอัตราสิ้นเปลืองพลังงานสูงผิดปกติ (Low Efficiency Detected)
              </h4>

              <p className="text-xs font-medium opacity-90 leading-relaxed max-w-2xl">
                {alert.vehicleType === "EV"
                  ? `ประสิทธิภาพล่าสุดอยู่ที่ ${alert.actualEfficiency} ${alert.unit} (${alert.consumptionRate}) ซึ่งต่ำกว่าค่าเฉลี่ยปกติ (${alert.averageEfficiency} ${alert.unit})`
                  : `อัตราประหยัดล่าสุดอยู่ที่ ${alert.actualEfficiency} ${alert.unit} (${alert.consumptionRate}) ซึ่งต่ำกว่าค่าเฉลี่ยปกติ (${alert.averageEfficiency} ${alert.unit})`}
                {alert.date && alert.stationName && (
                  <span className="opacity-80">
                    {" "}
                    • ตรวจพบจากรอบการเติมเมื่อวันที่ {alert.date} ณ {alert.stationName}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border ${
                isCritical
                  ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
                  : "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>{isExpanded ? "ซ่อนวิเคราะห์สาเหตุ" : "ดูสาเหตุ & วิธีแก้"}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              )}
            </button>

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-2 rounded-xl hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="ปิดการแจ้งเตือน"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Highlight Metrics Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-white/80 backdrop-blur-xs border border-amber-200/80 rounded-2xl p-2.5 space-y-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              ประสิทธิภาพรอบล่าสุด
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-rose-600">
                {alert.actualEfficiency}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                {alert.unit}
              </span>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xs border border-amber-200/80 rounded-2xl p-2.5 space-y-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              ค่าเฉลี่ยสะสมปกติ
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-emerald-700">
                {alert.averageEfficiency}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                {alert.unit}
              </span>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xs border border-amber-200/80 rounded-2xl p-2.5 space-y-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              อัตราสิ้นเปลืองรวม
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-extrabold text-amber-900 font-mono">
                {alert.consumptionRate}
              </span>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xs border border-amber-200/80 rounded-2xl p-2.5 space-y-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              รอบที่ประสิทธิภาพต่ำ
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-amber-800">
                {alert.lowEfficiencyLogsCount}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">ครั้ง</span>
            </div>
          </div>
        </div>

        {/* Expandable Diagnostic Drawer */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-amber-200/80 pt-4 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Possible Causes */}
                <div className="bg-white/90 rounded-2xl p-4 border border-rose-200/80 space-y-2.5 shadow-2xs">
                  <h5 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    สาเหตุที่อาจทำให้สิ้นเปลืองพลังงานสูง
                  </h5>
                  <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                    {alert.possibleCauses.map((cause, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommendations */}
                <div className="bg-white/90 rounded-2xl p-4 border border-emerald-200/80 space-y-2.5 shadow-2xs">
                  <h5 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    แนวทางแก้ไข & คำแนะนำเพิ่มประสิทธิภาพ
                  </h5>
                  <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                    {alert.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-amber-900/80 pt-1 font-medium italic">
                <span>
                  💡 ทิปส์: หากเพิ่งมีการเปลี่ยนยางใหม่ บรรทุกของหนัก หรือขับขึ้นเขา
                  อัตราสิ้นเปลืองที่สูงขึ้นในระยะสั้นถือเป็นเรื่องปกติ
                </span>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="font-bold text-amber-800 hover:underline cursor-pointer not-italic shrink-0"
                >
                  ย่อส่วนวิเคราะห์ ▲
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
