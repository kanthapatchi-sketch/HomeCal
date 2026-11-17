import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Smartphone,
  Download,
  CheckCircle2,
  Copy,
  X,
  Sparkles,
  Globe,
  QrCode,
  Wifi
} from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { OnlineStatusBadge } from "./OfflineIndicator";

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AndroidInstallModal({
  isOpen,
  onClose,
}: AndroidInstallModalProps) {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"qr" | "chrome" | "samsung">("qr");

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://ais-pre-msp3ym43feuuqkjpfk7vyw-926909798896.asia-southeast1.run.app";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden max-h-[94vh] flex flex-col my-auto"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs shadow-xs">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg leading-snug">
                  ติดตั้งแอป Vehicle Energy Tracker บนมือถือ Android
                </h3>
                <p className="text-xs text-emerald-100 font-medium">
                  มาตรฐาน PWA เต็มหน้าจอ ไม่ต้องโหลดผ่าน Store ใช้งานออฟไลน์ได้
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Live Network & Offline Status Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-slate-700">ระบบตรวจจับสถานะเครือข่าย & ออฟไลน์:</span>
                  <span className="text-slate-500 ml-1">รองรับการใช้งานแม้ไม่มีเน็ต</span>
                </div>
              </div>
              <OnlineStatusBadge />
            </div>

            {/* Quick Install Banner if browser supports beforeinstallprompt */}
            {isInstalled ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-sm">แอปพลิเคชันนี้ถูกติดตั้งแล้ว!</div>
                  <div className="text-emerald-700 mt-0.5">
                    คุณกำลังเปิดใช้งานในโหมด Standalone อยู่บนอุปกรณ์นี้เรียบร้อยแล้ว
                  </div>
                </div>
              </div>
            ) : isInstallable ? (
              <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">เบราว์เซอร์รองรับการติดตั้งทันที</div>
                    <div className="text-[11px] text-emerald-100">แตะปุ่มเพื่อติดตั้งลงบนหน้าจอหลักของเครื่อง</div>
                  </div>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="px-4 py-2 bg-white text-emerald-800 font-extrabold text-xs rounded-xl shadow-xs hover:bg-slate-50 transition-all cursor-pointer shrink-0 active:scale-98"
                >
                  ติดตั้งทันที (Install)
                </button>
              </div>
            ) : null}

            {/* App Link Box with Copy Button */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  ลิงก์สำหรับเปิดบนโทรศัพท์ Android
                </span>
                <span className="text-[10px] text-slate-400">คัดลอกไปเปิดใน Chrome</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={appUrl}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>คัดลอกแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอก</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tabs Selector */}
            <div className="space-y-4">
              <div className="flex border-b border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab("qr")}
                  className={`pb-2.5 px-4 cursor-pointer transition-all border-b-2 flex items-center gap-1.5 ${
                    activeTab === "qr"
                      ? "border-emerald-600 text-emerald-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  สแกน QR Code (แนะนำ)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("chrome")}
                  className={`pb-2.5 px-4 cursor-pointer transition-all border-b-2 flex items-center gap-1.5 ${
                    activeTab === "chrome"
                      ? "border-emerald-600 text-emerald-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  วิธีทำผ่าน Chrome
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("samsung")}
                  className={`pb-2.5 px-4 cursor-pointer transition-all border-b-2 flex items-center gap-1.5 ${
                    activeTab === "samsung"
                      ? "border-emerald-600 text-emerald-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  วิธีทำผ่าน Samsung
                </button>
              </div>

              {/* Tab: QR Code */}
              {activeTab === "qr" && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4 animate-in fade-in duration-150">
                  <div className="w-40 h-40 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                        appUrl
                      )}`}
                      alt="Scan to open on Android"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-emerald-600" />
                      เปิดกล้องมือถือ Android เพื่อสแกน
                    </div>
                    <p className="leading-relaxed">
                      1. ใช้กล้องมือถือส่องที่ QR Code นี้เพื่อเปิดหน้าเว็บ
                    </p>
                    <p className="leading-relaxed">
                      2. บนหน้าเว็บใน Google Chrome ให้กด <strong>"ติดตั้งแอป"</strong> หรือจุด 3 จุด (⋮) &gt; <strong>"ติดตั้งแอป"</strong>
                    </p>
                    <p className="leading-relaxed text-emerald-700 font-medium">
                      ✓ ไอคอนจะปรากฏบนหน้าจอหลัก เปิดใช้งานได้เต็มหน้าจอทันที
                    </p>
                  </div>
                </div>
              )}

              {/* Tab: Google Chrome Instructions */}
              {activeTab === "chrome" && (
                <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-150">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-slate-700">
                      <strong>เปิดแอป Google Chrome บน Android</strong> จากนั้นเปิดลิงก์แอปนี้
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-150">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-slate-700">
                      แตะที่ <strong>ปุ่มเมนูจุด 3 จุด (⋮)</strong> มุมขวาบนของเบราว์เซอร์ Chrome
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-150">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs text-slate-700">
                      เลือกเมนู <strong>"ติดตั้งแอป" (Install app)</strong> หรือ <strong>"เพิ่มลงในหน้าจอหลัก" (Add to Home screen)</strong>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </div>
                    <div className="text-xs text-emerald-900">
                      แตะ <strong>"ติดตั้ง" (Install)</strong> รอสักครู่ ไอคอนแอป <strong>"EV Tracker"</strong> จะปรากฏบนหน้าจอหลักของโทรศัพท์ พร้อมเปิดใช้งานเต็มจอได้ทันที
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Samsung Internet Instructions */}
              {activeTab === "samsung" && (
                <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-150">
                    <div className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-slate-700">
                      เปิดลิงก์แอปบน <strong>Samsung Internet Browser</strong>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-150">
                    <div className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-slate-700">
                      แตะที่ <strong>ปุ่มเมนูขีดสามขีด (☰)</strong> ขวาล่าง หรือไอคอน <strong>ลูกศรชี้ลง (↓)</strong> ที่แถบ URL
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-cyan-50/60 rounded-2xl border border-cyan-200">
                    <div className="w-6 h-6 rounded-full bg-cyan-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs text-cyan-900">
                      เลือก <strong>"เพิ่มหน้าลงใน" (Add page to)</strong> &gt; <strong>"หน้าจอหลัก" (Home screen)</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Highlights of PWA on Android */}
            <div className="p-4 bg-gradient-to-br from-slate-50 to-emerald-50/30 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                จุดเด่นเมื่อติดตั้งลงเครื่อง Android
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside">
                <li>เปิดใช้งานเต็มหน้าจอ ไม่มีแถบเบราว์เซอร์มาบดบังสายตา</li>
                <li>ทำงานได้แม้ไม่มีเน็ต ด้วยระบบ Service Worker &amp; Local Storage Cache</li>
                <li>สแกนใบเสร็จและบันทึกประวัติได้อย่างรวดเร็ว</li>
                <li>เชื่อมโยงสำรองและกู้คืนข้อมูลผ่าน <strong>Google Drive</strong> ได้ตลอดเวลา</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">
              Progressive Web App (PWA) Standard
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              เข้าใจแล้ว ปิดหน้าต่าง
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

