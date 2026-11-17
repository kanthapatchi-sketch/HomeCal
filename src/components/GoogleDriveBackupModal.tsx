import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Cloud } from "lucide-react";
import GoogleDriveBackupCard from "./GoogleDriveBackupCard";

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBackupData: {
    vehicle_profile: any;
    energy_logs: any[];
    trip_logs: any[];
    [key: string]: any;
  };
  onRestoreBackup: (backupData: any) => void;
  onRequestConfirm: (modalConfig: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => void;
}

export default function GoogleDriveBackupModal({
  isOpen,
  onClose,
  currentBackupData,
  onRestoreBackup,
  onRequestConfirm,
}: GoogleDriveBackupModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  ระบบสำรองข้อมูลบน Google Drive
                </h3>
                <p className="text-xs text-slate-500">
                  ซิงค์และกู้คืนประวัติพลังงานของยานพาหนะผ่าน Google Drive
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-4">
            <GoogleDriveBackupCard
              currentBackupData={currentBackupData}
              onRestoreBackup={(data) => {
                onRestoreBackup(data);
                onClose();
              }}
              onRequestConfirm={onRequestConfirm}
            />
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
