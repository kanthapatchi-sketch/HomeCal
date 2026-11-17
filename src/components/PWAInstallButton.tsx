import React from "react";
import { Download, Smartphone, QrCode } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

interface PWAInstallButtonProps {
  onOpenGuide: () => void;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenGuide,
  className = "",
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // If browser fired beforeinstallprompt (Chromium / Android Chrome)
  if (isInstallable && !isInstalled) {
    return (
      <button
        type="button"
        onClick={async () => {
          const success = await install();
          if (!success) {
            onOpenGuide();
          }
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 ${className}`}
        title="ติดตั้งแอปลงโทรศัพท์ Android หรือคอมพิวเตอร์"
      >
        <Download className="w-4 h-4 animate-bounce" />
        <span>ติดตั้งแอป Android</span>
      </button>
    );
  }

  // Always show guide button so user can scan QR or view step-by-step instructions
  return (
    <button
      type="button"
      onClick={onOpenGuide}
      className={`inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 border border-emerald-400/50 ${className}`}
      title="เปิดวิธีติดตั้งแอปลงโทรศัพท์ Android และสแกน QR Code"
    >
      <Smartphone className="w-4 h-4" />
      <span>ลงแอป Android</span>
      <QrCode className="w-3.5 h-3.5 text-emerald-100" />
    </button>
  );
};

export default PWAInstallButton;

