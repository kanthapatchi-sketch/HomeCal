import React, { useState, useRef } from "react";
import { Upload, FileText, Check, AlertCircle, RefreshCw, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { EnergyLog, VehicleType } from "../types";
import { isTouStationMatch } from "./TouStationSettingsModal";

interface ReceiptScannerProps {
  onScanComplete: (log: Partial<EnergyLog> & { type: VehicleType }) => void;
}

export default function ReceiptScanner({ onScanComplete }: ReceiptScannerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingSteps = [
    "กำลังประมวลผลรูปภาพใบเสร็จ...",
    "วิเคราะห์ข้อมูลพลังงานและประเภทรถ...",
    "สกัดยอดรวมและปริมาณด้วยระบบ AI OCR...",
    "ประมวลผลข้อมูลเสร็จสิ้น!"
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น");
      return;
    }

    setError(null);
    setLoading(true);
    setLoadingStep(0);

    // Create a local image preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Increment loading steps sequentially
    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 1200);

    // Convert file to base64 and send to OCR API
    const base64Reader = new FileReader();
    base64Reader.onload = async () => {
      try {
        const base64String = (base64Reader.result as string).split(",")[1];
        
        const response = await fetch("/api/ocr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image: base64String,
            mimeType: file.type,
          }),
        });

        clearInterval(interval);

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "เกิดข้อผิดพลาดในการส่งรูปภาพไปวิเคราะห์");
        }

        const resData = await response.json();
        
        if (resData.status === "success") {
          let vehicleType = resData.vehicle_type as VehicleType;
          const extractedData = resData.data || {};
          const stationName = extractedData.station_name || "";

          // Check if station matches TOU station (e.g. AE0007A1GP1C00089M)
          const touMatch = isTouStationMatch(stationName);
          if (touMatch) {
            vehicleType = "EV";
          }
          
          let logData: any = {
            type: vehicleType === "EV" ? "EV" : "ICE",
            date: extractedData.date || new Date().toISOString().split("T")[0],
            stationName: stationName,
            totalAmount: Number(extractedData.total_amount) || 0,
          };

          if (vehicleType === "EV") {
            logData = {
              ...logData,
              chargerType: touMatch ? "Home Charger" : (extractedData.charger_type || "DC Fast Charge"),
              energyKwh: Number(extractedData.energy_kwh) || 0,
            };
          } else {
            logData = {
              ...logData,
              fuelType: extractedData.fuel_type || "Gasohol 95",
              volumeLiters: Number(extractedData.volume_liters) || 0,
              pricePerLiter: Number(extractedData.price_per_liter) || 0,
            };
          }

          onScanComplete(logData as any);
        } else {
          throw new Error(resData.error || "ไม่สามารถแยกแยะข้อมูลใบเสร็จได้ กรุณากรอกด้วยตนเอง");
        }
      } catch (err: any) {
        setError(err.message || "เกิดข้อผิดพลาดระหว่างแชทกับโมเดล OCR");
      } finally {
        setLoading(false);
      }
    };

    base64Reader.onerror = () => {
      clearInterval(interval);
      setError("ไม่สามารถอ่านรูปภาพใบเสร็จนี้ได้");
      setLoading(false);
    };

    base64Reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">AI OCR สแกนใบเสร็จ</h3>
            <p className="text-slate-400 text-xs">วิเคราะห์ค่าน้ำมัน/ค่าชาร์จไฟอัตโนมัติด้วย AI</p>
          </div>
        </div>
        {previewUrl && !error && !loading && (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
            Success
          </span>
        )}
      </div>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[180px] ${
          dragActive
            ? "border-indigo-500 bg-indigo-50/40 scale-[0.99]"
            : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50/80"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
        />

        {previewUrl && !loading ? (
          <div className="relative w-full max-w-[120px] aspect-auto mb-3 rounded-xl overflow-hidden border border-slate-200 shadow-xs">
            <img src={previewUrl} alt="Receipt preview" className="w-full object-contain max-h-[120px]" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
              <span className="text-white text-xs font-semibold">เปลี่ยนรูปภาพ</span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 mb-3 group-hover:scale-105 transition-transform duration-200 shadow-2xs">
            <Upload className="w-6 h-6 text-indigo-500" />
          </div>
        )}

        <div className="space-y-1">
          <p className="font-medium text-slate-700 text-sm">
            ลากและวางรูปภาพ หรือ <span className="text-indigo-600 font-bold hover:underline">คลิกเพื่ออัปโหลด</span>
          </p>
          <p className="text-[11px] text-slate-400">รองรับไฟล์ JPG, PNG, WebP</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center gap-4"
          >
            <div className="relative flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-indigo-700">ประมวลผลด้วย Gemini AI</span>
                <span className="text-[10px] text-indigo-500 font-bold">
                  ขั้นตอนที่ {loadingStep + 1}/{loadingSteps.length}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-700 animate-pulse">{loadingSteps[loadingStep]}</p>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-800"
          >
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold">ไม่สามารถประมวลผลใบเสร็จนี้</p>
              <p className="text-rose-600 mt-1">{error}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewUrl(null);
                  setError(null);
                }}
                className="text-xs font-bold underline text-rose-700 hover:text-rose-950 mt-2 block"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
