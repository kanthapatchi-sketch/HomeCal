import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App instance safely (prevent duplicate initialization)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Auth Provider with Google Drive scope
export const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: "select_account",
});

// Cache the access token purely in memory (never localStorage / sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
  description?: string;
}

/**
 * Initialize auth state listener. Call this on app load.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token not cached yet, user might be signed in without recent OAuth credential in memory
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Trigger Google Sign-in Popup to authenticate and obtain OAuth token with Drive scope
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("ไม่สามารถรับสิทธิ์ Access Token จาก Google ได้");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Set current in-memory access token (e.g. if acquired via credential)
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Sign out from Google Auth and clear in-memory token
 */
export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Upload backup payload to Google Drive using multipart upload
 */
export const uploadBackupToDrive = async (
  backupData: any,
  customName?: string
): Promise<DriveBackupFile> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("จำเป็นต้องเข้าสู่ระบบ Google ก่อนดำเนินการสำรองข้อมูล");
  }

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-");
  const fileName = customName || `vehicle_energy_tracker_backup_${dateStr.substring(0, 10)}.json`;

  const metadata = {
    name: fileName,
    description: `Vehicle Energy Tracker Backup - ${now.toLocaleString("th-TH")}`,
    mimeType: "application/json",
  };

  const boundary = "-------drive_backup_boundary_" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(backupData, null, 2) +
    closeDelim;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,modifiedTime,size,description",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `การอัปโหลดไฟล์ล้มเหลว (สถานะ ${response.status})`);
  }

  const uploadedFile: DriveBackupFile = await response.json();
  return uploadedFile;
};

/**
 * List all Vehicle Energy Tracker backup files stored in Google Drive
 */
export const listDriveBackups = async (): Promise<DriveBackupFile[]> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("จำเป็นต้องเข้าสู่ระบบ Google ก่อนดำเนินการ");
  }

  const q = encodeURIComponent(
    "name contains 'vehicle_energy_tracker' and trashed = false"
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,modifiedTime,size,description)&orderBy=modifiedTime desc`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `ไม่สามารถดึงรายการไฟล์จาก Drive ได้ (${response.status})`);
  }

  const data = await response.json();
  return (data.files as DriveBackupFile[]) || [];
};

/**
 * Download a backup file from Google Drive and parse as JSON
 */
export const downloadBackupFromDrive = async (fileId: string): Promise<any> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("จำเป็นต้องเข้าสู่ระบบ Google ก่อนดาวน์โหลดข้อมูล");
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`ไม่สามารถดาวน์โหลดไฟล์จาก Drive ได้ (สถานะ ${response.status})`);
  }

  const data = await response.json();
  return data;
};

/**
 * Delete a specific backup file from Google Drive
 */
export const deleteDriveBackup = async (fileId: string): Promise<void> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("จำเป็นต้องเข้าสู่ระบบ Google ก่อนลบไฟล์");
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`ไม่สามารถลบไฟล์ออกจาก Drive ได้ (สถานะ ${response.status})`);
  }
};
