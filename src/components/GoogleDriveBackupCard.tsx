import React, { useState, useEffect } from "react";
import {
  Cloud,
  UploadCloud,
  DownloadCloud,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  HardDrive,
  LogOut,
  FolderSync
} from "lucide-react";
import { User } from "firebase/auth";
import {
  googleSignIn,
  googleSignOut,
  getAccessToken,
  initAuth,
  uploadBackupToDrive,
  listDriveBackups,
  downloadBackupFromDrive,
  deleteDriveBackup,
  DriveBackupFile,
} from "../utils/googleDriveService";

interface GoogleDriveBackupCardProps {
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

export default function GoogleDriveBackupCard({
  currentBackupData,
  onRestoreBackup,
  onRequestConfirm,
}: GoogleDriveBackupCardProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const [driveFiles, setDriveFiles] = useState<DriveBackupFile[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setHasToken(!!token);
        if (token) {
          fetchDriveFiles();
        }
      },
      () => {
        setCurrentUser(null);
        setHasToken(false);
        setDriveFiles([]);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch list of files
  const fetchDriveFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const files = await listDriveBackups();
      setDriveFiles(files);
    } catch (err: any) {
      console.error("Failed to list drive files:", err);
      // If token expired or unauthorized, reset state
      if (err?.message?.includes("401") || err?.message?.includes("token")) {
        setHasToken(false);
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsLoadingAuth(true);
    setFeedback(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setHasToken(true);
        setFeedback({
          type: "success",
          message: `เชื่อมต่อ Google Drive ของคุณ (${result.user.email}) เรียบร้อยแล้ว`,
        });
        await fetchDriveFiles();
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setFeedback({
        type: "error",
        message: err?.message || "เข้าสู่ระบบ Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      setCurrentUser(null);
      setHasToken(false);
      setDriveFiles([]);
      setFeedback({
        type: "info",
        message: "ออกจากระบบ Google Drive เรียบร้อยแล้ว",
      });
    } catch (err: any) {
      console.error("Sign out error:", err);
    }
  };

  const handleBackupNow = async () => {
    const token = await getAccessToken();
    if (!token) {
      handleSignIn();
      return;
    }

    setIsBackingUp(true);
    setFeedback(null);

    try {
      const payload = {
        version: "1.0",
        backupDate: new Date().toISOString(),
        backupSource: "Google Drive Cloud Backup",
        vehicle_profile: currentBackupData.vehicle_profile,
        energy_logs: currentBackupData.energy_logs,
        trip_logs: currentBackupData.trip_logs,
      };

      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
      const fileName = `vehicle_energy_tracker_backup_${dateStr}_${timeStr}.json`;

      const uploaded = await uploadBackupToDrive(payload, fileName);

      setFeedback({
        type: "success",
        message: `สำรองข้อมูลขึ้น Google Drive สำเร็จ! (${uploaded.name})`,
      });

      await fetchDriveFiles();
    } catch (err: any) {
      console.error("Backup failed:", err);
      setFeedback({
        type: "error",
        message: err?.message || "เกิดข้อผิดพลาดในการสำรองข้อมูลขึ้น Google Drive",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = async (file: DriveBackupFile) => {
    onRequestConfirm({
      isOpen: true,
      title: "ยืนยันการกู้คืนข้อมูลจาก Google Drive",
      message: `คุณกำลังจะกู้คืนข้อมูลจากไฟล์ "${file.name}" (สำรองเมื่อ ${new Date(file.modifiedTime).toLocaleString("th-TH")})\n\nข้อมูลรถยนต์ ประวัติพลังงาน และประวัติเดินทางปัจจุบันจะถูกเขียนทับด้วยข้อมูลจากสำรองนี้ คุณต้องการดำเนินการต่อหรือไม่?`,
      confirmText: "กู้คืนข้อมูลเดี๋ยวนี้",
      cancelText: "ยกเลิก",
      isDestructive: true,
      onConfirm: async () => {
        setRestoringFileId(file.id);
        setFeedback(null);
        try {
          const data = await downloadBackupFromDrive(file.id);
          onRestoreBackup(data);
          setFeedback({
            type: "success",
            message: `กู้คืนข้อมูลจาก Google Drive สำเร็จเรียบร้อยแล้ว!`,
          });
        } catch (err: any) {
          console.error("Restore failed:", err);
          setFeedback({
            type: "error",
            message: err?.message || "ไม่สามารถกู้คืนข้อมูลจากไฟล์ได้",
          });
        } finally {
          setRestoringFileId(null);
        }
      },
    });
  };

  const handleDeleteFile = async (file: DriveBackupFile) => {
    onRequestConfirm({
      isOpen: true,
      title: "ยืนยันการลบไฟล์สำรองจาก Google Drive",
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์สำรอง "${file.name}" ออกจาก Google Drive ถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      confirmText: "ลบไฟล์ถาวร",
      cancelText: "ยกเลิก",
      isDestructive: true,
      onConfirm: async () => {
        setDeletingFileId(file.id);
        setFeedback(null);
        try {
          await deleteDriveBackup(file.id);
          setFeedback({
            type: "success",
            message: `ลบไฟล์สำรองออกจาก Google Drive แล้ว`,
          });
          await fetchDriveFiles();
        } catch (err: any) {
          console.error("Delete failed:", err);
          setFeedback({
            type: "error",
            message: err?.message || "ไม่สามารถลบไฟล์ออกจาก Google Drive ได้",
          });
        } finally {
          setDeletingFileId(null);
        }
      },
    });
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return "";
    const b = parseInt(bytes, 10);
    if (isNaN(b)) return "";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border border-indigo-200/90 rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/30 shadow-xs space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100/80 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-sky-500 text-white rounded-2xl shadow-sm shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-base">
                สำรองข้อมูลบน Google Drive (Cloud Backup)
              </h3>
              <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-bold rounded-full border border-sky-200">
                Google Workspace
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              เก็บรักษาข้อมูลยานพาหนะ บันทึกพลังงาน และประวัติขับขี่บนคลาวด์ Google Drive ของคุณโดยตรง ซิงค์ได้ทุกอุปกรณ์
            </p>
          </div>
        </div>

        {/* User Status / Connection */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {currentUser && hasToken ? (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-3xs">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || "User"}
                  className="w-6 h-6 rounded-full border border-slate-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0">
                  {(currentUser.displayName || currentUser.email || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="text-left max-w-[130px] truncate">
                <div className="text-[11px] font-bold text-slate-800 truncate">
                  {currentUser.displayName || "ผู้ใช้ Google"}
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {currentUser.email}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors ml-1 cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoadingAuth}
              className="inline-flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition-all cursor-pointer disabled:opacity-60 active:scale-98"
            >
              {isLoadingAuth ? (
                <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              )}
              <span>เข้าสู่ระบบด้วย Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : feedback.type === "error"
              ? "bg-rose-50 text-rose-800 border border-rose-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : feedback.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-[11px] ml-2 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Backup Now Button */}
        <button
          type="button"
          onClick={handleBackupNow}
          disabled={isBackingUp}
          className="p-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-60 text-white font-bold rounded-2xl shadow-sm transition-all cursor-pointer flex items-center justify-between group active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl group-hover:scale-105 transition-transform">
              {isBackingUp ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
              ) : (
                <UploadCloud className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="text-left">
              <div className="text-xs font-black">สำรองข้อมูลขึ้น Google Drive เดี๋ยวนี้</div>
              <div className="text-[10px] text-indigo-100 font-medium opacity-85">
                {currentBackupData.energy_logs.length} ประวัติเติม · {currentBackupData.trip_logs.length} ทริป
              </div>
            </div>
          </div>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg text-white font-mono">
            Save
          </span>
        </button>

        {/* Refresh Backups List Button */}
        <button
          type="button"
          onClick={fetchDriveFiles}
          disabled={!hasToken || isLoadingFiles}
          className="p-4 bg-white hover:bg-slate-50 disabled:opacity-60 border border-slate-200 text-slate-700 font-bold rounded-2xl shadow-3xs transition-all cursor-pointer flex items-center justify-between active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
              <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? "animate-spin text-indigo-600" : ""}`} />
            </div>
            <div className="text-left">
              <div className="text-xs font-black text-slate-800">ตรวจสอบไฟล์สำรองบน Drive</div>
              <div className="text-[10px] text-slate-400 font-medium">
                {hasToken ? `พบ ${driveFiles.length} ไฟล์สำรอง` : "เข้าสู่ระบบเพื่อดูประวัติ"}
              </div>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {hasToken ? "Sync" : "Lock"}
          </span>
        </button>
      </div>

      {/* Files List from Google Drive */}
      {hasToken ? (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              รายการไฟล์สำรองบน Google Drive ({driveFiles.length})
            </span>
            {isLoadingFiles && (
              <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                <span className="w-2.5 h-2.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                กำลังโหลด...
              </span>
            )}
          </div>

          {driveFiles.length === 0 ? (
            <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
              <FolderSync className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <span>ยังไม่มีไฟล์สำรองบน Google Drive ของคุณ</span>
              <p className="text-[11px] text-slate-400 mt-1">
                กดปุ่ม <strong>"สำรองข้อมูลขึ้น Google Drive เดี๋ยวนี้"</strong> ด้านบนเพื่อสร้างไฟล์สำรองแรก
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {driveFiles.map((file) => (
                <div
                  key={file.id}
                  className="bg-white border border-slate-200/80 hover:border-indigo-300 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all shadow-3xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 truncate max-w-[260px] sm:max-w-xs" title={file.name}>
                        {file.name}
                      </span>
                      {file.size && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-md">
                          {formatFileSize(file.size)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {new Date(file.modifiedTime).toLocaleString("th-TH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestoreFile(file)}
                      disabled={restoringFileId === file.id}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-60"
                      title="กู้คืนข้อมูลจากไฟล์นี้"
                    >
                      {restoringFileId === file.id ? (
                        <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <DownloadCloud className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>กู้คืน</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteFile(file)}
                      disabled={deletingFileId === file.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                      title="ลบไฟล์สำรองนี้"
                    >
                      {deletingFileId === file.id ? (
                        <span className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <span>เข้าสู่ระบบด้วย Google เพื่อเข้าถึงไฟล์สำรองและซิงค์ข้อมูลบนคลาวด์</span>
        </div>
      )}

      {/* Security Note */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-150/70">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>ความปลอดภัย: แอปพลิเคชันเข้าถึงเฉพาะไฟล์สำรองที่สร้างโดยแอปนี้เท่านั้น (drive.file)</span>
        </span>
        <span className="font-mono">Google Drive API v3</span>
      </div>
    </div>
  );
}
