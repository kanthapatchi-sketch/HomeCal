import React, { useState, useEffect, useMemo } from "react";
import {
  Car,
  Settings,
  History,
  Trash2,
  Calendar,
  MapPin,
  TrendingUp,
  Droplet,
  Zap,
  DollarSign,
  Leaf,
  Plus,
  Cpu,
  Info,
  Pencil,
  X,
  Compass,
  Route,
  Sparkles,
  FileText,
  Download,
  Upload,
  AlertTriangle,
  Filter,
  Building2,
  Home,
  Plug,
  Cloud,
  Smartphone,
  QrCode
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Vehicle, EnergyLog, VehicleType, TripLog, ChargeLog } from "./types";
import LogForm from "./components/LogForm";
import EnergyCharts from "./components/EnergyCharts";
import BatteryHealthDashboard from "./components/BatteryHealthDashboard";
import InsightReport from "./components/InsightReport";
import AiGuruChat from "./components/AiGuruChat";
import ReportSummary from "./components/ReportSummary";
import ChargingCalculatorModal from "./components/ChargingCalculatorModal";
import TouStationSettingsModal from "./components/TouStationSettingsModal";
import EfficiencyAlertBanner from "./components/EfficiencyAlertBanner";
import GoogleDriveBackupCard from "./components/GoogleDriveBackupCard";
import GoogleDriveBackupModal from "./components/GoogleDriveBackupModal";
import AndroidInstallModal from "./components/AndroidInstallModal";
import PWAInstallButton from "./components/PWAInstallButton";
import OfflineIndicator, { OnlineStatusBadge } from "./components/OfflineIndicator";
import { monitorEnergyEfficiency } from "./utils/efficiencyMonitor";
import { StationBadgeCell, EnergyTypeBadgeCell } from "./utils/stationBadges";

export default function App() {
  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<"energy" | "travel" | "ai" | "reports">("energy");

  // TOU Station Modal State
  const [isTouModalOpen, setIsTouModalOpen] = useState(false);

  // Google Drive Cloud Backup Modal State
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  // Android & PWA Install Modal State
  const [isAndroidInstallModalOpen, setIsAndroidInstallModalOpen] = useState(false);

  // Efficiency Alert State
  const [isEfficiencyAlertDismissed, setIsEfficiencyAlertDismissed] = useState(false);

  // 1. Vehicle Setup State
  const [vehicle, setVehicle] = useState<Vehicle>({
    type: "ICE",
    model: "Toyota Corolla Cross Hybrid",
    fuelCapacity: 36,
  });

  const [showConfig, setShowConfig] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "backup">("profile");
  const [energySubTab, setEnergySubTab] = useState<"general" | "battery">("general");
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [initialSohTab, setInitialSohTab] = useState<"analysis" | "history" | "tips" | "charge100">("analysis");
  const [aiCharge100Alert, setAiCharge100Alert] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [tempModel, setTempModel] = useState(vehicle.model);
  const [tempType, setTempType] = useState<VehicleType>(vehicle.type);
  const [tempCapacity, setTempCapacity] = useState(36);
  const [tempBatteryType, setTempBatteryType] = useState<"LFP" | "NMC" | "NCA">(vehicle.batteryType || "LFP");

  // 2. Fuel / Electric Logs State
  const [logs, setLogs] = useState<EnergyLog[]>([]);
  const [scannedData, setScannedData] = useState<Partial<EnergyLog> | null>(null);
  const [logFilter, setLogFilter] = useState<string>("all");

  const displayLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    if (logFilter === "DC") {
      return logs.filter(
        (l) => l.type === "EV" && (l.chargerType || "").toLowerCase().includes("dc")
      );
    }
    if (logFilter === "AC") {
      return logs.filter(
        (l) =>
          l.type === "EV" &&
          ((l.chargerType || "").toLowerCase().includes("ac") ||
            (l.chargerType || "").toLowerCase().includes("normal"))
      );
    }
    if (logFilter === "Home") {
      return logs.filter(
        (l) =>
          l.type === "EV" &&
          ((l.chargerType || "").toLowerCase().includes("home") ||
            (l.chargerType || "").toLowerCase().includes("tou") ||
            (l.stationName || "").toLowerCase().includes("home") ||
            (l.stationName || "").includes("บ้าน"))
      );
    }
    if (logFilter === "ICE") {
      return logs.filter((l) => l.type === "ICE");
    }
    return logs;
  }, [logs, logFilter]);

  // 3. Trip / Travel Logs State (เมนูเดินทาง)
  const [tripLogs, setTripLogs] = useState<TripLog[]>([]);
  
  // Trip Form States
  const [tripDate, setTripDate] = useState(new Date().toISOString().split("T")[0]);
  const [tripTitle, setTripTitle] = useState("");
  const [tripType, setTripType] = useState<"A" | "B">("A");
  const [tripDistanceKm, setTripDistanceKm] = useState("");
  const [tripNotes, setTripNotes] = useState("");
  const [tripInputMode, setTripInputMode] = useState<"distance" | "odometer">("distance");
  const [tripOdometer, setTripOdometer] = useState("");
  const [tripStartOdometer, setTripStartOdometer] = useState("");
  const [tripFilter, setTripFilter] = useState<"All" | "A" | "B">("All");
  const [tripStartBatteryPct, setTripStartBatteryPct] = useState("");
  const [tripEndBatteryPct, setTripEndBatteryPct] = useState("");
  const [tripDrivingMode, setTripDrivingMode] = useState<"ECO" | "Comfort" | "Sport">("Comfort");

  // Trip Draft States & Handlers
  const [hasTripDraft, setHasTripDraft] = useState(false);

  useEffect(() => {
    const savedDraft = localStorage.getItem("trip_log_draft");
    if (savedDraft) {
      setHasTripDraft(true);
    }
  }, []);

  const handleSaveTripDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    const draftData = {
      tripDate,
      tripTitle,
      tripType,
      tripDistanceKm,
      tripNotes,
      tripInputMode,
      tripOdometer,
      tripStartOdometer,
      tripStartBatteryPct,
      tripEndBatteryPct,
      tripDrivingMode,
    };
    localStorage.setItem("trip_log_draft", JSON.stringify(draftData));
    setHasTripDraft(true);
    alert("บันทึกแบบร่างทริปเดินทางเรียบร้อยแล้ว!");
  };

  const handleLoadTripDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    const savedDraft = localStorage.getItem("trip_log_draft");
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setTripDate(draft.tripDate || new Date().toISOString().split("T")[0]);
        setTripTitle(draft.tripTitle || "");
        setTripType(draft.tripType || "A");
        setTripDistanceKm(draft.tripDistanceKm || "");
        setTripNotes(draft.tripNotes || "");
        setTripInputMode(draft.tripInputMode || "distance");
        setTripOdometer(draft.tripOdometer || "");
        setTripStartOdometer(draft.tripStartOdometer || "");
        setTripStartBatteryPct(draft.tripStartBatteryPct || "");
        setTripEndBatteryPct(draft.tripEndBatteryPct || "");
        setTripDrivingMode(draft.tripDrivingMode || "Comfort");
        alert("เรียกคืนข้อมูลแบบร่างเดินทางเรียบร้อยแล้ว!");
      } catch (err) {
        console.error("Failed to load trip draft", err);
      }
    }
  };

  const handleClearTripDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem("trip_log_draft");
    setHasTripDraft(false);
    alert("ล้างแบบร่างเดินทางเรียบร้อยแล้ว");
  };

  // Edit Trip Modal States
  const [editingTrip, setEditingTrip] = useState<TripLog | null>(null);
  const [editTripDate, setEditTripDate] = useState("");
  const [editTripTitle, setEditTripTitle] = useState("");
  const [editTripType, setEditTripType] = useState<"A" | "B">("A");
  const [editTripDistanceKm, setEditTripDistanceKm] = useState("");
  const [editTripNotes, setEditTripNotes] = useState("");
  const [editTripInputMode, setEditTripInputMode] = useState<"distance" | "odometer">("distance");
  const [editTripOdometer, setEditTripOdometer] = useState("");
  const [editTripStartOdometer, setEditTripStartOdometer] = useState("");
  const [editTripStartBatteryPct, setEditTripStartBatteryPct] = useState("");
  const [editTripEndBatteryPct, setEditTripEndBatteryPct] = useState("");
  const [editTripDrivingMode, setEditTripDrivingMode] = useState<"ECO" | "Comfort" | "Sport">("Comfort");

  // 4. Edit Log Modal States
  const [editingLog, setEditingLog] = useState<EnergyLog | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStationName, setEditStationName] = useState("");
  const [editTotalAmount, setEditTotalAmount] = useState("");
  const [editOdometerReading, setEditOdometerReading] = useState("");

  // ICE specific edit
  const [editFuelType, setEditFuelType] = useState("");
  const [editVolumeLiters, setEditVolumeLiters] = useState("");
  const [editPricePerLiter, setEditPricePerLiter] = useState("");

  // EV specific edit
  const [editChargerType, setEditChargerType] = useState("");
  const [editEnergyKwh, setEditEnergyKwh] = useState("");
  const [editStartBatteryPct, setEditStartBatteryPct] = useState("");
  const [editEndBatteryPct, setEditEndBatteryPct] = useState("");

  // 5. Custom Non-Blocking Confirmation Dialog
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedVehicle = localStorage.getItem("vehicle_profile");
    if (savedVehicle) {
      try {
        const parsed = JSON.parse(savedVehicle);
        setVehicle(parsed);
        setTempModel(parsed.model);
        setTempType(parsed.type);
        setTempCapacity(parsed.fuelCapacity || parsed.batteryCapacity || 50);
      } catch (e) {
        console.error("Failed to parse saved vehicle", e);
      }
    }

    const savedLogs = localStorage.getItem("energy_logs");
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error("Failed to parse saved logs", e);
      }
    } else {
      // Seed initial dummy data for ICE/EV to give a beautiful live demo on first load
      const initialLogs: EnergyLog[] = [
        {
          id: "seed-1",
          type: "ICE",
          date: "2026-06-10",
          stationName: "PTT Station พหลโยธิน",
          fuelType: "Gasohol 95",
          volumeLiters: 35.5,
          pricePerLiter: 38.2,
          totalAmount: 1356.1,
          odometerReading: 12450,
          distanceKm: 480,
        },
        {
          id: "seed-2",
          type: "ICE",
          date: "2026-06-25",
          stationName: "Bangchak Vibhavadi",
          fuelType: "Gasohol E20",
          volumeLiters: 32.8,
          pricePerLiter: 36.4,
          totalAmount: 1193.9,
          odometerReading: 12970,
          distanceKm: 520,
        },
        {
          id: "seed-3",
          type: "ICE",
          date: "2026-07-02",
          stationName: "Shell ลาดพร้าว",
          fuelType: "Gasohol 95",
          volumeLiters: 34.2,
          pricePerLiter: 38.5,
          totalAmount: 1316.7,
          odometerReading: 13490,
          distanceKm: 520,
        },
      ];
      setLogs(initialLogs);
      localStorage.setItem("energy_logs", JSON.stringify(initialLogs));
    }

    const savedTrips = localStorage.getItem("trip_logs");
    if (savedTrips) {
      try {
        setTripLogs(JSON.parse(savedTrips));
      } catch (e) {
        console.error("Failed to parse saved trips", e);
      }
    } else {
      const initialTripLogs: TripLog[] = [
        {
          id: "trip-seed-1",
          date: "2026-07-01",
          title: "ขับรถไปทำงานประจำวัน",
          tripType: "A",
          distanceKm: 24.5,
          notes: "การจราจรค่อนข้างหนาแน่นช่วงเช้า"
        },
        {
          id: "trip-seed-2",
          date: "2026-07-03",
          title: "เดินทางไปกลับ กรุงเทพฯ-พัทยา",
          tripType: "B",
          distanceKm: 310.2,
          notes: "วิ่งทางด่วนมอเตอร์เวย์ ความเร็วสม่ำเสมอ"
        }
      ];
      setTripLogs(initialTripLogs);
      localStorage.setItem("trip_logs", JSON.stringify(initialTripLogs));
    }
  }, []);

  // Sync AI 100% Charge Alert from localStorage and run proactive background analysis
  useEffect(() => {
    // 1. First, load existing cached analysis to display immediately
    const cached = localStorage.getItem("ai_charge_100_analysis");
    if (cached) {
      try {
        setAiCharge100Alert(JSON.parse(cached));
      } catch (e) {
        // ignore cached error
      }
    } else {
      setAiCharge100Alert(null);
    }

    if (vehicle.type !== "EV") return;

    // 2. Check if the current state matches the cached signature to prevent redundant API calls
    const signature = `${logs.length}-${tripLogs.length}-${vehicle.model}-${vehicle.batteryCapacity || ""}`;
    const cachedSig = localStorage.getItem("ai_charge_100_signature");

    if (cachedSig === signature) return;

    let isMounted = true;

    const runProactiveAnalysis = async () => {
      try {
        const sorted = [...logs]
          .filter((l) => l.type === "EV")
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const lastBatteryPct = sorted[0]?.endBatteryPct !== undefined ? sorted[0].endBatteryPct : 100;

        const response = await fetch("/api/analyze-charge-100", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicle,
            logs,
            tripLogs,
            currentBatteryPct: lastBatteryPct,
            userNotes: ""
          })
        });

        if (!response.ok) return;

        const resData = await response.json();
        if (isMounted && resData.status === "success" && resData.analysis) {
          setAiCharge100Alert(resData.analysis);
          localStorage.setItem("ai_charge_100_analysis", JSON.stringify(resData.analysis));
          localStorage.setItem("ai_charge_100_signature", signature);
        }
      } catch (err) {
        console.warn("Proactive AI Analysis silent error:", err);
      }
    };

    // Debounce the call to avoid rapid triggers during initial state loads or rapid logs additions
    const timer = setTimeout(() => {
      runProactiveAnalysis();
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [logs, tripLogs, vehicle]);

  // Save changes to localStorage
  const saveVehicleSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const newVehicle: Vehicle = {
      type: tempType,
      model: tempModel,
      fuelCapacity: tempType === "ICE" ? tempCapacity : undefined,
      batteryCapacity: tempType === "EV" ? tempCapacity : undefined,
      batteryType: tempType === "EV" ? tempBatteryType : undefined,
    };
    setVehicle(newVehicle);
    localStorage.setItem("vehicle_profile", JSON.stringify(newVehicle));
    localStorage.removeItem("ai_charge_100_signature"); // Reset signature to force refresh advisor
    setShowConfig(false);
  };

  const handleExportBackup = (format: "json" | "csb" = "json") => {
    const backupData = {
      version: "1.0",
      backupDate: new Date().toISOString(),
      vehicle_profile: vehicle,
      energy_logs: logs,
      trip_logs: tripLogs,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: format === "json" ? "application/json;charset=utf-8;" : "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", url);
    
    const dateStr = new Date().toISOString().split("T")[0];
    downloadAnchor.setAttribute("download", `vehicle_energy_tracker_backup_${dateStr}.${format}`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportEnergyCSV = () => {
    const headers = [
      "วันที่",
      "ประเภทรถ",
      "ชื่อสถานี",
      "ชนิดเชื้อเพลิง/เครื่องชาร์จ",
      "ปริมาณ (ลิตร/kWh)",
      "ราคาต่อหน่วย (บาท)",
      "ยอดเงินสุทธิ (บาท)",
      "เลขไมล์ (กิโลเมตร)",
      "ระยะทางจากครั้งก่อน (กิโลเมตร)",
      "Trip A (กิโลเมตร)",
      "Trip B (กิโลเมตร)",
      "แบตเตอรี่เริ่มต้น (%)",
      "แบตเตอรี่เป้าหมาย (%)"
    ];

    const rows = logs.map(log => {
      if (log.type === "EV") {
        return [
          log.date,
          "EV (ไฟฟ้า)",
          `"${(log.stationName || "").replace(/"/g, '""')}"`,
          `"${(log.chargerType || "").replace(/"/g, '""')}"`,
          log.energyKwh,
          "-",
          log.totalAmount,
          log.odometerReading || "-",
          log.distanceKm || "-",
          log.tripA || "-",
          log.tripB || "-",
          log.startBatteryPct !== undefined ? log.startBatteryPct : "-",
          log.endBatteryPct !== undefined ? log.endBatteryPct : "-"
        ];
      } else {
        return [
          log.date,
          "ICE (น้ำมัน)",
          `"${(log.stationName || "").replace(/"/g, '""')}"`,
          `"${(log.fuelType || "").replace(/"/g, '""')}"`,
          log.volumeLiters,
          log.pricePerLiter,
          log.totalAmount,
          log.odometerReading || "-",
          log.distanceKm || "-",
          log.tripA || "-",
          log.tripB || "-",
          "-",
          "-"
        ];
      }
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `energy_logs_export_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTripCSV = () => {
    const headers = [
      "วันที่",
      "ชื่อการเดินทาง/รายละเอียด",
      "ประเภท Trip",
      "ระยะทาง (กิโลเมตร)",
      "เลขไมล์เริ่ม (กิโลเมตร)",
      "เลขไมล์สิ้นสุด (กิโลเมตร)",
      "โหมดการขับขี่",
      "แบตเตอรี่เริ่ม (%)",
      "แบตเตอรี่สิ้นสุด (%)",
      "แบตเตอรี่ที่ใช้ (%)",
      "หมายเหตุ"
    ];

    const rows = tripLogs.map(trip => {
      const batUsed = (trip.startBatteryPct !== undefined && trip.endBatteryPct !== undefined)
        ? (trip.startBatteryPct - trip.endBatteryPct)
        : "-";
      return [
        trip.date,
        `"${(trip.title || "").replace(/"/g, '""')}"`,
        trip.tripType,
        trip.distanceKm,
        trip.startOdometerReading || "-",
        trip.odometerReading || "-",
        trip.drivingMode || "-",
        trip.startBatteryPct !== undefined ? trip.startBatteryPct : "-",
        trip.endBatteryPct !== undefined ? trip.endBatteryPct : "-",
        batUsed,
        `"${(trip.notes || "").replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `trip_logs_export_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBackupPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);

    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    tempContainer.style.top = "-9999px";
    tempContainer.style.width = "800px";

    // Overall summary calculations
    const totalCost = logs.reduce((sum, log) => sum + log.totalAmount, 0);
    const totalEnergy = logs.reduce((sum, log) => {
      if (log.type === "EV") {
        return sum + (log.energyKwh || 0);
      } else {
        return sum + (log.volumeLiters || 0);
      }
    }, 0);
    const totalDistance = tripLogs.reduce((sum, trip) => sum + trip.distanceKm, 0);

    // Calculate Monthly Average Energy Efficiency
    const thaiMonthNames = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    const monthsMap: Record<string, { logs: EnergyLog[]; trips: TripLog[] }> = {};

    logs.forEach(log => {
      if (!log.date) return;
      const mKey = log.date.substring(0, 7);
      if (!monthsMap[mKey]) monthsMap[mKey] = { logs: [], trips: [] };
      monthsMap[mKey].logs.push(log);
    });

    tripLogs.forEach(trip => {
      if (!trip.date) return;
      const mKey = trip.date.substring(0, 7);
      if (!monthsMap[mKey]) monthsMap[mKey] = { logs: [], trips: [] };
      monthsMap[mKey].trips.push(trip);
    });

    const sortedMonthKeys = Object.keys(monthsMap).sort((a, b) => b.localeCompare(a));

    const monthlySummaries = sortedMonthKeys.map(mKey => {
      const [yStr, mStr] = mKey.split("-");
      const yNum = parseInt(yStr, 10);
      const mNum = parseInt(mStr, 10) - 1;
      const monthLabel = `${thaiMonthNames[mNum]} ${yNum + 543}`;

      const mLogs = monthsMap[mKey].logs;
      const mTrips = monthsMap[mKey].trips;

      const mCost = mLogs.reduce((sum, l) => sum + (l.totalAmount || 0), 0);
      const mEnergy = mLogs.reduce((sum, l) => {
        if (l.type === "EV") return sum + (l.energyKwh || 0);
        return sum + (l.volumeLiters || 0);
      }, 0);

      let mDist = mTrips.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
      if (mDist === 0 && mLogs.length > 0) {
        mDist = mLogs.reduce((sum, l) => sum + (l.distanceKm || 0), 0);
      }

      const eff = (mDist > 0 && mEnergy > 0) ? (mDist / mEnergy) : null;
      const costPerKm = (mDist > 0 && mCost > 0) ? (mCost / mDist) : null;

      return {
        mKey,
        monthLabel,
        totalCost: mCost,
        totalEnergy: mEnergy,
        totalDist: mDist,
        eff,
        costPerKm
      };
    });

    // Chunk logs and tripLogs into page chunks (18 items per page)
    const logChunkSize = 18;
    const logChunks: EnergyLog[][] = [];
    for (let i = 0; i < logs.length; i += logChunkSize) {
      logChunks.push(logs.slice(i, i + logChunkSize));
    }
    if (logChunks.length === 0) logChunks.push([]);

    const tripChunkSize = 18;
    const tripChunks: TripLog[][] = [];
    for (let i = 0; i < tripLogs.length; i += tripChunkSize) {
      tripChunks.push(tripLogs.slice(i, i + tripChunkSize));
    }
    if (tripChunks.length === 0) tripChunks.push([]);

    const totalPages = 1 + logChunks.length + tripChunks.length;
    const printDate = `${new Date().toLocaleDateString("th-TH")} ${new Date().toLocaleTimeString("th-TH")}`;

    const pages: HTMLDivElement[] = [];

    // --- PAGE 1: Overview & Monthly Average Energy Efficiency Summary Table ---
    const page1 = document.createElement("div");
    page1.style.width = "800px";
    page1.style.minHeight = "1130px";
    page1.style.padding = "35px";
    page1.style.backgroundColor = "#ffffff";
    page1.style.boxSizing = "border-box";
    page1.style.fontFamily = "system-ui, -apple-system, sans-serif, 'Helvetica Neue'";
    page1.style.color = "#0f172a";
    page1.style.display = "flex";
    page1.style.flexDirection = "column";
    page1.style.justifyContent = "space-between";

    page1.innerHTML = `
      <div>
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #4f46e5; padding-bottom: 14px; margin-bottom: 20px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px;">Vehicle Energy Tracker</h1>
            <p style="font-size: 13px; color: #4f46e5; font-weight: 700; margin: 4px 0 0 0;">รายงานสรุปประสิทธิภาพพลังงานและสถิติการใช้งานสะสม</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">วันที่พิมพ์รายงาน</div>
            <div style="font-size: 12px; color: #334155; font-weight: bold; margin-top: 2px;">${printDate}</div>
          </div>
        </div>

        <!-- Vehicle Profile Summary -->
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between;">
          <div style="width: 48%;">
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">โปรไฟล์ยานพาหนะในระบบ</div>
            <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 4px;">${vehicle.model}</div>
            <div style="font-size: 12px; color: #475569; margin-top: 4px;">ประเภท: ${vehicle.type === "EV" ? "⚡ รถยนต์ไฟฟ้า 100% (BEV)" : "⛽ รถยนต์น้ำมัน / ไฮบริด (ICE)"}</div>
            <div style="font-size: 12px; color: #475569; margin-top: 2px;">ความจุถัง/แบตเตอรี่: ${vehicle.type === "EV" ? `${vehicle.batteryCapacity || 60} kWh` : `${vehicle.fuelCapacity || 50} ลิตร`}</div>
          </div>
          <div style="width: 48%; border-left: 1px solid #e2e8f0; padding-left: 20px; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
            <div style="font-size: 12px; color: #64748b;"><span style="font-weight: bold; color: #334155;">ประวัติเติมพลังงาน:</span> ${logs.length} ครั้ง</div>
            <div style="font-size: 12px; color: #64748b;"><span style="font-weight: bold; color: #334155;">ประวัติการขับขี่:</span> ${tripLogs.length} รายการ</div>
            <div style="font-size: 12px; color: #64748b;"><span style="font-weight: bold; color: #334155;">ระยะทางรวม:</span> ${totalDistance.toLocaleString()} กิโลเมตร</div>
            <div style="font-size: 12px; color: #64748b;"><span style="font-weight: bold; color: #334155;">ค่าใช้จ่ายสะสมรวม:</span> ฿${totalCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
          </div>
        </div>

        <!-- Monthly Average Energy Efficiency Summary Table -->
        <div style="margin-top: 10px;">
          <h2 style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px;">
            <span>📊 ตารางสรุปประสิทธิภาพพลังงานเฉลี่ยรายเดือน (Monthly Energy Efficiency Summary)</span>
            <span style="font-size: 10px; font-weight: 700; color: #4f46e5; background-color: #eef2ff; padding: 2px 8px; border-radius: 6px;">
              ${vehicle.type === "EV" ? "หน่วย: กม./kWh" : "หน่วย: กม./ลิตร"}
            </span>
          </h2>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #334155;">
                <th style="padding: 10px; font-weight: 800;">เดือน / ปี</th>
                <th style="padding: 10px; font-weight: 800; text-align: right;">พลังงานที่เติมรวม</th>
                <th style="padding: 10px; font-weight: 800; text-align: right;">ค่าใช้จ่ายรวม</th>
                <th style="padding: 10px; font-weight: 800; text-align: right;">ระยะทางรวม</th>
                <th style="padding: 10px; font-weight: 800; text-align: right; color: #4f46e5;">ประสิทธิภาพเฉลี่ย</th>
                <th style="padding: 10px; font-weight: 800; text-align: right; color: #059669;">ค่าใช้จ่ายต่อ กม.</th>
              </tr>
            </thead>
            <tbody>
              ${monthlySummaries.length === 0 ? `
                <tr>
                  <td colspan="6" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">ไม่มีข้อมูลประวัติย้อนหลังสำหรับสรุปรายเดือน</td>
                </tr>
              ` : monthlySummaries.map((m, idx) => `
                <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                  <td style="padding: 9px 10px; font-weight: 700; color: #0f172a;">${m.monthLabel}</td>
                  <td style="padding: 9px 10px; text-align: right; font-weight: 600; color: #334155;">
                    ${m.totalEnergy.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${vehicle.type === "EV" ? "kWh" : "ลิตร"}
                  </td>
                  <td style="padding: 9px 10px; text-align: right; font-weight: 700; color: #0f172a;">
                    ฿${m.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td style="padding: 9px 10px; text-align: right; font-weight: 600; color: #334155;">
                    ${m.totalDist.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} กม.
                  </td>
                  <td style="padding: 9px 10px; text-align: right; font-weight: 800; color: #4f46e5; background-color: ${idx % 2 === 1 ? '#eef2ff' : '#f5f3ff'};">
                    ${m.eff ? `${m.eff.toFixed(2)} ${vehicle.type === "EV" ? "กม./kWh" : "กม./ลิตร"}` : "-"}
                  </td>
                  <td style="padding: 9px 10px; text-align: right; font-weight: 800; color: #059669; background-color: ${idx % 2 === 1 ? '#ecfdf5' : '#f0fdf4'};">
                    ${m.costPerKm ? `฿${m.costPerKm.toFixed(2)}/กม.` : "-"}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; font-weight: 600;">
        <div>หน้า 1 จาก ${totalPages}</div>
        <div>พิมพ์รายงานเมื่อ: ${printDate}</div>
        <div>Vehicle Energy Tracker - ระบบรายงานอัจฉริยะ</div>
      </div>
    `;

    pages.push(page1);

    // --- PAGE 2+: Section 1: Energy Logs (ประวัติการเติมพลังงาน) ---
    logChunks.forEach((chunk, chunkIdx) => {
      const pageNum = 2 + chunkIdx;
      const page = document.createElement("div");
      page.style.width = "800px";
      page.style.minHeight = "1130px";
      page.style.padding = "35px";
      page.style.backgroundColor = "#ffffff";
      page.style.boxSizing = "border-box";
      page.style.fontFamily = "system-ui, -apple-system, sans-serif, 'Helvetica Neue'";
      page.style.color = "#0f172a";
      page.style.display = "flex";
      page.style.flexDirection = "column";
      page.style.justifyContent = "space-between";

      page.innerHTML = `
        <div>
          <!-- Section Title -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px;">
            <div>
              <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">
                ⚡ ส่วนที่ 1: ประวัติการเติมพลังงานและชาร์จไฟ (Energy & Refuel Records)
              </h2>
              <p style="font-size: 11px; color: #64748b; margin: 3px 0 0 0;">
                ${logChunks.length > 1 ? `รายการที่ ${chunkIdx * logChunkSize + 1} - ${Math.min((chunkIdx + 1) * logChunkSize, logs.length)} จากทั้งหมด ${logs.length} รายการ` : `รายการสะสมทั้งหมด ${logs.length} รายการ`}
              </p>
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #2563eb; background-color: #eff6ff; padding: 6px 12px; border-radius: 8px;">
              ยอดค่าใช้จ่ายพลังงานรวม: ฿${totalCost.toLocaleString()}
            </div>
          </div>

          ${chunk.length === 0 ? `
            <div style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 25px; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center;">ไม่มีข้อมูลประวัติการเติมพลังงานในระบบ</div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">วันที่</th>
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">สถานที่ / สถานี</th>
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">ประเภทบริการ</th>
                  <th style="padding: 9px; text-align: right; font-weight: bold; color: #475569;">จำนวนที่ป้อน</th>
                  <th style="padding: 9px; text-align: right; font-weight: bold; color: #475569;">ยอดเงินสุทธิ</th>
                  <th style="padding: 9px; text-align: right; font-weight: bold; color: #475569;">เลขไมล์สะสม</th>
                </tr>
              </thead>
              <tbody>
                ${chunk.map((log, idx) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                    <td style="padding: 8px 9px; color: #334155; font-family: monospace;">${log.date}</td>
                    <td style="padding: 8px 9px; color: #0f172a; font-weight: bold;">${log.stationName}</td>
                    <td style="padding: 8px 9px; color: #475569;">${log.type === "EV" ? `EV ชาร์จไฟ (${log.chargerType})` : `น้ำมัน (${log.fuelType})`}</td>
                    <td style="padding: 8px 9px; text-align: right; color: #0f172a; font-weight: bold;">${log.type === "EV" ? `${log.energyKwh} kWh` : `${log.volumeLiters} ลิตร`}</td>
                    <td style="padding: 8px 9px; text-align: right; color: #16a34a; font-weight: bold;">฿${log.totalAmount.toLocaleString()}</td>
                    <td style="padding: 8px 9px; text-align: right; color: #475569;">${log.odometerReading ? `${log.odometerReading.toLocaleString()} km` : "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; font-weight: 600;">
          <div>หน้า ${pageNum} จาก ${totalPages}</div>
          <div>พิมพ์รายงานเมื่อ: ${printDate}</div>
          <div>Vehicle Energy Tracker - ประวัติพลังงาน</div>
        </div>
      `;

      pages.push(page);
    });

    // --- PAGE 3+: Section 2: Trip Travel Logs (ประวัติการเดินทางและการขับขี่) ---
    const startTripPageNum = 1 + logChunks.length + 1;
    tripChunks.forEach((chunk, chunkIdx) => {
      const pageNum = startTripPageNum + chunkIdx;
      const page = document.createElement("div");
      page.style.width = "800px";
      page.style.minHeight = "1130px";
      page.style.padding = "35px";
      page.style.backgroundColor = "#ffffff";
      page.style.boxSizing = "border-box";
      page.style.fontFamily = "system-ui, -apple-system, sans-serif, 'Helvetica Neue'";
      page.style.color = "#0f172a";
      page.style.display = "flex";
      page.style.flexDirection = "column";
      page.style.justifyContent = "space-between";

      page.innerHTML = `
        <div>
          <!-- Section Title -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px;">
            <div>
              <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">
                🚗 ส่วนที่ 2: ประวัติการเดินทางและการขับขี่ (Trip & Driving Records)
              </h2>
              <p style="font-size: 11px; color: #64748b; margin: 3px 0 0 0;">
                ${tripChunks.length > 1 ? `รายการที่ ${chunkIdx * tripChunkSize + 1} - ${Math.min((chunkIdx + 1) * tripChunkSize, tripLogs.length)} จากทั้งหมด ${tripLogs.length} รายการ` : `รายการสะสมทั้งหมด ${tripLogs.length} รายการ`}
              </p>
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #047857; background-color: #ecfdf5; padding: 6px 12px; border-radius: 8px;">
              ระยะทางขับขี่สะสมรวม: ${totalDistance.toLocaleString()} กม.
            </div>
          </div>

          ${chunk.length === 0 ? `
            <div style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 25px; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center;">ไม่มีข้อมูลประวัติการขับขี่ในระบบ</div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">วันที่</th>
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">ชื่อทริปการเดินทาง</th>
                  <th style="padding: 9px; text-align: center; font-weight: bold; color: #475569;">ประเภท</th>
                  <th style="padding: 9px; text-align: right; font-weight: bold; color: #475569;">ระยะทาง</th>
                  <th style="padding: 9px; text-align: center; font-weight: bold; color: #475569;">ระดับแบตเตอรี่ (เริ่ม-จบ)</th>
                  <th style="padding: 9px; text-align: right; font-weight: bold; color: #475569;">เลขไมล์สิ้นสุด</th>
                </tr>
              </thead>
              <tbody>
                ${chunk.map((trip, idx) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                    <td style="padding: 8px 9px; color: #334155; font-family: monospace;">${trip.date}</td>
                    <td style="padding: 8px 9px; color: #0f172a; font-weight: bold;">
                      ${trip.title}
                      ${trip.drivingMode ? `<span style="font-size: 9px; padding: 1px 4px; border-radius: 4px; background-color: #f1f5f9; color: #475569; margin-left: 4px;">${trip.drivingMode}</span>` : ""}
                      ${trip.notes ? `<div style="font-weight: normal; color: #64748b; font-size: 10px; margin-top: 2px;">บันทึก: ${trip.notes}</div>` : ""}
                    </td>
                    <td style="padding: 8px 9px; text-align: center; color: #475569;">Trip ${trip.tripType}</td>
                    <td style="padding: 8px 9px; text-align: right; color: #0f172a; font-weight: bold;">${trip.distanceKm.toLocaleString()} km</td>
                    <td style="padding: 8px 9px; text-align: center; color: #475569;">${trip.startBatteryPct !== undefined ? `${trip.startBatteryPct}% → ${trip.endBatteryPct}%` : "-"}</td>
                    <td style="padding: 8px 9px; text-align: right; color: #475569;">${trip.odometerReading ? `${trip.odometerReading.toLocaleString()} km` : "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; font-weight: 600;">
          <div>หน้า ${pageNum} จาก ${totalPages}</div>
          <div>พิมพ์รายงานเมื่อ: ${printDate}</div>
          <div>Vehicle Energy Tracker - ประวัติการเดินทาง</div>
        </div>
      `;

      pages.push(page);
    });

    // Append all page containers to tempContainer
    pages.forEach(p => tempContainer.appendChild(p));
    document.body.appendChild(tempContainer);

    try {
      const pdf = new jsPDF("p", "mm", "a4");

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");
      }

      const dateStr = new Date().toISOString().split("T")[0];
      pdf.save(`vehicle_energy_backup_report_${dateStr}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF backup:", err);
      alert("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF สำรองข้อมูล กรุณาลองใหม่อีกครั้ง");
    } finally {
      if (tempContainer && tempContainer.parentNode) {
        tempContainer.parentNode.removeChild(tempContainer);
      }
      setIsExportingPDF(false);
    }
  };

  const parseCsvRows = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let entry = "";
    
    const cleanText = text.replace(/^\uFEFF/, "");
    
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          entry += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(entry.trim());
        entry = "";
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(entry.trim());
        if (row.length > 0 && (row.length > 1 || row[0] !== "")) {
          result.push(row);
        }
        row = [];
        entry = "";
      } else {
        entry += char;
      }
    }
    if (entry || row.length > 0) {
      row.push(entry.trim());
      result.push(row);
    }
    return result;
  };

  const parseEnergyCsv = (rows: string[][]): any[] => {
    const logsList: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.length < 5) continue;
      const isEv = r[1]?.includes("EV") || r[1]?.includes("ไฟฟ้า");
      const amt = parseFloat((r[6] || "").replace(/[^0-9.]/g, "")) || 0;
      const odo = parseFloat((r[7] || "").replace(/[^0-9.]/g, "")) || undefined;
      const dist = parseFloat((r[8] || "").replace(/[^0-9.]/g, "")) || undefined;
      const trA = parseFloat((r[9] || "").replace(/[^0-9.]/g, "")) || undefined;
      const trB = parseFloat((r[10] || "").replace(/[^0-9.]/g, "")) || undefined;
      
      const log: any = {
        id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5) + "_" + i,
        date: r[0] || new Date().toISOString().split("T")[0],
        type: isEv ? "EV" : "ICE",
        stationName: r[2] || "",
        totalAmount: amt,
        odometerReading: odo,
        distanceKm: dist,
        tripA: trA,
        tripB: trB,
      };
      
      if (isEv) {
        log.chargerType = r[3] || "AC";
        log.energyKwh = parseFloat((r[4] || "").replace(/[^0-9.]/g, "")) || 0;
        const startB = parseFloat((r[11] || "").replace(/[^0-9.]/g, ""));
        const endB = parseFloat((r[12] || "").replace(/[^0-9.]/g, ""));
        log.startBatteryPct = !isNaN(startB) ? startB : undefined;
        log.endBatteryPct = !isNaN(endB) ? endB : undefined;
      } else {
        log.fuelType = r[3] || "95";
        log.volumeLiters = parseFloat((r[4] || "").replace(/[^0-9.]/g, "")) || 0;
        log.pricePerLiter = parseFloat((r[5] || "").replace(/[^0-9.]/g, "")) || 0;
      }
      logsList.push(log);
    }
    return logsList;
  };

  const parseTripCsv = (rows: string[][]): any[] => {
    const tripsList: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.length < 4) continue;
      const dist = parseFloat((r[3] || "").replace(/[^0-9.]/g, "")) || 0;
      const startOdo = parseFloat((r[4] || "").replace(/[^0-9.]/g, "")) || undefined;
      const endOdo = parseFloat((r[5] || "").replace(/[^0-9.]/g, "")) || undefined;
      const startB = parseFloat((r[7] || "").replace(/[^0-9.]/g, ""));
      const endB = parseFloat((r[8] || "").replace(/[^0-9.]/g, ""));
      
      tripsList.push({
        id: "trip_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5) + "_" + i,
        date: r[0] || new Date().toISOString().split("T")[0],
        title: r[1] || "การเดินทาง",
        tripType: (r[2] === "A" || r[2] === "B" || r[2] === "Odometer") ? r[2] : "A",
        distanceKm: dist,
        startOdometerReading: startOdo,
        odometerReading: endOdo,
        drivingMode: r[6] || undefined,
        startBatteryPct: !isNaN(startB) ? startB : undefined,
        endBatteryPct: !isNaN(endB) ? endB : undefined,
        notes: r[10] || "",
      });
    }
    return tripsList;
  };

  const parseCsvToBackup = (text: string) => {
    try {
      const rows = parseCsvRows(text);
      if (rows.length < 2) return null;
      
      const firstRowStr = JSON.stringify(rows[0]);
      
      // Check if it's Energy Logs CSV
      if (firstRowStr.includes("ปริมาณ") || firstRowStr.includes("สถานี") || firstRowStr.includes("เชื้อเพลิง") || firstRowStr.includes("เครื่องชาร์จ") || firstRowStr.includes("ชนิด")) {
        const parsedLogs = parseEnergyCsv(rows);
        if (parsedLogs && parsedLogs.length > 0) {
          return { energy_logs: parsedLogs };
        }
      }
      
      // Check if it's Trip Logs CSV
      if (firstRowStr.includes("การเดินทาง") || firstRowStr.includes("ระยะทาง") || firstRowStr.includes("Trip")) {
        const parsedTrips = parseTripCsv(rows);
        if (parsedTrips && parsedTrips.length > 0) {
          return { trip_logs: parsedTrips };
        }
      }
      
      return null;
    } catch (err) {
      console.error("CSV parsing failed", err);
      return null;
    }
  };

  const processBackupFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let json: any = null;
        
        try {
          json = JSON.parse(text);
        } catch (jsonErr) {
          console.log("File is not direct JSON. Trying CSV/CSB parser...", jsonErr);
          const csvResult = parseCsvToBackup(text);
          if (csvResult) {
            json = csvResult;
          } else {
            throw new Error("ไฟล์ไม่ใช่ไฟล์ JSON และไม่สามารถแปลงเป็น CSV หรือ CSB ที่ถูกต้องได้");
          }
        }
        
        if (!json || typeof json !== "object") {
          alert("รูปแบบไฟล์ไม่ถูกต้อง");
          return;
        }
        
        let finalLogs: any[] | null = null;
        let finalTrips: any[] | null = null;
        let finalVehicle: any | null = null;

        if (Array.isArray(json)) {
          // Direct JSON array fallback
          if (json.length === 0) {
            alert("ไฟล์สำรองเป็นอาร์เรย์ที่ไม่มีข้อมูล");
            return;
          }
          const firstItem = json[0];
          if (firstItem && typeof firstItem === "object") {
            if ("energyKwh" in firstItem || "fuelLiters" in firstItem || firstItem.type === "EV" || firstItem.type === "ICE" || "stationName" in firstItem) {
              finalLogs = json;
            } else if ("origin" in firstItem || "destination" in firstItem || "purpose" in firstItem || "tripPurpose" in firstItem || "distanceKm" in firstItem) {
              finalTrips = json;
            } else {
              finalLogs = json;
            }
          } else {
            alert("รูปแบบข้อมูลภายในอาร์เรย์ไม่ถูกต้อง");
            return;
          }
        } else {
          // Standard backup object
          finalLogs = json.energy_logs || json.logs || json.energyLogs || null;
          finalTrips = json.trip_logs || json.trips || json.tripLogs || null;
          finalVehicle = json.vehicle_profile || json.vehicle || json.vehicleProfile || null;
        }

        const hasLogs = Array.isArray(finalLogs);
        const hasTrips = Array.isArray(finalTrips);
        const hasVehicle = finalVehicle && typeof finalVehicle === "object";

        if (!hasLogs && !hasTrips && !hasVehicle) {
          alert("ไม่พบข้อมูลสำรองหรือข้อมูลรถยนต์ที่ถูกต้องในไฟล์นี้ (ระบบรองรับ .json, .csb, .csv, .txt)");
          return;
        }

        setConfirmModal({
          isOpen: true,
          title: "ยืนยันการนำเข้าและกู้คืนข้อมูล",
          message: hasVehicle
            ? "ข้อมูลรถยนต์ ประวัติพลังงาน และบันทึกการเดินทางทั้งหมดในปัจจุบัน จะถูกแทนที่ด้วยข้อมูลจากไฟล์นี้ คุณต้องการดำเนินการต่อหรือไม่?"
            : `ตรวจพบข้อมูลใหม่ (${hasLogs ? `${finalLogs.length} ประวัติเติมพลังงาน` : ""}${hasLogs && hasTrips ? " และ " : ""}${hasTrips ? `${finalTrips.length} ประวัติเดินทาง` : ""}) คุณต้องการนำเข้าข้อมูลเหล่านี้มาเขียนทับในปัจจุบันหรือไม่?`,
          confirmText: "นำเข้าและกู้คืนข้อมูล",
          cancelText: "ยกเลิก",
          isDestructive: true,
          onConfirm: () => {
            if (hasVehicle) {
              setVehicle(finalVehicle);
              localStorage.setItem("vehicle_profile", JSON.stringify(finalVehicle));
              setTempModel(finalVehicle.model);
              setTempType(finalVehicle.type);
              setTempCapacity(finalVehicle.fuelCapacity || finalVehicle.batteryCapacity || 50);
            }
            if (hasLogs) {
              setLogs(finalLogs);
              localStorage.setItem("energy_logs", JSON.stringify(finalLogs));
            }
            if (hasTrips) {
              setTripLogs(finalTrips);
              localStorage.setItem("trip_logs", JSON.stringify(finalTrips));
            }
            
            setConfirmModal(null);
            alert("กู้คืนข้อมูลสำรองสำเร็จแล้ว!");
          }
        });
      } catch (err: any) {
        console.error("Import failed", err);
        alert(err?.message || "ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็นไฟล์ข้อมูลที่ถูกต้อง (รองรับ .json, .csb, .csv, .txt)");
      }
    };
    reader.readAsText(file);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processBackupFile(file);
    // Reset file input value so same file can be selected again
    event.target.value = "";
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processBackupFile(file);
  };

  // Helper to recalculate distances based on odometer readings chronologically
  const recalculateDistances = (currentLogs: EnergyLog[]): EnergyLog[] => {
    // Sort oldest to newest
    const sorted = [...currentLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (current.odometerReading) {
        let prevOdo: number | undefined = undefined;
        // Find the most recent odometer reading before current
        for (let j = i - 1; j >= 0; j--) {
          if (sorted[j].odometerReading !== undefined && sorted[j].odometerReading! < current.odometerReading!) {
            prevOdo = sorted[j].odometerReading;
            break;
          }
        }
        if (prevOdo !== undefined) {
          current.distanceKm = current.odometerReading - prevOdo;
        } else {
          current.distanceKm = undefined;
        }
      } else {
        current.distanceKm = undefined;
      }
    }
    
    // Sort newest first for table display
    return sorted.reverse();
  };

  const handleAddLog = (newLog: Omit<EnergyLog, "id">) => {
    const logWithId: EnergyLog = {
      ...newLog,
      id: Math.random().toString(36).substring(7),
      createdAt: new Date().toISOString(),
    } as any;

    const updatedLogs = recalculateDistances([logWithId, ...logs]);
    setLogs(updatedLogs);
    localStorage.setItem("energy_logs", JSON.stringify(updatedLogs));
  };

  const handleDeleteLog = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "ยืนยันการลบประวัติพลังงาน",
      message: "คุณต้องการลบข้อมูลประวัติการเติมพลังงานนี้จริงหรือไม่? สถิติต่างๆ และระยะวิ่งสะสมจะถูกคำนวณใหม่โดยอัตโนมัติ",
      confirmText: "ยืนยันการลบ",
      cancelText: "ยกเลิก",
      isDestructive: true,
      onConfirm: () => {
        const filtered = logs.filter((l) => l.id !== id);
        const updated = recalculateDistances(filtered);
        setLogs(updated);
        localStorage.setItem("energy_logs", JSON.stringify(updated));
        setConfirmModal(null);
      }
    });
  };

  const handleStartEdit = (log: EnergyLog) => {
    setEditingLog(log);
    setEditDate(log.date);
    setEditStationName(log.stationName);
    setEditTotalAmount(log.totalAmount.toString());
    setEditOdometerReading(log.odometerReading?.toString() || "");

    if (log.type === "ICE") {
      setEditFuelType((log as any).fuelType || "Gasohol 95");
      setEditVolumeLiters((log as any).volumeLiters?.toString() || "");
      setEditPricePerLiter((log as any).pricePerLiter?.toString() || "");
    } else {
      setEditChargerType((log as any).chargerType || "DC Fast Charge");
      setEditEnergyKwh((log as any).energyKwh?.toString() || "");
      setEditStartBatteryPct((log as any).startBatteryPct?.toString() || "");
      setEditEndBatteryPct((log as any).endBatteryPct?.toString() || "");
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    const baseLog = {
      date: editDate,
      stationName: editStationName,
      totalAmount: Number(editTotalAmount) || 0,
      odometerReading: editOdometerReading ? Number(editOdometerReading) : undefined,
    };

    let updatedLog: EnergyLog;
    if (editingLog.type === "ICE") {
      updatedLog = {
        ...editingLog,
        ...baseLog,
        type: "ICE",
        fuelType: editFuelType,
        volumeLiters: Number(editVolumeLiters) || 0,
        pricePerLiter: Number(editPricePerLiter) || 0,
      } as EnergyLog;
    } else {
      updatedLog = {
        ...editingLog,
        ...baseLog,
        type: "EV",
        chargerType: editChargerType,
        energyKwh: Number(editEnergyKwh) || 0,
        startBatteryPct: editStartBatteryPct ? Number(editStartBatteryPct) : undefined,
        endBatteryPct: editEndBatteryPct ? Number(editEndBatteryPct) : undefined,
      } as EnergyLog;
    }

    const nextLogs = logs.map((l) => (l.id === editingLog.id ? updatedLog : l));
    const finalLogs = recalculateDistances(nextLogs);
    
    setLogs(finalLogs);
    localStorage.setItem("energy_logs", JSON.stringify(finalLogs));
    setEditingLog(null);
  };

  // Automatically suggest the 'start odometer reading' for a new trip log based on the 'end odometer reading' of the most recently added trip log
  const getSuggestedStartOdometer = (): number | null => {
    const lastTripWithOdometer = tripLogs.find((t) => t.odometerReading !== undefined);
    return lastTripWithOdometer && lastTripWithOdometer.odometerReading !== undefined
      ? lastTripWithOdometer.odometerReading
      : null;
  };

  // Find the most recent end battery percentage from either previous energy logs (ChargeLog) or travel logs (TripLog)
  const getSuggestedStartBatteryPct = (): number | null => {
    // 1. Get all EV charge logs with endBatteryPct, sorted newest by date first, then by createdAt, then by odometer
    const evLogs = [...logs]
      .filter((l) => l.type === "EV" && (l as ChargeLog).endBatteryPct !== undefined)
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateB - dateA;
        
        // If dates are identical, use createdAt as a tie-breaker
        const createA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const createB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        if (createA !== createB) return createB - createA;
        
        // Fallback to odometer
        const odoA = a.odometerReading || 0;
        const odoB = b.odometerReading || 0;
        return odoB - odoA;
      }) as ChargeLog[];

    // 2. Get all trips with endBatteryPct, sorted newest by date first, then by createdAt, then by odometer
    const evTrips = [...tripLogs]
      .filter((t) => t.endBatteryPct !== undefined)
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateB - dateA;
        
        // If dates are identical, use createdAt as a tie-breaker
        const createA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const createB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        if (createA !== createB) return createB - createA;
        
        // Fallback to odometer
        const odoA = a.odometerReading || 0;
        const odoB = b.odometerReading || 0;
        return odoB - odoA;
      });

    const lastEnergy = evLogs[0];
    const lastTrip = evTrips[0];

    if (lastEnergy && lastTrip) {
      const energyTime = new Date(lastEnergy.date).getTime();
      const tripTime = new Date(lastTrip.date).getTime();
      
      if (energyTime > tripTime) {
        return lastEnergy.endBatteryPct!;
      } else if (tripTime > energyTime) {
        return lastTrip.endBatteryPct!;
      } else {
        // Equal dates! Let's do fine-grained tie-breaking
        // Tie-breaker 1: createdAt
        const energyCreate = (lastEnergy as any).createdAt ? new Date((lastEnergy as any).createdAt).getTime() : 0;
        const tripCreate = (lastTrip as any).createdAt ? new Date((lastTrip as any).createdAt).getTime() : 0;
        if (energyCreate !== tripCreate) {
          return energyCreate > tripCreate ? lastEnergy.endBatteryPct! : lastTrip.endBatteryPct!;
        }
        
        // Tie-breaker 2: odometerReading
        const energyOdo = lastEnergy.odometerReading || 0;
        const tripOdo = lastTrip.odometerReading || 0;
        if (energyOdo !== tripOdo) {
          return energyOdo > tripOdo ? lastEnergy.endBatteryPct! : lastTrip.endBatteryPct!;
        }
        
        // Tie-breaker 3: If trip.startBatteryPct === lastEnergy.endBatteryPct, trip happened after charge
        if (lastTrip.startBatteryPct === lastEnergy.endBatteryPct) {
          return lastTrip.endBatteryPct!;
        }
        
        // Tie-breaker 4: Default to the one that has a lower battery percentage (usually trip after charge)
        return lastTrip.endBatteryPct! < lastEnergy.endBatteryPct! ? lastTrip.endBatteryPct! : lastEnergy.endBatteryPct!;
      }
    }

    if (lastEnergy) return lastEnergy.endBatteryPct!;
    if (lastTrip) return lastTrip.endBatteryPct!;
    return null;
  };

  // Prefill starting odometer from previous trip log
  useEffect(() => {
    const suggestedOdo = getSuggestedStartOdometer();
    if (suggestedOdo !== null) {
      setTripStartOdometer(suggestedOdo.toString());
    } else {
      setTripStartOdometer("");
    }
  }, [tripLogs]);

  // Prefill starting battery percentage from previous charge log or trip log
  useEffect(() => {
    const suggestedBattery = getSuggestedStartBatteryPct();
    if (suggestedBattery !== null) {
      setTripStartBatteryPct(suggestedBattery.toString());
    } else {
      setTripStartBatteryPct("");
    }
  }, [logs, tripLogs]);

  // Trip Functions
  const handleAddTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripTitle) {
      alert("กรุณากรอกหัวข้อเดินทาง");
      return;
    }

    let finalDistance = 0;
    let endOdo: number | undefined = undefined;
    let startOdo: number | undefined = undefined;

    if (tripInputMode === "distance") {
      if (!tripDistanceKm) {
        alert("กรุณากรอกระยะทางเดินทาง");
        return;
      }
      finalDistance = Number(tripDistanceKm) || 0;
    } else {
      if (!tripOdometer) {
        alert("กรุณากรอกเลขไมล์ปัจจุบัน");
        return;
      }
      const start = Number(tripStartOdometer) || 0;
      const end = Number(tripOdometer) || 0;
      if (end <= start) {
        alert("เลขไมล์ปัจจุบัน ต้องมากกว่าเลขไมล์เริ่มต้น");
        return;
      }
      finalDistance = end - start;
      endOdo = end;
      startOdo = start;
    }

    const newTrip: TripLog = {
      id: Math.random().toString(36).substring(7),
      date: tripDate,
      title: tripTitle,
      tripType: tripType,
      distanceKm: finalDistance,
      odometerReading: endOdo,
      startOdometerReading: startOdo,
      notes: tripNotes || undefined,
      startBatteryPct: tripStartBatteryPct ? Number(tripStartBatteryPct) : undefined,
      endBatteryPct: tripEndBatteryPct ? Number(tripEndBatteryPct) : undefined,
      drivingMode: tripDrivingMode,
      createdAt: new Date().toISOString(),
    } as any;

    const updatedTrips = [newTrip, ...tripLogs];
    setTripLogs(updatedTrips);
    localStorage.setItem("trip_logs", JSON.stringify(updatedTrips));
    
    // Reset Form
    setTripTitle("");
    setTripDistanceKm("");
    setTripOdometer("");
    setTripNotes("");
    setTripStartBatteryPct("");
    setTripEndBatteryPct("");
    setTripDrivingMode("Comfort");
    localStorage.removeItem("trip_log_draft");
    setHasTripDraft(false);
  };

  const handleDeleteTrip = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "ยืนยันการลบประวัติเดินทาง",
      message: "คุณต้องการลบข้อมูลประวัติทริปเดินทางนี้จริงหรือไม่? สถิติระยะทางสะสมจะถูกคำนวณใหม่โดยอัตโนมัติ",
      confirmText: "ยืนยันการลบ",
      cancelText: "ยกเลิก",
      isDestructive: true,
      onConfirm: () => {
        const updated = tripLogs.filter((t) => t.id !== id);
        setTripLogs(updated);
        localStorage.setItem("trip_logs", JSON.stringify(updated));
        setConfirmModal(null);
      }
    });
  };

  const handleStartEditTrip = (trip: TripLog) => {
    setEditingTrip(trip);
    setEditTripDate(trip.date);
    setEditTripTitle(trip.title);
    setEditTripType(trip.tripType);
    setEditTripDistanceKm(trip.distanceKm.toString());
    setEditTripNotes(trip.notes || "");
    setEditTripStartBatteryPct(trip.startBatteryPct?.toString() || "");
    setEditTripEndBatteryPct(trip.endBatteryPct?.toString() || "");
    setEditTripDrivingMode(trip.drivingMode || "Comfort");
    if (trip.odometerReading !== undefined) {
      setEditTripInputMode("odometer");
      setEditTripOdometer(trip.odometerReading.toString());
      setEditTripStartOdometer(trip.startOdometerReading?.toString() || "");
    } else {
      setEditTripInputMode("distance");
      setEditTripOdometer("");
      setEditTripStartOdometer("");
    }
  };

  const handleSaveEditTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip) return;

    let finalDistance = 0;
    let endOdo: number | undefined = undefined;
    let startOdo: number | undefined = undefined;

    if (editTripInputMode === "distance") {
      if (!editTripDistanceKm) {
        alert("กรุณากรอกระยะทางเดินทาง");
        return;
      }
      finalDistance = Number(editTripDistanceKm) || 0;
    } else {
      if (!editTripOdometer) {
        alert("กรุณากรอกเลขไมล์ปัจจุบัน");
        return;
      }
      const start = Number(editTripStartOdometer) || 0;
      const end = Number(editTripOdometer) || 0;
      if (end <= start) {
        alert("เลขไมล์ปัจจุบัน ต้องมากกว่าเลขไมล์เริ่มต้น");
        return;
      }
      finalDistance = end - start;
      endOdo = end;
      startOdo = start;
    }

    const updatedTrip: TripLog = {
      ...editingTrip,
      date: editTripDate,
      title: editTripTitle,
      tripType: editTripType,
      distanceKm: finalDistance,
      odometerReading: endOdo,
      startOdometerReading: startOdo,
      notes: editTripNotes || undefined,
      startBatteryPct: editTripStartBatteryPct ? Number(editTripStartBatteryPct) : undefined,
      endBatteryPct: editTripEndBatteryPct ? Number(editTripEndBatteryPct) : undefined,
      drivingMode: editTripDrivingMode,
    };

    const updated = tripLogs.map((t) => t.id === editingTrip.id ? updatedTrip : t);
    setTripLogs(updated);
    localStorage.setItem("trip_logs", JSON.stringify(updated));
    setEditingTrip(null);
  };

  const handleScanComplete = (extractedData: Partial<EnergyLog> & { type: VehicleType }) => {
    setScannedData(extractedData);
  };

  // 3. Mathematical & Analytics Formulations
  const totalCost = logs.reduce((sum, l) => sum + l.totalAmount, 0);
  
  const totalEnergy = logs.reduce((sum, l) => {
    if (l.type === "EV") return sum + (l as any).energyKwh;
    return sum + (l as any).volumeLiters;
  }, 0);

  // Efficiency calculation
  const logsWithDistance = logs.filter((l) => l.distanceKm && l.distanceKm > 0);
  const totalDistanceCalculated = logsWithDistance.reduce((sum, l) => sum + (l.distanceKm || 0), 0);
  const totalEnergyForDistanceCalculated = logsWithDistance.reduce((sum, l) => {
    if (l.type === "EV") return sum + (l as any).energyKwh;
    return sum + (l as any).volumeLiters;
  }, 0);

  const avgEfficiency = totalDistanceCalculated > 0 && totalEnergyForDistanceCalculated > 0
    ? (totalDistanceCalculated / totalEnergyForDistanceCalculated).toFixed(2)
    : "N/A";

  // Monitor Efficiency Alert for unusually high consumption (low km/kWh or low km/L)
  const efficiencyAlert = useMemo(() => {
    return monitorEnergyEfficiency(logs, vehicle.type);
  }, [logs, vehicle.type]);

  // Carbon Emissions Calculation
  // Gasoline emits approx 2.3 kg CO2 per liter.
  // EV emissions in Thailand grid average approx 0.45 kg CO2 per kWh.
  // Eco savings compares the active consumption with a standard gasoline car (standard avg 2.3kg CO2 / liter)
  const co2GeneratedKg = logs.reduce((sum, l) => {
    if (l.type === "EV") {
      return sum + (l as any).energyKwh * 0.45;
    } else {
      return sum + (l as any).volumeLiters * 2.3;
    }
  }, 0);

  // Carbon saved calculation: compared to driving a standard non-hybrid gasoline car (approx 0.18 kg CO2 / km)
  // Let's compute estimated carbon saved
  const estimatedKmDriven = totalDistanceCalculated > 0 ? totalDistanceCalculated : logs.length * 150;
  const standardIceEmission = estimatedKmDriven * 0.18; // 180g CO2 per km for non-hybrid SUV/sedan
  const carbonSavedKg = Math.max(0, standardIceEmission - co2GeneratedKg);

  // Travel calculations
  const totalTripA = tripLogs.filter((t) => t.tripType === "A").reduce((sum, t) => sum + t.distanceKm, 0);
  const totalTripB = tripLogs.filter((t) => t.tripType === "B").reduce((sum, t) => sum + t.distanceKm, 0);
  const totalTravelDistance = tripLogs.reduce((sum, t) => sum + t.distanceKm, 0);
  const totalTripsCount = tripLogs.length;

  const filteredTripLogs = tripLogs.filter((trip) => {
    if (tripFilter === "All") return true;
    return trip.tripType === tripFilter;
  });

  // Helper to restore all data safely from backup (local or Google Drive)
  const handleRestoreBackupData = (backupData: any) => {
    let finalLogs: any[] | null = null;
    let finalTrips: any[] | null = null;
    let finalVehicle: any | null = null;

    if (Array.isArray(backupData)) {
      if (backupData.length > 0) {
        const first = backupData[0];
        if ("energyKwh" in first || "volumeLiters" in first || first.type === "EV" || first.type === "ICE") {
          finalLogs = backupData;
        } else if ("distanceKm" in first || "tripType" in first) {
          finalTrips = backupData;
        }
      }
    } else if (backupData && typeof backupData === "object") {
      finalLogs = backupData.energy_logs || backupData.logs || backupData.energyLogs || null;
      finalTrips = backupData.trip_logs || backupData.trips || backupData.tripLogs || null;
      finalVehicle = backupData.vehicle_profile || backupData.vehicle || backupData.vehicleProfile || null;
    }

    if (finalVehicle && typeof finalVehicle === "object") {
      setVehicle(finalVehicle);
      localStorage.setItem("vehicle_profile", JSON.stringify(finalVehicle));
      setTempModel(finalVehicle.model);
      setTempType(finalVehicle.type);
      setTempCapacity(finalVehicle.fuelCapacity || finalVehicle.batteryCapacity || 50);
    }
    if (Array.isArray(finalLogs)) {
      setLogs(finalLogs);
      localStorage.setItem("energy_logs", JSON.stringify(finalLogs));
    }
    if (Array.isArray(finalTrips)) {
      setTripLogs(finalTrips);
      localStorage.setItem("trip_logs", JSON.stringify(finalTrips));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans antialiased pb-12">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-slate-200/80 py-4 px-6 sticky top-0 z-20 shadow-xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-sm flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base leading-tight tracking-tight">Vehicle Energy Tracker</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">สถิติพลังงานและ AI อัจฉริยะ</p>
            </div>
          </div>

          {/* Active Vehicle Info Tag */}
          <div className="flex items-center gap-2">
            <OnlineStatusBadge />
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-slate-700">{vehicle.model}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {vehicle.type === "EV" ? "🔋 รถยนต์ไฟฟ้า (EV)" : "⛽ รถน้ำมัน / ไฮบริด"}
              </span>
            </div>
            <PWAInstallButton onOpenGuide={() => setIsAndroidInstallModalOpen(true)} />
            <button
              onClick={() => setIsDriveModalOpen(true)}
              className="px-3 py-2 bg-gradient-to-r from-sky-50 to-indigo-50 hover:from-sky-100 hover:to-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-2xs"
              title="สำรองและกู้คืนข้อมูลบน Google Drive"
            >
              <Cloud className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Google Drive</span>
            </button>
            <button
              onClick={() => setIsTouModalOpen(true)}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-2xs"
              title="ตั้งค่าสถานีชาร์จ TOU (Auto-Detect)"
            >
              <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span className="hidden sm:inline">ตั้งค่าตู้ชาร์จ TOU</span>
            </button>
            <button
              onClick={() => {
                setTempModel(vehicle.model);
                setTempType(vehicle.type);
                setTempCapacity(vehicle.type === "ICE" ? vehicle.fuelCapacity || 36 : vehicle.batteryCapacity || 60);
                setShowConfig(!showConfig);
              }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
              title="ตั้งค่าข้อมูลรถยนต์"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Tab Switcher Bar */}
      <div className="bg-white border-b border-slate-200/60 sticky top-[73px] z-10 px-2 sm:px-6 py-2 shadow-xs flex justify-center">
        <div className="max-w-7xl w-full grid grid-cols-4 gap-1.5 sm:gap-3">
          <button
            onClick={() => setActiveTab("energy")}
            className={`py-2 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${
              activeTab === "energy"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">ระบบพลังงาน</span>
          </button>
          <button
            onClick={() => setActiveTab("travel")}
            className={`py-2 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${
              activeTab === "travel"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">เมนูเดินทาง</span>
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`py-2 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${
              activeTab === "ai"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-amber-500 fill-amber-500 animate-pulse" />
            <span className="truncate">แนะนำ AI</span>
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`py-2 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${
              activeTab === "reports"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">รายงานสรุป</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Android PWA Installation & Offline Status Quick Access Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 sm:p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl shrink-0 shadow-xs">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-extrabold text-sm sm:text-base text-white tracking-wide">
                  📱 ติดตั้งแอป Vehicle Energy Tracker บนโทรศัพท์ Android
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black rounded-full uppercase tracking-wider">
                  PWA พร้อมติดตั้ง
                </span>
                <OnlineStatusBadge className="bg-white/10 text-white border-white/20" />
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                เปิดแอปแบบเต็มหน้าจอ ไม่เปลืองความจุเครื่อง พร้อมระบบตรวจจับสถานะออฟไลน์ (Offline Mode) และซิงค์ Google Drive ได้ตลอดเวลา
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsAndroidInstallModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <QrCode className="w-4 h-4" />
              <span>ดูวิธีติดตั้ง / สแกน QR Code</span>
            </button>
          </div>
        </div>

        {/* Settings Configuration Panel (Drawer or Accordion) */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                {/* Tab selectors for Config */}
                <div className="flex border-b border-slate-100 pb-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setSettingsTab("profile")}
                    className={`font-bold text-sm pb-1 px-1 transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
                      settingsTab === "profile"
                        ? "border-indigo-600 text-indigo-950"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Car className="w-4 h-4" /> โปรไฟล์รถยนต์
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsTab("backup")}
                    className={`font-bold text-sm pb-1 px-1 transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
                      settingsTab === "backup"
                        ? "border-indigo-600 text-indigo-950"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Download className="w-4 h-4" /> สำรองและนำเข้าข้อมูล
                  </button>
                </div>

                {settingsTab === "profile" ? (
                  <form onSubmit={saveVehicleSettings} className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ชื่อรุ่นรถยนต์</label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น BYD Atto 3, Honda Civic"
                          value={tempModel}
                          onChange={(e) => setTempModel(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ระบบขับเคลื่อน</label>
                        <select
                          value={tempType}
                          onChange={(e) => setTempType(e.target.value as VehicleType)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
                        >
                          <option value="ICE">รถน้ำมันเชื้อเพลิง (ICE) / ไฮบริด</option>
                          <option value="EV">รถไฟฟ้า 100% (EV) / PHEV</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                          {tempType === "ICE" ? "ความจุถังน้ำมัน (ลิตร)" : "ความจุแบตเตอรี่ (kWh)"}
                        </label>
                        <input
                          type="number"
                          value={tempCapacity}
                          onChange={(e) => setTempCapacity(Number(e.target.value))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    {tempType === "EV" && (
                      <div className="p-3 bg-emerald-50/60 border border-emerald-150 rounded-2xl space-y-2">
                        <label className="block text-emerald-900 font-bold text-xs uppercase tracking-wider">
                          ⚡ ประเภทเคมีแบตเตอรี่ EV (Battery Chemistry)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
                            tempBatteryType === "LFP" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}>
                            <input
                              type="radio"
                              name="batteryTypeRadio"
                              checked={tempBatteryType === "LFP"}
                              onChange={() => setTempBatteryType("LFP")}
                              className="hidden"
                            />
                            <span>LFP (Lithium Iron Phosphate)</span>
                          </label>
                          <label className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
                            tempBatteryType === "NMC" || tempBatteryType === "NCA" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}>
                            <input
                              type="radio"
                              name="batteryTypeRadio"
                              checked={tempBatteryType === "NMC" || tempBatteryType === "NCA"}
                              onChange={() => setTempBatteryType("NMC")}
                              className="hidden"
                            />
                            <span>NMC / NCA (Nickel Manganese Cobalt)</span>
                          </label>
                        </div>
                        <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                          * รถใช้แบต LFP แนะนำชาร์จไฟเต็ม 100% สัปดาห์ละ 1 ครั้งเพื่อ Re-calibrate ชิปวัดประจุ (BMS) และบาลานซ์เซลล์
                        </p>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowConfig(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                      >
                        ปิดแผงควบคุม
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        บันทึกข้อมูลรถยนต์
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6 pt-1 animate-in fade-in duration-200">
                    <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
                      ศูนย์สำรองและส่งออกข้อมูล ช่วยให้คุณบันทึกรายงานการใช้พลังงานและประวัติขับเคลื่อนในหลากหลายรูปแบบ ทั้งบนคลาวด์ Google Drive และไฟล์ออฟไลน์ (PDF, CSV, JSON) เพื่อใช้ในการเก็บข้อมูล วิเคราะห์ผ่านโปรแกรมสเปรดชีต หรือนำเข้าเพื่อกู้คืนระบบกลับมาทั้งหมดได้ทันที
                    </p>

                    {/* Google Drive Backup & Sync Card Component */}
                    <GoogleDriveBackupCard
                      currentBackupData={{
                        vehicle_profile: vehicle,
                        energy_logs: logs,
                        trip_logs: tripLogs,
                      }}
                      onRestoreBackup={handleRestoreBackupData}
                      onRequestConfirm={(cfg) => setConfirmModal(cfg)}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* PDF Report Export */}
                      <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-rose-600" /> ส่งออกเป็นรูปเล่ม PDF
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            จัดทำสรุปประวัติพลังงานและประวัติขับขี่ล่าสุดในรูปแบบเอกสาร รายงานพิมพ์สวยงาม เหมาะแก่การพิมพ์หรือจัดเก็บเป็นเอกสาร
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportBackupPDF}
                          disabled={isExportingPDF}
                          className="w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                        >
                          {isExportingPDF ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                              <span>กำลังจัดทำ PDF...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>ดาวน์โหลดรายงานรูปเล่ม (.pdf)</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* CSV Export */}
                      <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <History className="w-4 h-4 text-emerald-600" /> ส่งออกเป็นไฟล์ตาราง CSV
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            ส่งออกข้อมูลดิบในฟอร์แมต <code>.csv</code> (เปิดได้ด้วย Excel / Google Sheets) พร้อมเข้ารหัสภาษาไทยเปิดใช้งานได้ทันที
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={handleExportEnergyCSV}
                            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>ประวัติพลังงาน (.csv)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportTripCSV}
                            className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>ประวัติการเดินทาง (.csv)</span>
                          </button>
                        </div>
                      </div>

                      {/* JSON Backup Export */}
                      <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <Download className="w-4 h-4 text-indigo-600" /> สำรองระบบ (.json / .csb)
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            ดาวน์โหลดฐานข้อมูลและการตั้งค่าระบบทั้งหมด นำกลับเข้ามาใช้งานใหม่ได้สมบูรณ์ 100% (เลือก .csb หากอุปกรณ์บล็อก .json)
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportBackup("json")}
                            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>ไฟล์ระบบ (.json)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportBackup("csb")}
                            className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>ไฟล์ระบบ (.csb)</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Import Section (Full-width underneath) */}
                    <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/30 space-y-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <Upload className="w-4 h-4 text-amber-600" /> นำเข้าข้อมูลกู้คืนระบบ (Import / Restore)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          หากคุณมีไฟล์สำรองระบบนามสกุล <code>.json</code> หรือ <code>.csb</code> คุณสามารถนำเข้าเพื่อกู้คืนประวัติและข้อมูลยานพาหนะทั้งหมด หรือจะเลือกนำเข้าไฟล์ประวัติพลังงาน/ประวัติเดินทางแบบ <code>.csv</code> ที่คุณมีอยู่ก็ได้เช่นกัน
                        </p>
                      </div>
                      
                      <div className="relative">
                        {/* Hidden Native File Input: Ensures z-index/opacity issues never block browser clicks */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept=".json,.csb,.csv,.txt,application/json,text/csv,text/plain"
                          onChange={handleImportBackup}
                          className="hidden"
                        />
                        
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center gap-2 select-none cursor-pointer ${
                            isDragging
                              ? "border-amber-500 bg-amber-50/50 text-amber-700 scale-[1.01]"
                              : "border-slate-200 hover:border-indigo-400 bg-white hover:bg-slate-50/20 text-slate-500 hover:text-indigo-600"
                          }`}
                        >
                          <div className={`p-2 rounded-xl transition-all ${isDragging ? 'bg-amber-100 text-amber-600 animate-bounce' : 'bg-slate-100 text-slate-500'}`}>
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-slate-700 transition-colors">
                            {isDragging ? "วางไฟล์สำรองที่นี่ได้เลย!" : "คลิกที่นี่ หรือ ลากไฟล์ระบบ (.json, .csb, .csv) มาวางตรงนี้เพื่อนำเข้า"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            (ระบบจะตรวจจับฟอร์แมตอัตโนมัติ กู้ประวัติรถ เติมพลังงาน และการขับขี่ทั้งหมด)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile App Installation Guide Card */}
                    <div className="border border-emerald-200/90 rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-3xs">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-2xs shrink-0">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 text-sm">
                              ติดตั้งแอปพลิเคชันลงบนโทรศัพท์ Android
                            </h4>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                              PWA App
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            ใช้งานเสมือนแอปพลิเคชันจริงบนมือถือ Android เต็มหน้าจอ โหลดรวดเร็ว บันทึกประวัติและสแกนใบเสร็จได้ทันที
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAndroidInstallModalOpen(true)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 shrink-0 active:scale-98"
                      >
                        <Download className="w-4 h-4" />
                        <span>ดูวิธีลงแอป / สแกน QR</span>
                      </button>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowConfig(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                      >
                        ปิดแผงควบคุม
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === "energy" && (
          /* ==================== ENERGY DASHBOARD TAB ==================== */
          <div className="space-y-6">
            {/* Efficiency Alert Banner for Low Efficiency / High Consumption */}
            {efficiencyAlert && !isEfficiencyAlertDismissed && (
              <EfficiencyAlertBanner
                alert={efficiencyAlert}
                onDismiss={() => setIsEfficiencyAlertDismissed(true)}
              />
            )}

            {/* Restore Efficiency Alert Trigger if Dismissed */}
            {efficiencyAlert && isEfficiencyAlertDismissed && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEfficiencyAlertDismissed(false)}
                  className="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>แสดงการแจ้งเตือน Efficiency Alert อีกครั้ง</span>
                </button>
              </div>
            )}

            {/* Smart AI Charge 100% Notification Banner */}
            {vehicle.type === "EV" && (
              <div className={`border rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                aiCharge100Alert?.shouldChargeTo100
                  ? "bg-amber-50/75 border-amber-200 text-amber-900 shadow-xs animate-pulse-slow"
                  : "bg-gradient-to-r from-indigo-50/70 to-slate-50 border-indigo-100 text-indigo-950"
              }`}>
                <div className="flex gap-3.5 items-start">
                  <div className={`p-2.5 rounded-2xl shrink-0 ${
                    aiCharge100Alert?.shouldChargeTo100 ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                  }`}>
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      {aiCharge100Alert?.shouldChargeTo100 ? "⚠️ ระบบเตือนชาร์จเต็ม 100% ด้วย AI" : "🔮 ระบบวิเคราะห์รอบชาร์จเต็ม 100% ด้วย AI"}
                    </h4>
                    {aiCharge100Alert ? (
                      <p className="text-[11px] leading-relaxed font-semibold opacity-90 max-w-2xl">
                        {aiCharge100Alert.shouldChargeTo100 ? (
                          <span>แนะนำ: ถึงเวลาชาร์จไฟเต็ม 100% แล้วเพื่อความคุ้มค่าและรักษาสมดุลเซลล์! {aiCharge100Alert.explanation.slice(0, 140)}...</span>
                        ) : (
                          <span>ระดับพลังงานและสมดุลเซลล์แบตเตอรี่เสถียรสมบูรณ์ดีมาก {aiCharge100Alert.explanation.slice(0, 140)}...</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-[11px] leading-relaxed font-semibold opacity-80 max-w-2xl">
                        วิเคราะห์ประเภทเคมีแบตเตอรี่เฉพาะรุ่นรถของคุณ ({vehicle.model}) และพฤติกรรมการเดินทางเพื่อแนะนำเวลาที่เหมาะสมในการชาร์จ 100% เพื่อทำ Cell Balancing และคาลิเบรต BMS
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEnergySubTab("battery");
                    setInitialSohTab("charge100");
                  }}
                  className={`px-4 py-2 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-3xs shrink-0 flex items-center gap-1.5 ${
                    aiCharge100Alert?.shouldChargeTo100
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {aiCharge100Alert ? "ดูผลวิเคราะห์เจาะลึก" : "เริ่มประเมินด้วย AI"}
                </button>
              </div>
            )}

            {/* Overview Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* Card 1: Total Cost */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ค่าใช้จ่ายรวม</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-2xl font-black text-slate-800 leading-none">฿{totalCost.toLocaleString()}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">บาทสะสมทั้งหมด</p>
                </div>
              </div>

              {/* Card 2: Total Energy */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">พลังงานที่ใช้</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    {vehicle.type === "EV" ? <Zap className="w-4 h-4" /> : <Droplet className="w-4 h-4" />}
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-2xl font-black text-slate-800 leading-none">
                    {totalEnergy.toFixed(1)}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">
                    {vehicle.type === "EV" ? "หน่วย (kWh) ทั้งหมด" : "ลิตร ทั้งหมด"}
                  </p>
                </div>
              </div>

              {/* Card 3: Avg Efficiency */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ประสิทธิภาพเฉลี่ย</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-2xl font-black text-slate-800 leading-none">
                    {avgEfficiency}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">
                    {vehicle.type === "EV" ? "กิโลเมตรต่อ kWh" : "กิโลเมตรต่อลิตร"}
                  </p>
                </div>
              </div>

              {/* Card 4: Estimated Distance */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-between col-span-1">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ระยะวิ่งประเมิน</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Car className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-2xl font-black text-slate-800 leading-none">
                    {estimatedKmDriven.toLocaleString()}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">กิโลเมตร</p>
                </div>
              </div>

              {/* Card 5: Carbon Saved */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-between col-span-2 sm:col-span-1 lg:col-span-1">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">CO2 ที่ลดได้</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Leaf className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-2xl font-black text-indigo-600 leading-none">
                    {carbonSavedKg.toFixed(1)}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">กก. คาร์บอน (ประเมิน)</p>
                </div>
              </div>
            </div>

            {/* Dashboard Core Layout split in grids */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (Entry Form) - size 5 */}
              <div className="lg:col-span-5 space-y-6">
                {/* Entry Log Form */}
                <LogForm
                  vehicleType={vehicle.type}
                  scannedData={scannedData}
                  onSaveLog={handleAddLog}
                  onClearScan={() => setScannedData(null)}
                  logs={logs}
                  tripLogs={tripLogs}
                  onOpenTouSettings={() => setIsTouModalOpen(true)}
                />
              </div>

              {/* Right Column (Analytics charts) - size 7 */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6">
                  {/* Segmented Sub-tab controllers */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-3 mb-4">
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setEnergySubTab("general")}
                        className={`font-bold text-sm pb-1 px-1 transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
                          energySubTab === "general"
                            ? "border-indigo-600 text-indigo-950"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        <TrendingUp className="w-4 h-4 text-indigo-600" /> แผงวิเคราะห์และสถิติข้อมูลสะสม
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnergySubTab("battery")}
                        className={`font-bold text-sm pb-1 px-1 transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
                          energySubTab === "battery"
                            ? "border-indigo-600 text-indigo-950"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        <Zap className="w-4 h-4 text-indigo-500" /> 🔋 สุขภาพแบตเตอรี่ (SOH)
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCalcModalOpen(true)}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" /> เครื่องคำนวณเวลาชาร์จ (AI)
                    </button>
                  </div>

                  {energySubTab === "general" ? (
                    <div>
                      <div className="mb-4">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">กราฟสรุปพฤติกรรมและสัดส่วนประสิทธิภาพขับขี่ตามกาลเวลา</p>
                      </div>
                      <EnergyCharts logs={logs} />
                    </div>
                  ) : (
                    <BatteryHealthDashboard
                      logs={logs}
                      vehicle={vehicle}
                      setLogs={setLogs}
                      setVehicle={setVehicle}
                      initialTab={initialSohTab}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Log History list */}
            <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-base">ประวัติการบันทึกรายการพลังงาน</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {logFilter === "all" ? `รวมทั้งหมด ${logs.length} รายการ` : `แสดง ${displayLogs.length} จาก ${logs.length} รายการ`}
                  </span>
                </div>
              </div>

              {/* Quick Filter Badges */}
              {logs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-1">
                  <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-slate-400" /> ตัวกรองสถานะ:
                  </span>
                  <button
                    type="button"
                    onClick={() => setLogFilter("all")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      logFilter === "all"
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    ทั้งหมด ({logs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter("DC")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 ${
                      logFilter === "DC"
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs"
                        : "bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100"
                    }`}
                  >
                    <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> ⚡ DC Fast Charge
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter("AC")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 ${
                      logFilter === "AC"
                        ? "bg-sky-600 text-white shadow-2xs"
                        : "bg-sky-50 text-sky-700 border border-sky-200/80 hover:bg-sky-100"
                    }`}
                  >
                    <Plug className="w-3 h-3 text-sky-600" /> 🔌 AC Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter("Home")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 ${
                      logFilter === "Home"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100"
                    }`}
                  >
                    <Home className="w-3 h-3 text-emerald-600" /> 🏠 Home / TOU
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter("ICE")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 ${
                      logFilter === "ICE"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100"
                    }`}
                  >
                    <Droplet className="w-3 h-3 text-blue-500" /> ⛽ น้ำมัน (ICE)
                  </button>
                </div>
              )}

              {logs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  ไม่มีประวัติข้อมูลพลังงานในระบบ เริ่มอัปโหลดใบเสร็จหรือเพิ่มข้อมูลด้วยฟอร์มด้านบน
                </div>
              ) : displayLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  ไม่พบรายการที่ตรงกับตัวกรองที่เลือก{" "}
                  <button
                    onClick={() => setLogFilter("all")}
                    className="text-indigo-600 font-bold underline ml-1 cursor-pointer"
                  >
                    แสดงทั้งหมด
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto w-full max-w-full -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none [&::-webkit-scrollbar]:hidden">
                  <table className="w-full text-left text-xs border-collapse min-w-[760px] lg:min-w-0">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="px-4 py-3">วันที่</th>
                        <th className="px-4 py-3">ปั๊ม / สถานีชาร์จ (Brand & Branch)</th>
                        <th className="px-4 py-3">ประเภทพลังงาน</th>
                        <th className="px-4 py-3 text-right">ปริมาณพลังงาน</th>
                        <th className="px-4 py-3 text-right">ยอดชำระเงิน</th>
                        <th className="px-4 py-3 text-right">เลขไมล์ (กม.)</th>
                        <th className="px-4 py-3 text-right">ระยะวิ่ง (กม.)</th>
                        <th className="px-4 py-3 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap align-top">
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono">{log.date}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <StationBadgeCell
                              stationName={log.stationName}
                              stationBranch={log.stationBranch}
                              logType={log.type}
                            />
                          </td>
                          <td className="px-4 py-3 align-top whitespace-nowrap">
                            <EnergyTypeBadgeCell log={log} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-slate-700 align-top">
                            <div className="font-bold text-slate-800">
                              {log.type === "ICE"
                                ? `${(log as any).volumeLiters?.toFixed(1) || 0} ลิตร`
                                : `${(log as any).energyKwh?.toFixed(1) || 0} kWh`}
                            </div>
                            {log.type === "EV" && (log as any).startBatteryPct !== undefined && (
                              <div className="text-[10px] text-indigo-600 font-bold font-sans mt-0.5 bg-indigo-50/70 px-1.5 py-0.5 rounded-md inline-block">
                                🔋 {(log as any).startBatteryPct}% → {(log as any).endBatteryPct}%
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono align-top">
                            <div className="font-bold text-slate-900 text-sm">
                              ฿{log.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {log.type === "ICE" && (log as any).pricePerLiter && (
                              <div className="text-[10px] text-slate-400 font-sans">
                                @฿{(log as any).pricePerLiter.toFixed(2)}/ลิตร
                              </div>
                            )}
                            {log.type === "EV" && (log as any).pricePerKwh && (
                              <div className="text-[10px] text-slate-400 font-sans">
                                @฿{(log as any).pricePerKwh.toFixed(2)}/kWh
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600 align-top">
                            {log.odometerReading ? (
                              <span className="font-semibold text-slate-800">
                                {log.odometerReading.toLocaleString()}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 align-top">
                            {log.distanceKm ? `+${log.distanceKm.toLocaleString()}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap align-top">
                            <div className="flex items-center justify-center gap-1.5 mt-0.5">
                              <button
                                onClick={() => handleStartEdit(log)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="แก้ไขรายการ"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                title="ลบรายการ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "travel" && (
          /* ==================== TRAVEL/TRIP MENU TAB ==================== */
          <div className="space-y-6">
            {/* Travel Stats Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Trip A Accumulation */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ทริปสะสม Trip A</span>
                  <div className="p-2 bg-cyan-50 text-cyan-600 rounded-xl">
                    <Compass className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-2xl font-black text-slate-800 leading-none">
                    {totalTripA.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">กิโลเมตรสะสม</p>
                </div>
              </div>

              {/* Trip B Accumulation */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ทริปสะสม Trip B</span>
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <Compass className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-2xl font-black text-slate-800 leading-none">
                    {totalTripB.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">กิโลเมตรสะสม</p>
                </div>
              </div>

              {/* Combined Travel Distance */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ระยะเดินทางรวมทั้งหมด</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Route className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-2xl font-black text-emerald-600 leading-none">
                    {totalTravelDistance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">กิโลเมตรเดินทางสะสม</p>
                </div>
              </div>

              {/* Combined Trips Count */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">จำนวนบันทึกทริปทั้งหมด</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <History className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-2xl font-black text-indigo-600 leading-none">
                    {totalTripsCount}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">รายการเดินรถ</p>
                </div>
              </div>
            </div>

            {/* Travel Menu Workspace Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column - Record Form (Size 4) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <Route className="w-5 h-5 text-indigo-600" /> บันทึกข้อมูลเดินทางใหม่
                    </h3>
                  </div>

                  {hasTripDraft && (
                    <div className="mb-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 flex flex-col items-stretch gap-2.5 shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">📂</span>
                        <div>
                          <div className="font-bold text-amber-900 text-xs">พบข้อมูลร่างการเดินทาง</div>
                          <div className="text-[10px] text-amber-600">คุณสามารถกู้คืนหรือเริ่มกรอกใหม่ได้</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleLoadTripDraft}
                          className="flex-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          ดึงข้อมูลแบบร่าง
                        </button>
                        <button
                          type="button"
                          onClick={handleClearTripDraft}
                          className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] rounded-lg transition-colors cursor-pointer border border-slate-200"
                        >
                          ล้างร่าง
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleAddTrip} className="space-y-4">
                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่เดินทาง
                      </label>
                      <input
                        type="date"
                        required
                        value={tripDate}
                        onChange={(e) => setTripDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Route className="w-3.5 h-3.5 text-slate-400" /> จุดประสงค์ / ปลายทางการเดินทาง
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น เดินทางไปติดต่องาน, ท่องเที่ยวพัทยา"
                        value={tripTitle}
                        onChange={(e) => setTripTitle(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>

                    {/* Choose Record Mode */}
                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                        วิธีการป้อนค่าระยะทาง
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setTripInputMode("distance")}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            tripInputMode === "distance"
                              ? "bg-white text-indigo-600 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          ระยะทางตรงๆ
                        </button>
                        <button
                          type="button"
                          onClick={() => setTripInputMode("odometer")}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            tripInputMode === "odometer"
                              ? "bg-white text-indigo-600 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          เลขไมล์ปัจจุบัน
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                          ประเภททริปสะสม
                        </label>
                        <select
                          value={tripType}
                          onChange={(e) => setTripType(e.target.value as "A" | "B")}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white font-bold"
                        >
                          <option value="A">Trip A</option>
                          <option value="B">Trip B</option>
                        </select>
                      </div>

                      {tripInputMode === "distance" ? (
                        <div>
                          <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                            ระยะทางที่วิ่ง (กม.)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            required
                            placeholder="เช่น 35.4"
                            value={tripDistanceKm}
                            onChange={(e) => setTripDistanceKm(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold font-mono"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                            เลขไมล์สิ้นสุด (กม.)
                          </label>
                          <input
                            type="number"
                            required
                            placeholder="เช่น 12500"
                            value={tripOdometer}
                            onChange={(e) => setTripOdometer(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold font-mono"
                          />
                        </div>
                      )}
                    </div>

                    {tripInputMode === "odometer" && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                              เลขไมล์เริ่มต้น (กม.)
                            </label>
                            {getSuggestedStartOdometer() !== null && (
                              <button
                                type="button"
                                onClick={() => setTripStartOdometer(getSuggestedStartOdometer()!.toString())}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-all cursor-pointer border border-indigo-150"
                                title="คลิกเพื่อรีเซ็ตเป็นเลขไมล์สิ้นสุดทริปล่าสุด"
                              >
                                💡 แนะนำ: {getSuggestedStartOdometer()!.toLocaleString()} กม.
                              </button>
                            )}
                          </div>
                          <input
                            type="number"
                            placeholder="เช่น 12450 (แก้ไขได้)"
                            value={tripStartOdometer}
                            onChange={(e) => setTripStartOdometer(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold font-mono text-slate-500 bg-slate-50"
                          />
                        </div>

                        {tripOdometer && (
                          <div className="px-3 py-2 bg-indigo-50 text-indigo-800 rounded-xl flex justify-between items-center text-xs font-bold">
                            <span>ระยะทางคำนวณได้:</span>
                            <span className="font-mono text-sm bg-white px-2 py-0.5 rounded-lg border border-indigo-100 shadow-2xs">
                              {Math.max(0, Number(tripOdometer) - Number(tripStartOdometer))} กม.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* EV Battery Percentage inputs for trip log */}
                    {vehicle.type === "EV" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1">
                              🔋 แบตเตอรี่เริ่มต้น (%)
                            </label>
                            {getSuggestedStartBatteryPct() !== null && (
                              <button
                                type="button"
                                onClick={() => setTripStartBatteryPct(getSuggestedStartBatteryPct()!.toString())}
                                className="text-[9px] sm:text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-all cursor-pointer border border-indigo-150"
                                title="คลิกเพื่อป้อนแบตเตอรี่เริ่มต้นที่แนะนำ"
                              >
                                💡 แนะนำ: {getSuggestedStartBatteryPct()}%
                              </button>
                            )}
                          </div>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="เช่น 100"
                            value={tripStartBatteryPct}
                            onChange={(e) => setTripStartBatteryPct(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            🔋 แบตเตอรี่สิ้นสุด (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="เช่น 75"
                            value={tripEndBatteryPct}
                            onChange={(e) => setTripEndBatteryPct(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold font-mono"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-slate-400" /> โหมดการขับขี่
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "ECO", label: "ECO", bgActive: "bg-emerald-500 text-white border-emerald-500", bgInactive: "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800" },
                          { id: "Comfort", label: "Comfort", bgActive: "bg-blue-500 text-white border-blue-500", bgInactive: "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800" },
                          { id: "Sport", label: "Sport", bgActive: "bg-rose-500 text-white border-rose-500", bgInactive: "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800" }
                        ].map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setTripDrivingMode(mode.id as any)}
                            className={`border rounded-xl py-2 px-1 text-xs sm:text-sm font-bold transition-all text-center cursor-pointer shadow-3xs ${
                              tripDrivingMode === mode.id ? mode.bgActive : mode.bgInactive
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                        บันทึกเพิ่มเติม (ไม่บังคับ)
                      </label>
                      <textarea
                        placeholder="เช่น การจราจรช่วงเช้าติดขัดมาก"
                        value={tripNotes}
                        onChange={(e) => setTripNotes(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[80px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSaveTripDraft}
                        className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs py-3 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs"
                      >
                        💾 เซฟดราฟต์
                      </button>
                      <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-3 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> บันทึกจริง
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right Column - Trip History List Table (Size 8) */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Compass className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-bold text-slate-800 text-base">ประวัติบันทึกทริปเดินทาง</h3>
                    </div>
                    <div className="flex items-center gap-2.5 self-start sm:self-auto">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">ประเภททริป:</span>
                      <select
                        value={tripFilter}
                        onChange={(e) => setTripFilter(e.target.value as "All" | "A" | "B")}
                        className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
                      >
                        <option value="All">ทั้งหมด (All)</option>
                        <option value="A">เฉพาะ Trip A</option>
                        <option value="B">เฉพาะ Trip B</option>
                      </select>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                        รวม {filteredTripLogs.length} ทริป
                      </span>
                    </div>
                  </div>

                  {tripLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      ยังไม่มีประวัติบันทึกทริปเดินทางในระบบ กรอกฟอร์มเพื่อเริ่มบันทึกทริปแรกของคุณ
                    </div>
                  ) : filteredTripLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      ไม่พบประวัติบันทึกทริปเดินทางสำหรับประเภทที่เลือก
                    </div>
                  ) : (
                    <div className="overflow-x-auto w-full max-w-full -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none [&::-webkit-scrollbar]:hidden">
                      <table className="w-full text-left text-xs border-collapse min-w-[600px] md:min-w-0">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                            <th className="px-4 py-3">วันที่</th>
                            <th className="px-4 py-3">จุดประสงค์ / ปลายทาง</th>
                            <th className="px-4 py-3 text-center">ประเภททริป</th>
                            <th className="px-4 py-3 text-right">ระยะทาง (กม.)</th>
                            <th className="px-4 py-3">บันทึกเพิ่มเติม</th>
                            <th className="px-4 py-3 text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredTripLogs.map((trip) => (
                            <tr key={trip.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  {trip.date}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                <div className="flex flex-col gap-1">
                                  <span>{trip.title}</span>
                                  {trip.drivingMode && (
                                    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md w-max ${
                                      trip.drivingMode === "ECO"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                        : trip.drivingMode === "Sport"
                                        ? "bg-rose-50 text-rose-700 border border-rose-100"
                                        : "bg-blue-50 text-blue-700 border border-blue-100"
                                    }`}>
                                      <Cpu className="w-3 h-3 text-current" /> {trip.drivingMode}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] uppercase ${
                                  trip.tripType === "A" 
                                    ? "bg-cyan-50 text-cyan-800 border border-cyan-100" 
                                    : "bg-purple-50 text-purple-800 border border-purple-100"
                                }`}>
                                  Trip {trip.tripType}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                <div>{trip.distanceKm.toLocaleString(undefined, { minimumFractionDigits: 1 })} กม.</div>
                                {trip.odometerReading !== undefined && (
                                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    ไมล์: {trip.startOdometerReading?.toLocaleString() ?? "?"} - {trip.odometerReading.toLocaleString()}
                                  </div>
                                )}
                                {trip.startBatteryPct !== undefined && (
                                  <div className="text-[10px] text-indigo-500 font-bold font-sans">
                                    🔋 {trip.startBatteryPct}% → {trip.endBatteryPct}%
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate" title={trip.notes}>
                                {trip.notes || "-"}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleStartEditTrip(trip)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                                    title="แก้ไขทริป"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTrip(trip.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="ลบทริป"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          /* ==================== AI RECOMMENDATIONS TAB ==================== */
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header Area */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-100/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-12 -translate-y-12">
                <Sparkles className="w-64 h-64" />
              </div>
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide backdrop-blur-md">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" /> AI Intelligent Hub
                </div>
                <h2 className="text-2xl font-black tracking-tight">🧠 เมนูแนะนำและวิเคราะห์อัจฉริยะ AI</h2>
                <p className="text-sm text-indigo-100 max-w-2xl font-medium leading-relaxed">
                  ศูนย์กลางวิเคราะห์ปัญญาประดิษฐ์! แนะนำการขับขี่ คาดการณ์ประสิทธิภาพ ค้นหาข้อมูลเชิงลึก และตอบทุกข้อสงสัยทางเทคนิคสำหรับ {vehicle.model} ของคุณ
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (AI Energy Consultant Report) - size 5 */}
              <div className="lg:col-span-5 space-y-6">
                <InsightReport logs={logs} tripLogs={tripLogs} vehicle={vehicle} />
              </div>

              {/* Right Column (Smart Auto Guru AI Chatbot) - size 7 */}
              <div className="lg:col-span-7 space-y-6">
                <AiGuruChat vehicle={vehicle} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          /* ==================== SUMMARY REPORTS TAB ==================== */
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header Area */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-100/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-12 -translate-y-12">
                <FileText className="w-64 h-64" />
              </div>
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide backdrop-blur-md">
                  <FileText className="w-3.5 h-3.5 text-blue-200 fill-blue-200" /> Summary Reports
                </div>
                <h2 className="text-2xl font-black tracking-tight">📊 ระบบสรุปรายงานประจำช่วงเวลาและดาวน์โหลด PDF</h2>
                <p className="text-sm text-indigo-100 max-w-2xl font-medium leading-relaxed">
                  เลือกดูสรุปสถิติมุมมองต่างๆ พร้อมพิมพ์รายงานสรุปที่มีคุณภาพสูงสำหรับนำส่งหรือเก็บประวัติของ {vehicle.model}
                </p>
              </div>
            </div>

            <ReportSummary logs={logs} tripLogs={tripLogs} vehicle={vehicle} />
          </div>
        )}
      </main>

      {/* Edit Log Modal */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-indigo-600" /> แก้ไขข้อมูลประวัติ
                </h3>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingLog(null); }}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* วันที่ */}
                  <div>
                    <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">วันที่ตามใบเสร็จ</label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  
                  {/* ชื่อสถานี */}
                  <div>
                    <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">สถานีบริการ / ปั๊ม</label>
                    <input
                      type="text"
                      required
                      value={editStationName}
                      onChange={(e) => setEditStationName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  {editingLog.type === "ICE" ? (
                    <>
                      <div>
                        <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ประเภทน้ำมัน</label>
                        <select
                          value={editFuelType}
                          onChange={(e) => setEditFuelType(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white"
                        >
                          <option value="Gasohol 95">Gasohol 95</option>
                          <option value="Gasohol 91">Gasohol 91</option>
                          <option value="Gasohol E20">Gasohol E20</option>
                          <option value="Gasohol E85">Gasohol E85</option>
                          <option value="Benzene 95">Benzene 95 (เบนซินล้วน)</option>
                          <option value="Diesel B7">Diesel B7</option>
                          <option value="Diesel Premium">Diesel Premium</option>
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ราคา (บาท/ลิตร)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={editPricePerLiter}
                            onChange={(e) => {
                              setEditPricePerLiter(e.target.value);
                              const p = Number(e.target.value);
                              const v = Number(editVolumeLiters);
                              if (v && p) setEditTotalAmount((v * p).toFixed(2));
                            }}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ปริมาณ (ลิตร)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={editVolumeLiters}
                            onChange={(e) => {
                              setEditVolumeLiters(e.target.value);
                              const v = Number(e.target.value);
                              const p = Number(editPricePerLiter);
                              if (v && p) setEditTotalAmount((v * p).toFixed(2));
                            }}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ประเภทตู้ชาร์จ</label>
                        <select
                          value={editChargerType}
                          onChange={(e) => setEditChargerType(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white"
                        >
                          <option value="DC Fast Charge">DC Fast Charge</option>
                          <option value="AC Normal Charge">AC Normal Charge</option>
                          <option value="Home Charger">Home Charger (TOU)</option>
                          <option value="Home Charger (Normal)">Home Charger (Normal)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">หน่วยไฟ (kWh)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editEnergyKwh}
                          onChange={(e) => setEditEnergyKwh(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">แบตเริ่มต้น (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editStartBatteryPct}
                            onChange={(e) => setEditStartBatteryPct(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">แบตหลังชาร์จ (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editEndBatteryPct}
                            onChange={(e) => setEditEndBatteryPct(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ยอดจ่ายรวม (บาท)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editTotalAmount}
                      onChange={(e) => {
                        setEditTotalAmount(e.target.value);
                        if (editingLog.type === "ICE") {
                          const t = Number(e.target.value);
                          const p = Number(editPricePerLiter);
                          const v = Number(editVolumeLiters);
                          if (t && p) {
                            setEditVolumeLiters((t / p).toFixed(2));
                          } else if (t && v) {
                            setEditPricePerLiter((t / v).toFixed(2));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">เลขไมล์สะสม (กม.)</label>
                    <input
                      type="number"
                      value={editOdometerReading}
                      onChange={(e) => setEditOdometerReading(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingLog(null); }}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    บันทึกการแก้ไข
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Trip Modal */}
      <AnimatePresence>
        {editingTrip && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-indigo-600" /> แก้ไขข้อมูลทริปเดินทาง
                </h3>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingTrip(null); }}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <form onSubmit={handleSaveEditTrip} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">วันที่เดินทาง</label>
                  <input
                    type="date"
                    required
                    value={editTripDate}
                    onChange={(e) => setEditTripDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">รายละเอียด / จุดประสงค์</label>
                  <input
                    type="text"
                    required
                    value={editTripTitle}
                    onChange={(e) => setEditTripTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Choose Record Mode */}
                <div>
                  <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                    วิธีการป้อนค่าระยะทาง
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEditTripInputMode("distance")}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        editTripInputMode === "distance"
                          ? "bg-white text-indigo-600 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      ระยะทางตรงๆ
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTripInputMode("odometer")}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        editTripInputMode === "odometer"
                          ? "bg-white text-indigo-600 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      เลขไมล์ปัจจุบัน
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ประเภททริป</label>
                    <select
                      value={editTripType}
                      onChange={(e) => setEditTripType(e.target.value as "A" | "B")}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white font-bold"
                    >
                      <option value="A">Trip A</option>
                      <option value="B">Trip B</option>
                    </select>
                  </div>

                  {editTripInputMode === "distance" ? (
                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">ระยะทาง (กม.)</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={editTripDistanceKm}
                        onChange={(e) => setEditTripDistanceKm(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono font-bold"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">เลขไมล์สิ้นสุด (กม.)</label>
                      <input
                        type="number"
                        required
                        value={editTripOdometer}
                        onChange={(e) => setEditTripOdometer(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono font-bold"
                      />
                    </div>
                  )}
                </div>

                {editTripInputMode === "odometer" && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                        เลขไมล์เริ่มต้น (กม.)
                      </label>
                      <input
                        type="number"
                        placeholder="เช่น 12450 (แก้ไขได้)"
                        value={editTripStartOdometer}
                        onChange={(e) => setEditTripStartOdometer(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold font-mono text-slate-500 bg-slate-50"
                      />
                    </div>

                    {editTripOdometer && (
                      <div className="px-3 py-2 bg-indigo-50 text-indigo-800 rounded-xl flex justify-between items-center text-xs font-bold">
                        <span>ระยะทางคำนวณได้:</span>
                        <span className="font-mono text-sm bg-white px-2 py-0.5 rounded-lg border border-indigo-100 shadow-2xs">
                          {Math.max(0, Number(editTripOdometer) - Number(editTripStartOdometer))} กม.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* EV Battery Percentage edit fields */}
                {vehicle.type === "EV" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        🔋 แบตเตอรี่เริ่มต้น (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="เช่น 100"
                        value={editTripStartBatteryPct}
                        onChange={(e) => setEditTripStartBatteryPct(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        🔋 แบตเตอรี่สิ้นสุด (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="เช่น 75"
                        value={editTripEndBatteryPct}
                        onChange={(e) => setEditTripEndBatteryPct(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold font-mono"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" /> โหมดการขับขี่
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "ECO", label: "ECO", bgActive: "bg-emerald-500 text-white border-emerald-500", bgInactive: "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800" },
                      { id: "Comfort", label: "Comfort", bgActive: "bg-blue-500 text-white border-blue-500", bgInactive: "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800" },
                      { id: "Sport", label: "Sport", bgActive: "bg-rose-500 text-white border-rose-500", bgInactive: "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800" }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setEditTripDrivingMode(mode.id as any)}
                        className={`border rounded-xl py-2 px-1 text-xs sm:text-sm font-bold transition-all text-center cursor-pointer shadow-3xs ${
                          editTripDrivingMode === mode.id ? mode.bgActive : mode.bgInactive
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1.5">บันทึกเพิ่มเติม</label>
                  <textarea
                    value={editTripNotes}
                    onChange={(e) => setEditTripNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[80px]"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingTrip(null); }}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    บันทึกการแก้ไข
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reusable Confirm Dialog */}
      <AnimatePresence>
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-sm w-full p-6 space-y-4 overflow-hidden animate-in fade-in duration-150"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${confirmModal.isDestructive ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  {confirmModal.isDestructive ? <Trash2 className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                </div>
                <h4 className="font-bold text-slate-800 text-base">{confirmModal.title}</h4>
              </div>
              
              <p className="text-slate-500 text-xs leading-relaxed">
                {confirmModal.message}
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmModal(null); }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  {confirmModal.cancelText}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmModal.onConfirm(); }}
                  className={`px-5 py-2 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer text-white ${
                    confirmModal.isDestructive 
                      ? 'bg-rose-600 hover:bg-rose-700' 
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EV Charging Calculator Modal */}
      <ChargingCalculatorModal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        vehicle={vehicle}
        logs={logs}
        tripLogs={tripLogs}
      />

      {/* TOU Charging Station Settings Modal */}
      <TouStationSettingsModal
        isOpen={isTouModalOpen}
        onClose={() => setIsTouModalOpen(false)}
      />

      {/* Google Drive Cloud Backup Modal */}
      <GoogleDriveBackupModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        currentBackupData={{
          vehicle_profile: vehicle,
          energy_logs: logs,
          trip_logs: tripLogs,
        }}
        onRestoreBackup={handleRestoreBackupData}
        onRequestConfirm={(cfg) => setConfirmModal(cfg)}
      />

      {/* Android & PWA Installation Modal */}
      <AndroidInstallModal
        isOpen={isAndroidInstallModalOpen}
        onClose={() => setIsAndroidInstallModalOpen(false)}
      />

      {/* Offline Connectivity Status Indicator */}
      <OfflineIndicator />
    </div>
  );
}
