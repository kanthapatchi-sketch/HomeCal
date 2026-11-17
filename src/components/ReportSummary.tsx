import React, { useState } from "react";
import { 
  FileText, 
  Calendar, 
  Download, 
  Zap, 
  Compass, 
  ChevronDown, 
  DollarSign, 
  Scale, 
  Info, 
  Check, 
  Car,
  Route,
  TrendingUp,
  Battery,
  Cpu
} from "lucide-react";
import { motion } from "motion/react";
import { EnergyLog, TripLog, Vehicle } from "../types";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend
} from "recharts";

interface ReportSummaryProps {
  logs: EnergyLog[];
  tripLogs: TripLog[];
  vehicle: Vehicle;
}

type PeriodType = "daily" | "weekly" | "monthly" | "custom";

export default function ReportSummary({ logs, tripLogs, vehicle }: ReportSummaryProps) {
  const [period, setPeriod] = useState<PeriodType>("monthly");
  
  // For custom range
  const getLocalTodayString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
  };
  
  const getSevenDaysAgoString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const d = new Date(Date.now() - tzoffset);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  };

  const [startDate, setStartDate] = useState<string>(getSevenDaysAgoString());
  const [endDate, setEndDate] = useState<string>(getLocalTodayString());
  const [isExporting, setIsExporting] = useState(false);

  // Filter logs & trips based on selected period
  const filterByPeriod = <T extends { date: string }>(items: T[]): T[] => {
    const todayStr = getLocalTodayString();
    const today = new Date(todayStr);
    
    return items.filter(item => {
      const itemDateStr = item.date; // "YYYY-MM-DD"
      const itemDate = new Date(itemDateStr);
      
      if (period === "daily") {
        return itemDateStr === todayStr;
      }
      
      if (period === "weekly") {
        // Last 7 days
        const sevenDaysAgo = new Date(todayStr);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return itemDate >= sevenDaysAgo && itemDate <= today;
      }
      
      if (period === "monthly") {
        // Current calendar month
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth();
        const curYear = today.getFullYear();
        const curMonth = today.getMonth();
        return itemYear === curYear && itemMonth === curMonth;
      }
      
      if (period === "custom") {
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Normalize time
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return itemDate >= start && itemDate <= end;
      }
      
      return true;
    });
  };

  const filteredLogs = filterByPeriod(logs).sort((a, b) => b.date.localeCompare(a.date));
  const filteredTrips = filterByPeriod(tripLogs).sort((a, b) => b.date.localeCompare(a.date));

  // --- Aggregate Energy Calculations ---
  const totalCost = filteredLogs.reduce((sum, log) => sum + log.totalAmount, 0);
  const totalEnergy = filteredLogs.reduce((sum, log) => {
    if (log.type === "EV") {
      return sum + (log.energyKwh || 0);
    } else {
      return sum + (log.volumeLiters || 0);
    }
  }, 0);

  const averageUnitCost = totalEnergy > 0 ? (totalCost / totalEnergy) : 0;

  // --- Aggregate Trip Calculations ---
  const totalDistance = filteredTrips.reduce((sum, trip) => sum + trip.distanceKm, 0);
  const totalTripsCount = filteredTrips.length;
  const avgTripDistance = totalTripsCount > 0 ? (totalDistance / totalTripsCount) : 0;

  // EV Battery statistics from trip logs
  let avgBatteryDrop = 0;
  if (vehicle.type === "EV") {
    let countWithBattery = 0;
    let totalDrop = 0;
    filteredTrips.forEach(trip => {
      if (trip.startBatteryPct !== undefined && trip.endBatteryPct !== undefined) {
        const drop = trip.startBatteryPct - trip.endBatteryPct;
        if (drop >= 0) {
          totalDrop += drop;
          countWithBattery++;
        }
      }
    });
    avgBatteryDrop = countWithBattery > 0 ? (totalDrop / countWithBattery) : 0;
  }

  // Calculate Efficiency
  // We can calculate efficiency (km / energy unit) if the user has records
  const calculatedKmFromLogs = filteredLogs.reduce((sum, l) => sum + (l.distanceKm || 0), 0);
  const efficiencyKmPerUnit = calculatedKmFromLogs > 0 && totalEnergy > 0
    ? (calculatedKmFromLogs / totalEnergy)
    : 0;

  // --- Driving Mode Efficiency Calculations ---
  const calculateModeEfficiency = (mode: "ECO" | "Comfort" | "Sport") => {
    // Filter trips for this mode in the active period
    const modeTrips = filteredTrips.filter((t) => t.drivingMode === mode);
    
    if (vehicle.type === "EV") {
      // Find trips with battery drop data
      const tripsWithBattery = modeTrips.filter(
        (t) => t.startBatteryPct !== undefined && t.endBatteryPct !== undefined && t.distanceKm > 0
      );
      
      let totalDist = 0;
      let totalDrop = 0;
      tripsWithBattery.forEach((t) => {
        const drop = (t.startBatteryPct || 0) - (t.endBatteryPct || 0);
        if (drop > 0) {
          totalDist += t.distanceKm;
          totalDrop += drop;
        }
      });
      
      const cap = vehicle.batteryCapacity || 60;
      const totalKwh = (totalDrop / 100) * cap;
      
      if (totalKwh > 0 && totalDist > 0) {
        return {
          efficiency: totalDist / totalKwh,
          isActual: true,
          tripCount: tripsWithBattery.length,
        };
      }
      
      // Fallback: If we have overall average efficiency from charging logs, scale it
      if (efficiencyKmPerUnit > 0) {
        const scaleFactor = mode === "ECO" ? 1.15 : mode === "Comfort" ? 1.0 : 0.82;
        return {
          efficiency: efficiencyKmPerUnit * scaleFactor,
          isActual: false,
          tripCount: modeTrips.length,
        };
      }
      
      // Secondary Fallback: Standard EV baselines
      const defaultEff = mode === "ECO" ? 6.8 : mode === "Comfort" ? 5.8 : 4.6;
      return {
        efficiency: defaultEff,
        isActual: false,
        tripCount: modeTrips.length,
      };
    } else {
      // Non-EV (ICE/Hybrid)
      // Overall average efficiency from fueling logs
      if (efficiencyKmPerUnit > 0) {
        const scaleFactor = mode === "ECO" ? 1.18 : mode === "Comfort" ? 1.0 : 0.80;
        return {
          efficiency: efficiencyKmPerUnit * scaleFactor,
          isActual: false,
          tripCount: modeTrips.length,
        };
      }
      
      // Fallback: Standard ICE baselines (km/l)
      const defaultEff = mode === "ECO" ? 16.5 : mode === "Comfort" ? 14.0 : 11.2;
      return {
        efficiency: defaultEff,
        isActual: false,
        tripCount: modeTrips.length,
      };
    }
  };

  const ecoEfficiency = calculateModeEfficiency("ECO");
  const comfortEfficiency = calculateModeEfficiency("Comfort");
  const sportEfficiency = calculateModeEfficiency("Sport");

  const efficiencies = [
    { name: "ECO", efficiency: ecoEfficiency.efficiency, isActual: ecoEfficiency.isActual, tripCount: ecoEfficiency.tripCount },
    { name: "Comfort", efficiency: comfortEfficiency.efficiency, isActual: comfortEfficiency.isActual, tripCount: comfortEfficiency.tripCount },
    { name: "Sport", efficiency: sportEfficiency.efficiency, isActual: sportEfficiency.isActual, tripCount: sportEfficiency.tripCount }
  ];
  
  const bestMode = [...efficiencies].sort((a, b) => b.efficiency - a.efficiency)[0];

  // PDF Export trigger
  const handleExportPDF = async () => {
    setIsExporting(true);
    
    // Create a temporary container for dedicated PDF content
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    tempContainer.style.top = "0";
    tempContainer.style.width = "800px";

    // Monthly Average Energy Efficiency Summary calculations
    const thaiMonthNames = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    const monthsMap: Record<string, { logs: typeof logs; trips: typeof tripLogs }> = {};

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

    // Chunk filtered logs & trips into page chunks (18 items per page)
    const logChunkSize = 18;
    const logChunks: typeof filteredLogs[] = [];
    for (let i = 0; i < filteredLogs.length; i += logChunkSize) {
      logChunks.push(filteredLogs.slice(i, i + logChunkSize));
    }
    if (logChunks.length === 0) logChunks.push([]);

    const tripChunkSize = 18;
    const tripChunks: typeof filteredTrips[] = [];
    for (let i = 0; i < filteredTrips.length; i += tripChunkSize) {
      tripChunks.push(filteredTrips.slice(i, i + tripChunkSize));
    }
    if (tripChunks.length === 0) tripChunks.push([]);

    const totalPages = 1 + logChunks.length + tripChunks.length;
    const printDate = `${new Date().toLocaleDateString("th-TH")} ${new Date().toLocaleTimeString("th-TH")}`;

    const pages: HTMLDivElement[] = [];

    // --- PAGE 1: Overview, Monthly Average Table & Driving Mode Analysis ---
    const page1 = document.createElement("div");
    page1.style.width = "800px";
    page1.style.minHeight = "1130px";
    page1.style.padding = "35px";
    page1.style.backgroundColor = "#ffffff";
    page1.style.boxSizing = "border-box";
    page1.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    page1.style.color = "#0f172a";
    page1.style.display = "flex";
    page1.style.flexDirection = "column";
    page1.style.justifyContent = "space-between";

    page1.innerHTML = `
      <div>
        <!-- Header -->
        <div style="padding-bottom: 16px; border-bottom: 3px solid #4f46e5; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px;">Vehicle Summary & Travel Report</h1>
            <p style="font-size: 13px; font-weight: 700; color: #4f46e5; margin: 4px 0 0 0;">${getPeriodLabel()}</p>
          </div>
          <div style="text-align: right;">
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 10px; text-align: left;">
              <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">โปรไฟล์ยานพาหนะ</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${vehicle.model}</div>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">
                ${vehicle.type === "EV" ? "⚡ รถยนต์ไฟฟ้า 100% (BEV)" : "⛽ รถยนต์น้ำมัน/ไฮบริด"}
              </div>
            </div>
          </div>
        </div>

        <!-- Overall Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">ยอดค่าใช้จ่ายรวม</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">฿${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">ค่าใช้จ่ายสะสมช่วงนี้</div>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">พลังงานที่ป้อนรวม</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">
              ${totalEnergy.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              <span style="font-size: 10px; color: #64748b;">${vehicle.type === "EV" ? "kWh" : "ลิตร"}</span>
            </div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">ปริมาณพลังงานสะสม</div>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">ระยะทางรวม</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">
              ${totalDistance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              <span style="font-size: 10px; color: #64748b;">กม.</span>
            </div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">ระยะทางขับขี่สะสม</div>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">อัตราประหยัดเฉลี่ย</div>
            <div style="font-size: 16px; font-weight: 800; color: #4f46e5; margin-top: 4px;">
              ${efficiencyKmPerUnit > 0 ? efficiencyKmPerUnit.toFixed(2) : "N/A"}
            </div>
            <div style="font-size: 9px; color: #6366f1; margin-top: 2px;">กม./${vehicle.type === "EV" ? "kWh" : "ลิตร"}</div>
          </div>
        </div>

        <!-- Monthly Average Energy Efficiency Summary Table -->
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px;">
            <span>📊 ตารางสรุปประสิทธิภาพพลังงานเฉลี่ยรายเดือน (Monthly Energy Efficiency Summary)</span>
            <span style="font-size: 10px; font-weight: 700; color: #4f46e5; background-color: #eef2ff; padding: 2px 8px; border-radius: 6px;">
              ${vehicle.type === "EV" ? "หน่วย: กม./kWh" : "หน่วย: กม./ลิตร"}
            </span>
          </h2>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #334155;">
                <th style="padding: 8px 10px; font-weight: 800;">เดือน / ปี</th>
                <th style="padding: 8px 10px; font-weight: 800; text-align: right;">พลังงานที่เติมรวม</th>
                <th style="padding: 8px 10px; font-weight: 800; text-align: right;">ค่าใช้จ่ายรวม</th>
                <th style="padding: 8px 10px; font-weight: 800; text-align: right;">ระยะทางรวม</th>
                <th style="padding: 8px 10px; font-weight: 800; text-align: right; color: #4f46e5;">ประสิทธิภาพเฉลี่ย</th>
                <th style="padding: 8px 10px; font-weight: 800; text-align: right; color: #059669;">ค่าใช้จ่ายต่อ กม.</th>
              </tr>
            </thead>
            <tbody>
              ${monthlySummaries.length === 0 ? `
                <tr>
                  <td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic;">ไม่มีข้อมูลประวัติย้อนหลังสำหรับสรุปรายเดือน</td>
                </tr>
              ` : monthlySummaries.map((m, idx) => `
                <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                  <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">${m.monthLabel}</td>
                  <td style="padding: 8px 10px; text-align: right; font-weight: 600; color: #334155;">
                    ${m.totalEnergy.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${vehicle.type === "EV" ? "kWh" : "ลิตร"}
                  </td>
                  <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #0f172a;">
                    ฿${m.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td style="padding: 8px 10px; text-align: right; font-weight: 600; color: #334155;">
                    ${m.totalDist.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} กม.
                  </td>
                  <td style="padding: 8px 10px; text-align: right; font-weight: 800; color: #4f46e5; background-color: ${idx % 2 === 1 ? '#eef2ff' : '#f5f3ff'};">
                    ${m.eff ? `${m.eff.toFixed(2)} ${vehicle.type === "EV" ? "กม./kWh" : "กม./ลิตร"}` : "-"}
                  </td>
                  <td style="padding: 8px 10px; text-align: right; font-weight: 800; color: #059669; background-color: ${idx % 2 === 1 ? '#ecfdf5' : '#f0fdf4'};">
                    ${m.costPerKm ? `฿${m.costPerKm.toFixed(2)}/กม.` : "-"}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Driving Mode Efficiency Section -->
        <div style="margin-top: 15px;">
          <h2 style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px;">
            ⚡ วิเคราะห์ประสิทธิภาพโหมดการขับขี่ (Driving Mode Efficiency Analysis)
          </h2>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                <th style="padding: 8px; color: #475569; font-weight: 800; text-align: left;">โหมดการขับขี่</th>
                <th style="padding: 8px; color: #475569; font-weight: 800; text-align: right;">ประสิทธิภาพเฉลี่ย</th>
                <th style="padding: 8px; color: #475569; font-weight: 800; text-align: left; padding-left: 20px;">สัดส่วนสัมพัทธ์</th>
                <th style="padding: 8px; color: #475569; font-weight: 800; text-align: center;">สถานะข้อมูล</th>
              </tr>
            </thead>
            <tbody>
              ${efficiencies.map(eff => {
                const maxVal = Math.max(...efficiencies.map(e => e.efficiency)) || 1;
                const percentage = (eff.efficiency / maxVal) * 100;
                const barColor = eff.name === "ECO" ? "#10b981" : eff.name === "Sport" ? "#f43f5e" : "#3b82f6";
                const unit = vehicle.type === "EV" ? "กม./kWh" : "กม./ลิตร";
                return `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 8px; font-weight: 800; color: #1e293b;">
                      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${barColor}; margin-right: 6px;"></span>
                      โหมด ${eff.name}
                    </td>
                    <td style="padding: 8px; text-align: right; font-weight: 800; color: #0f172a;">
                      ${eff.efficiency.toFixed(2)} ${unit}
                    </td>
                    <td style="padding: 8px 8px 8px 20px; width: 35%;">
                      <div style="background-color: #e2e8f0; width: 100%; height: 10px; border-radius: 5px; overflow: hidden;">
                        <div style="background-color: ${barColor}; width: ${percentage}%; height: 100%;"></div>
                      </div>
                    </td>
                    <td style="padding: 8px; text-align: center; font-weight: 600; color: ${eff.isActual ? "#4f46e5" : "#64748b"}; font-size: 10px;">
                      ${eff.isActual ? "📊 ข้อมูลจริง" : "⚙️ ค่ามาตรฐานเฉลี่ย"}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
          
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 11px; color: #475569; font-weight: 600; line-height: 1.5;">
            💡 <strong>คำแนะนำเชิงลึก:</strong> โหมดการขับขี่ที่ประหยัดที่สุดคือ <strong>โหมด ${bestMode.name}</strong> 
            ให้อัตราความประหยัดพลังงานเฉลี่ยสูงสุดที่ <strong>${bestMode.efficiency.toFixed(2)} ${vehicle.type === "EV" ? "กม./kWh" : "กม./ลิตร"}</strong>
          </div>
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
      page.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
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
                ${logChunks.length > 1 ? `รายการที่ ${chunkIdx * logChunkSize + 1} - ${Math.min((chunkIdx + 1) * logChunkSize, filteredLogs.length)} จากทั้งหมด ${filteredLogs.length} รายการ` : `รายการสะสมทั้งหมด ${filteredLogs.length} รายการ`}
              </p>
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #2563eb; background-color: #eff6ff; padding: 6px 12px; border-radius: 8px;">
              ยอดค่าใช้จ่ายพลังงานรวม: ฿${totalCost.toLocaleString()}
            </div>
          </div>

          ${chunk.length === 0 ? `
            <div style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 25px; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center;">ไม่พบข้อมูลสถิติพลังงานในช่วงเวลานี้</div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">วันที่</th>
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">สถานที่ / สถานี</th>
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">ประเภทบริการ</th>
                  <th style="padding: 9px; text-align: right; font-weight: bold; color: #475569;">จำนวนที่ป้อน</th>
                  <th style="padding: 9px; text-align: right; font-weight: bold; color: #475569;">ยอดเงินสุทธิ</th>
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
      page.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
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
                ${tripChunks.length > 1 ? `รายการที่ ${chunkIdx * tripChunkSize + 1} - ${Math.min((chunkIdx + 1) * tripChunkSize, filteredTrips.length)} จากทั้งหมด ${filteredTrips.length} รายการ` : `รายการสะสมทั้งหมด ${filteredTrips.length} รายการ`}
              </p>
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #047857; background-color: #ecfdf5; padding: 6px 12px; border-radius: 8px;">
              ระยะทางขับขี่สะสมรวม: ${totalDistance.toLocaleString()} กม.
            </div>
          </div>

          ${chunk.length === 0 ? `
            <div style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 25px; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center;">ไม่พบข้อมูลบันทึกประวัติทริปเดินทางในช่วงเวลานี้</div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">วันที่</th>
                  <th style="padding: 9px; text-align: left; font-weight: bold; color: #475569;">ชื่อทริปการเดินทาง</th>
                  <th style="padding: 9px; text-align: center; font-weight: bold; color: #475569;">ประเภท</th>
                  <th style="padding: 9px; text-align: right; font-weight: bold; color: #475569;">ระยะทาง</th>
                  ${vehicle.type === "EV" ? `<th style="padding: 9px; text-align: center; font-weight: bold; color: #475569;">ระดับแบตเตอรี่ (เริ่ม-จบ)</th>` : ""}
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
                    ${vehicle.type === "EV" ? `
                      <td style="padding: 8px 9px; text-align: center; color: #475569;">${trip.startBatteryPct !== undefined ? `${trip.startBatteryPct}% → ${trip.endBatteryPct}%` : "-"}</td>
                    ` : ""}
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

      const dateStr = getLocalTodayString();
      pdf.save(`vehicle_report_${period}_${dateStr}.pdf`);
    } catch (err) {
      console.error("Failed to export PDF:", err);
      alert("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF กรุณาลองใหม่อีกครั้ง");
    } finally {
      if (tempContainer && tempContainer.parentNode) {
        tempContainer.parentNode.removeChild(tempContainer);
      }
      setIsExporting(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "daily": return "สถิติรายวัน (วันนี้)";
      case "weekly": return "สถิติรายสัปดาห์ (ย้อนหลัง 7 วัน)";
      case "monthly": return "สถิติรายเดือน (เดือนนี้)";
      case "custom": return `ช่วงวันที่กำหนด (${startDate} ถึง ${endDate})`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Bar */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" /> ช่วงเวลาสำหรับสรุปสถิติรายงาน
          </h3>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            เลือกช่วงเวลาด้านขวาเพื่อกรองข้อมูลทั้งพลังงานและทริปเดินทาง
          </p>
        </div>

        {/* Dropdowns & Date inputs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodType)}
              className="appearance-none bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              <option value="daily">รายวัน (วันนี้)</option>
              <option value="weekly">รายสัปดาห์ (7 วันล่าสุด)</option>
              <option value="monthly">รายเดือน (เดือนนี้)</option>
              <option value="custom">กำหนดช่วงเวลาเอง</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {period === "custom" && (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold font-mono focus:outline-none text-slate-600"
              />
              <span className="text-slate-400 font-bold text-xs">ถึง</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold font-mono focus:outline-none text-slate-600"
              />
            </div>
          )}

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isExporting ? (
              <span className="animate-pulse">กำลังจัดเตรียม PDF...</span>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                ส่งออก PDF (ทั้งสองระบบ)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Styled Printable Container */}
      <div className="bg-slate-100 p-1 sm:p-4 rounded-3xl border border-slate-200/50">
        <div 
          id="report-pdf-content" 
          className="bg-white p-6 sm:p-10 rounded-2xl shadow-sm space-y-8 font-sans max-w-[800px] mx-auto text-slate-800"
        >
          {/* PDF Report Header */}
          <div className="border-b-2 border-indigo-600 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                  <Car className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Vehicle Summary & Travel Report</h1>
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{getPeriodLabel()}</p>
            </div>
            
            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl text-left min-w-[200px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">โปรไฟล์ยานพาหนะ</div>
              <div className="text-sm font-black text-slate-800">{vehicle.model}</div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                {vehicle.type === "EV" ? "⚡ รถยนต์ระบบไฟฟ้า 100% (BEV)" : "⛽ รถยนต์เครื่องยนต์สันดาป/ไฮบริด"}
              </div>
            </div>
          </div>

          {/* ข้อมูลโปรไฟล์รถยนต์บนหน้าจอพรีวิว */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 space-y-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-indigo-600 animate-pulse" /> ข้อมูลโปรไฟล์รถยนต์ (Vehicle Profile Details)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-slate-600">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">ยี่ห้อ / รุ่น</span>
                <span className="text-slate-900 font-extrabold">{vehicle.model || "ไม่ระบุ"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">ประเภทระบบขับเคลื่อน</span>
                <span className="text-slate-900 font-extrabold">
                  {vehicle.type === "EV" ? "⚡ ไฟฟ้า 100% (BEV)" : "⛽ สันดาป/ไฮบริด (ICE)"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                  {vehicle.type === "EV" ? "ความจุแบตเตอรี่พิกัด" : "ความจุถังน้ำมันพิกัด"}
                </span>
                <span className="text-slate-900 font-extrabold">
                  {vehicle.type === "EV" 
                    ? (vehicle.batteryCapacity ? `${vehicle.batteryCapacity} kWh` : "60 kWh") 
                    : (vehicle.fuelCapacity ? `${vehicle.fuelCapacity} ลิตร` : "ไม่ระบุ")}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">จำนวนประวัติสะสมทั้งหมด</span>
                <span className="text-indigo-600 font-extrabold">
                  เติมพลังงาน {logs.length} ครั้ง / เดินทาง {tripLogs.length} ทริป
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: ENERGY SYSTEM SUMMARY */}
          <div className="space-y-4">
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" /> 1. รายงานประสิทธิภาพและการใช้พลังงาน (Energy Metrics)
            </h2>

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">ยอดค่าใช้จ่ายรวม</div>
                <div className="text-lg font-black text-slate-900">
                  ฿{totalCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">บาททั้งหมด</div>
              </div>

              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">พลังงานที่ป้อนรวม</div>
                <div className="text-lg font-black text-slate-900">
                  {totalEnergy.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
                  <span className="text-xs font-bold text-slate-500">{vehicle.type === "EV" ? "kWh" : "ลิตร"}</span>
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                  {vehicle.type === "EV" ? "หน่วยกระแสไฟสะสม" : "ปริมาณน้ำมันเชื้อเพลิง"}
                </div>
              </div>

              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">เฉลี่ยอัตราค่าใช้จ่าย</div>
                <div className="text-lg font-black text-slate-900">
                  ฿{averageUnitCost.toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                  ต่อ {vehicle.type === "EV" ? "kWh" : "ลิตร"}
                </div>
              </div>

              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">อัตราประหยัดพลังงาน</div>
                <div className="text-lg font-black text-slate-900">
                  {efficiencyKmPerUnit > 0 ? `${efficiencyKmPerUnit.toFixed(2)}` : "N/A"}
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                  กม. / {vehicle.type === "EV" ? "kWh" : "ลิตร"} (คำนวณจากไมล์)
                </div>
              </div>
            </div>

            {/* Energy Log mini-table */}
            <div className="border border-slate-200/60 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-slate-500 font-bold">วันที่</th>
                    <th className="px-4 py-3 text-slate-500 font-bold">สถานีพลังงาน</th>
                    <th className="px-4 py-3 text-slate-500 font-bold">ประเภทพลังงาน/ชาร์จ</th>
                    <th className="px-4 py-3 text-right text-slate-500 font-bold">หน่วยที่เติม</th>
                    <th className="px-4 py-3 text-right text-slate-500 font-bold">ยอดเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                        ไม่พบข้อมูลสถิติพลังงานในช่วงเวลานี้
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/30">
                        <td className="px-4 py-3 font-mono text-slate-500 font-bold">{log.date}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{log.stationName}</td>
                        <td className="px-4 py-3 text-slate-500 font-bold">
                          {log.type === "ICE" ? log.fuelType : log.chargerType}
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono">
                          {log.type === "ICE" 
                            ? `${log.volumeLiters.toFixed(1)} ลิตร` 
                            : `${log.energyKwh.toFixed(1)} kWh`}
                        </td>
                        <td className="px-4 py-3 text-right font-black font-mono text-slate-800">
                          {log.totalAmount.toLocaleString()} บาท
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: TRIP TRAVEL LOG SUMMARY */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Compass className="w-4 h-4 text-indigo-600" /> 2. รายงานสรุปการเดินทาง (Travel Trip Summary)
            </h2>

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">ระยะทางรวมทริป</div>
                <div className="text-lg font-black text-slate-900">
                  {totalDistance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
                  <span className="text-xs font-bold text-slate-500">กม.</span>
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">กิโลเมตรเดินทางรวม</div>
              </div>

              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">จำนวนบันทึกเดินรถ</div>
                <div className="text-lg font-black text-slate-900">
                  {totalTripsCount}{" "}
                  <span className="text-xs font-bold text-slate-500">ทริป</span>
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">รายการขับขี่ทั้งหมด</div>
              </div>

              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">ระยะทางเฉลี่ยต่อทริป</div>
                <div className="text-lg font-black text-slate-900">
                  {avgTripDistance.toFixed(1)}{" "}
                  <span className="text-xs font-bold text-slate-500">กม.</span>
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">ต่อหนึ่งทริปการเดินทาง</div>
              </div>

              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                {vehicle.type === "EV" ? (
                  <>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">เฉลี่ยแบตเตอรี่ที่ลด</div>
                    <div className="text-lg font-black text-indigo-600">
                      {avgBatteryDrop > 0 ? `${avgBatteryDrop.toFixed(1)}%` : "N/A"}
                    </div>
                    <div className="text-[9px] text-indigo-500 font-bold uppercase mt-1">
                      เปอร์เซ็นต์ต่อทริปเดินทาง
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">สัดส่วนประเภทเดินทาง</div>
                    <div className="text-xs font-black text-slate-800 pt-1">
                      A: {filteredTrips.filter(t => t.tripType === "A").length} | B: {filteredTrips.filter(t => t.tripType === "B").length}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">จำนวนทริปแยกตามประเภท</div>
                  </>
                )}
              </div>
            </div>

            {/* Travel Log Table */}
            <div className="border border-slate-200/60 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-slate-500 font-bold">วันที่</th>
                    <th className="px-4 py-3 text-slate-500 font-bold">ปลายทาง/จุดประสงค์</th>
                    <th className="px-4 py-3 text-center text-slate-500 font-bold">ประเภท</th>
                    <th className="px-4 py-3 text-right text-slate-500 font-bold">ระยะทาง (กม.)</th>
                    {vehicle.type === "EV" && (
                      <th className="px-4 py-3 text-center text-slate-500 font-bold">แบตเตอรี่เริ่มต้น → หลังขับ</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTrips.length === 0 ? (
                    <tr>
                      <td colSpan={vehicle.type === "EV" ? 5 : 4} className="px-4 py-8 text-center text-slate-400 font-medium">
                        ไม่พบข้อมูลบันทึกประวัติทริปเดินทางในช่วงเวลานี้
                      </td>
                    </tr>
                  ) : (
                    filteredTrips.map((trip) => (
                      <tr key={trip.id} className="hover:bg-slate-50/30">
                        <td className="px-4 py-3 font-mono text-slate-500 font-bold">{trip.date}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{trip.title}</span>
                            {trip.drivingMode && (
                              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                trip.drivingMode === "ECO"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  : trip.drivingMode === "Sport"
                                  ? "bg-rose-50 text-rose-700 border border-rose-100"
                                  : "bg-blue-50 text-blue-700 border border-blue-100"
                              }`}>
                                <Cpu className="w-2.5 h-2.5 text-current" /> {trip.drivingMode}
                              </span>
                            )}
                          </div>
                          {trip.notes && <div className="text-[10px] text-slate-400 font-medium font-sans mt-0.5">{trip.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            trip.tripType === "A" 
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            ทริป {trip.tripType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black font-mono text-slate-800">
                          {trip.distanceKm.toFixed(1)} กม.
                        </td>
                        {vehicle.type === "EV" && (
                          <td className="px-4 py-3 text-center font-bold font-mono text-indigo-600">
                            {trip.startBatteryPct !== undefined && trip.endBatteryPct !== undefined ? (
                              <span className="flex items-center justify-center gap-1">
                                <Battery className="w-3 h-3" />
                                {trip.startBatteryPct}% → {trip.endBatteryPct}%
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium font-sans">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: DRIVING MODE EFFICIENCY ANALYSIS */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Cpu className="w-4 h-4 text-emerald-500" /> 3. วิเคราะห์ประสิทธิภาพโหมดการขับขี่ (Driving Mode Efficiency Analysis)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Left description / Insight card */}
              <div className="md:col-span-1 space-y-3 bg-slate-50 border border-slate-100 p-4.5 rounded-2xl text-left">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">โหมดขับขี่ประหยัดพลังงานที่สุด</div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-lg text-white shadow-xs ${
                    bestMode.name === "ECO" ? "bg-emerald-500" : bestMode.name === "Sport" ? "bg-rose-500" : "bg-blue-500"
                  }`}>
                    โหมด {bestMode.name}
                  </span>
                  <div className="text-sm font-black text-slate-800">
                    {bestMode.efficiency.toFixed(2)} <span className="text-xs font-bold text-slate-500">{vehicle.type === "EV" ? "กม./kWh" : "กม./ลิตร"}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  จากการเปรียบเทียบโหมดการขับขี่ <strong>{bestMode.name}</strong> มีประสิทธิภาพประหยัดพลังงานสูงสุด 
                  {bestMode.isActual ? " คำนวณจากประวัติการขับขี่จริงของคุณผ่านข้อมูลแบตเตอรี่ในทริป" : " โดยประมาณจากข้อมูลเฉลี่ยและประเภทของรถคุณ"}
                </p>

                <div className="text-[10px] text-slate-400 leading-relaxed">
                  * ข้อมูลนี้คำนวณเปรียบเทียบอัตราส่วนระยะทางต่อหน่วยพลังงาน 
                  เพื่อแสดงให้เห็นถึงอัตราความประหยัดของแต่ละโหมดในทางปฏิบัติจริง
                </div>
              </div>

              {/* Right: Recharts Bar Chart */}
              <div className="md:col-span-2 bg-white border border-slate-100 rounded-2xl p-4 h-[240px] flex flex-col justify-between">
                <div className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex justify-between items-center">
                  <span>เปรียบเทียบประสิทธิภาพ ({vehicle.type === "EV" ? "กม./kWh" : "กม./ลิตร"})</span>
                  <span className="text-[9px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">ยิ่งสูง ยิ่งประหยัด</span>
                </div>
                
                <div className="w-full h-[180px] text-xs font-bold font-mono">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={efficiencies}
                      margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                    >
                      <XAxis 
                        dataKey="name" 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} 
                      />
                      <YAxis 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-md border border-slate-800 text-xs font-sans space-y-1 text-left">
                                <div className="font-extrabold flex items-center gap-1.5">
                                  <span className={`w-2.5 h-2.5 rounded-full ${
                                    data.name === "ECO" ? "bg-emerald-500" : data.name === "Sport" ? "bg-rose-500" : "bg-blue-500"
                                  }`} />
                                  โหมด {data.name}
                                </div>
                                <div className="font-mono text-[11px]">
                                  ประสิทธิภาพ: <span className="font-bold text-amber-400">{data.efficiency.toFixed(2)}</span> {vehicle.type === "EV" ? "กม./kWh" : "กม./ลิตร"}
                                </div>
                                <div className="text-[9px] text-slate-400">
                                  {data.tripCount} ทริป | {data.isActual ? "คำนวณจากแบตเตอรี่จริง" : "ค่ามาตรฐานเฉลี่ย"}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="efficiency" radius={[6, 6, 0, 0]} maxBarSize={45}>
                        {efficiencies.map((entry, index) => {
                          const color = entry.name === "ECO" ? "#10b981" : entry.name === "Sport" ? "#f43f5e" : "#3b82f6";
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Area with Timestamp & Notes */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 font-bold font-mono">
            <div>
              พิมพ์เมื่อ: {new Date().toLocaleString("th-TH")}
            </div>
            <div>
              สร้างอัจฉริยะโดยระบบ Vehicle Energy Tracker
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
