import React from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export const OnlineStatusBadge: React.FC<{ className?: string }> = ({ className = "" }) => {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
        isOnline
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
          : "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
      } ${className}`}
      title={isOnline ? "ระบบเชื่อมต่ออินเทอร์เน็ตปกติ พร้อมใช้งานออนไลน์" : "โหมดออฟไลน์: บันทึกข้อมูลลงเครื่อง"}
    >
      <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500 animate-ping"}`} />
      {isOnline ? (
        <span className="flex items-center gap-1">
          <Wifi className="w-3 h-3 text-emerald-600" />
          <span>ออนไลน์</span>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <WifiOff className="w-3 h-3 text-amber-700" />
          <span>ออฟไลน์</span>
        </span>
      )}
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-xl backdrop-blur-xs border border-amber-400 animate-bounce">
      <WifiOff className="w-4 h-4 text-white shrink-0" />
      <span>โหมดออฟไลน์ — กำลังทำงานแบบไม่ต้องใช้อินเทอร์เน็ต ข้อมูลถูกบันทึกในเครื่อง</span>
    </div>
  );
};

export default OfflineIndicator;

