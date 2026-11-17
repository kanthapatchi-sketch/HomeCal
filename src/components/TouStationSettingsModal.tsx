import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Zap, Plus, Trash2, Edit3, Check, RotateCcw, Info, Sparkles, ShieldCheck } from "lucide-react";
import { TouStation } from "../types";

export const DEFAULT_TOU_STATIONS: TouStation[] = [
  {
    id: "tou-default-1",
    stationCode: "AE0007A1GP1C00089M",
    name: "Home Charger (TOU) - AE0007A1GP1C00089M",
    offPeakRate: 2.60,
    onPeakRate: 4.58,
    notes: "สถานีชาร์จบ้าน TOU หลัก ระบบจะเปลี่ยนเป็น Home Charger (TOU) อัตโนมัติเมื่อพบรหัสนี้",
    isDefault: true,
  },
];

export function getStoredTouStations(): TouStation[] {
  try {
    const saved = localStorage.getItem("tou_charging_stations");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading stored TOU stations:", err);
  }
  return DEFAULT_TOU_STATIONS;
}

export function isTouStationMatch(inputStationName: string, touStations: TouStation[] = getStoredTouStations()): TouStation | null {
  if (!inputStationName || !inputStationName.trim()) return null;
  const cleanInput = inputStationName.trim().toLowerCase();

  for (const station of touStations) {
    const code = station.stationCode.trim().toLowerCase();
    const name = station.name.trim().toLowerCase();
    
    // Check if input contains code or exact match
    if (code && cleanInput.includes(code)) return station;
    if (name && cleanInput.includes(name)) return station;
  }

  return null;
}

interface TouStationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStationsUpdated?: (stations: TouStation[]) => void;
}

export default function TouStationSettingsModal({
  isOpen,
  onClose,
  onStationsUpdated,
}: TouStationSettingsModalProps) {
  const [stations, setStations] = useState<TouStation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [offPeakRate, setOffPeakRate] = useState("2.60");
  const [onPeakRate, setOnPeakRate] = useState("4.58");
  const [notes, setNotes] = useState("");

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const loaded = getStoredTouStations();
      setStations(loaded);
      resetForm();
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setOffPeakRate("2.60");
    setOnPeakRate("4.58");
    setNotes("");
  };

  const handleEditClick = (station: TouStation) => {
    setEditingId(station.id);
    setCode(station.stationCode);
    setName(station.name);
    setOffPeakRate(station.offPeakRate?.toString() || "2.60");
    setOnPeakRate(station.onPeakRate?.toString() || "4.58");
    setNotes(station.notes || "");
  };

  const handleDelete = (id: string) => {
    const updated = stations.filter((s) => s.id !== id);
    setStations(updated);
    saveStationsToStorage(updated);
    if (editingId === id) resetForm();
    showToast("ลบสถานีชาร์จเรียบร้อยแล้ว");
  };

  const handleResetDefaults = () => {
    setStations(DEFAULT_TOU_STATIONS);
    saveStationsToStorage(DEFAULT_TOU_STATIONS);
    resetForm();
    showToast("คืนค่าสถานีชาร์จ TOU เริ่มต้นสำเร็จ");
  };

  const saveStationsToStorage = (newStations: TouStation[]) => {
    localStorage.setItem("tou_charging_stations", JSON.stringify(newStations));
    if (onStationsUpdated) {
      onStationsUpdated(newStations);
    }
  };

  const handleSaveStation = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      alert("กรุณาระบุ รหัสสถานีชาร์จ / Serial Number (เช่น AE0007A1GP1C00089M)");
      return;
    }

    const cleanCode = code.trim();
    const cleanName = name.trim() || `Home Charger (TOU) - ${cleanCode}`;

    let updatedList: TouStation[];

    if (editingId) {
      // Update existing
      updatedList = stations.map((s) => {
        if (s.id === editingId) {
          return {
            ...s,
            stationCode: cleanCode,
            name: cleanName,
            offPeakRate: offPeakRate ? Number(offPeakRate) : undefined,
            onPeakRate: onPeakRate ? Number(onPeakRate) : undefined,
            notes: notes.trim(),
          };
        }
        return s;
      });
      showToast(`อัปเดตสถานี ${cleanCode} สำเร็จ`);
    } else {
      // Create new
      const newStation: TouStation = {
        id: `tou-${Date.now()}`,
        stationCode: cleanCode,
        name: cleanName,
        offPeakRate: offPeakRate ? Number(offPeakRate) : undefined,
        onPeakRate: onPeakRate ? Number(onPeakRate) : undefined,
        notes: notes.trim(),
      };
      updatedList = [...stations, newStation];
      showToast(`เพิ่มสถานี ${cleanCode} เรียบร้อยแล้ว`);
    }

    setStations(updatedList);
    saveStationsToStorage(updatedList);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
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
          className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col relative z-10"
        >
          {/* Toast Notification */}
          {toastMessage && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
              <Check className="w-4 h-4" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-2xl shadow-sm">
                <Zap className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  ตั้งค่าสถานีชาร์จ TOU
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded-full uppercase border border-amber-200">
                    Auto-Detect
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  กำหนดรหัสตู้ชาร์จบ้าน TOU เพื่อเปลี่ยนประเภทการชาร์จให้อัตโนมัติ
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Info Banner */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-2 text-xs text-amber-900 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-600" />
                ระบบตรวจจับสถานีชาร์จบ้าน (TOU Meter System)
              </div>
              <p className="text-amber-800/90 font-medium">
                เมื่อคุณป้อนหรือสแกนใบเสร็จที่มีรหัสสถานีตรงกับรายการด้านล่าง (เช่น <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-900">AE0007A1GP1C00089M</code>) 
                ระบบจะเลือกประเภทการชาร์จเป็น <strong className="font-bold text-amber-950">Home Charger (TOU)</strong> ให้โดยอัตโนมัติทันที
              </p>
              <p className="text-[11px] text-amber-700/80 italic">
                * คุณยังคงสามารถแก้ไขหรือปรับเปลี่ยนชื่อสถานีและประเภทการชาร์จได้อย่างอิสระตลอดเวลา
              </p>
            </div>

            {/* List of Configured TOU Stations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  รายชื่อสถานีชาร์จ TOU ที่บันทึกไว้ ({stations.length})
                </h4>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-[11px] text-slate-500 hover:text-amber-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  title="รีเซ็ตเป็นสถานี AE0007A1GP1C00089M เริ่มต้น"
                >
                  <RotateCcw className="w-3 h-3" /> คืนค่าเริ่มต้น
                </button>
              </div>

              {stations.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-medium">
                  ยังไม่มีสถานีชาร์จ TOU ในระบบ กรุณาเพิ่มรหัสสถานีด้านล่าง
                </div>
              ) : (
                <div className="space-y-2.5">
                  {stations.map((s) => (
                    <div
                      key={s.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        editingId === s.id
                          ? "bg-amber-50/60 border-amber-400 ring-2 ring-amber-400/20 shadow-xs"
                          : "bg-slate-50/60 hover:bg-slate-100/60 border-slate-200/80"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs bg-slate-900 text-amber-300 px-2.5 py-1 rounded-lg shadow-2xs">
                            ⚡ {s.stationCode}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">
                            {s.name}
                          </span>
                        </div>
                        {s.notes && (
                          <p className="text-[11px] text-slate-500 font-medium">
                            {s.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono font-bold pt-0.5">
                          <span>Off-Peak: <strong className="text-emerald-600">{s.offPeakRate || 2.60}</strong> บาท/kWh</span>
                          <span>•</span>
                          <span>On-Peak: <strong className="text-amber-700">{s.onPeakRate || 4.58}</strong> บาท/kWh</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditClick(s)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600" /> แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          className="p-1.5 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
                          title="ลบสถานีนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form to Add / Edit Station */}
            <form onSubmit={handleSaveStation} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-600" />
                  {editingId ? "แก้ไขข้อมูลสถานีชาร์จ TOU" : "เพิ่มสถานีชาร์จ TOU ใหม่"}
                </h4>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-bold hover:underline cursor-pointer"
                  >
                    ยกเลิกการแก้ไข
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold text-[11px] uppercase tracking-wider mb-1">
                    รหัสสถานี / Serial ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น AE0007A1GP1C00089M"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold text-[11px] uppercase tracking-wider mb-1">
                    ชื่อหรือฉายาสถานี (Display Name)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น Home Charger (TOU) - เครื่องชาร์จบ้าน"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold text-[11px] uppercase tracking-wider mb-1">
                    อัตราค่าไฟ Off-Peak (บาท/kWh)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="2.60"
                    value={offPeakRate}
                    onChange={(e) => setOffPeakRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold text-[11px] uppercase tracking-wider mb-1">
                    อัตราค่าไฟ On-Peak (บาท/kWh)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="4.58"
                    value={onPeakRate}
                    onChange={(e) => setOnPeakRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold text-[11px] uppercase tracking-wider mb-1">
                  บันทึกโน้ตเพิ่มเติม (Optional)
                </label>
                <input
                  type="text"
                  placeholder="เช่น ติดตั้ง มิเตอร์ TOU การไฟฟ้าส่วนภูมิภาค"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {editingId ? "บันทึกการแก้ไขสถานี TOU" : "เพิ่มสถานีชาร์จ TOU ลงในระบบ"}
              </button>
            </form>

          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span className="font-medium text-[11px]">
              * ข้อมูลจะถูกบันทึกไว้ในอุปกรณ์เครื่องนี้อย่างปลอดภัย
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              เสร็จสิ้น
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
