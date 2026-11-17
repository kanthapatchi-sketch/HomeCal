import { EnergyLog, VehicleType } from "../types";

export interface EfficiencyAlertResult {
  hasAlert: boolean;
  severity: "warning" | "critical";
  logId?: string;
  date?: string;
  stationName?: string;
  actualEfficiency: number;      // e.g. 3.20 km/kWh or km/L
  averageEfficiency: number;     // e.g. 5.80 km/kWh or km/L
  dropPercentage: number;        // e.g. 44.8% drop in efficiency
  vehicleType: VehicleType;
  unit: string;                  // "km/kWh" | "km/L"
  consumptionRate: string;       // e.g. "312 Wh/km" or "14.3 ลิตร/100km"
  possibleCauses: string[];
  recommendations: string[];
  lowEfficiencyLogsCount: number;
}

/**
 * Monitors energy logs for unusually high consumption (low km/kWh or low km/L).
 * Returns an alert payload if high consumption / low efficiency is detected.
 */
export function monitorEnergyEfficiency(
  logs: EnergyLog[],
  vehicleType: VehicleType
): EfficiencyAlertResult | null {
  if (!logs || logs.length === 0) return null;

  // Filter valid logs that have distance and energy values
  const validLogs = logs
    .filter((log) => {
      const distance = log.distanceKm || 0;
      if (distance <= 0) return false;
      if (vehicleType === "EV") {
        return log.type === "EV" && (log as any).energyKwh > 0;
      } else {
        return log.type === "ICE" && (log as any).volumeLiters > 0;
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Fallback: check all valid logs if type filter didn't catch (e.g. mixed logs)
  const logsToProcess = validLogs.length > 0
    ? validLogs
    : logs
        .filter((log) => {
          const distance = log.distanceKm || 0;
          if (distance <= 0) return false;
          return log.type === "EV" ? (log as any).energyKwh > 0 : (log as any).volumeLiters > 0;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (logsToProcess.length === 0) return null;

  // Calculate efficiency for each log
  const logsWithEff = logsToProcess.map((log) => {
    const dist = log.distanceKm!;
    const energy = log.type === "EV" ? (log as any).energyKwh : (log as any).volumeLiters;
    const eff = dist / energy; // km/kWh or km/L
    return { log, eff, dist, energy };
  });

  // Calculate overall average efficiency
  const totalDist = logsWithEff.reduce((s, item) => s + item.dist, 0);
  const totalEnergy = logsWithEff.reduce((s, item) => s + item.energy, 0);
  const avgEff = totalDist / totalEnergy;

  // Benchmarks for low efficiency (high consumption)
  // EV: Normal is ~5-7 km/kWh (140-200 Wh/km). Low is < 4.2 km/kWh (>238 Wh/km) or drop > 18%
  // ICE: Normal is ~12-18 km/L. Low is < 9.0 km/L or drop > 18%
  const currentType = logsToProcess[0].type as VehicleType;
  const lowEffThreshold = currentType === "EV" ? 4.2 : 9.0;

  // Check latest item first
  const latestItem = logsWithEff[0];

  // Find all logs with low efficiency
  const lowEffLogs = logsWithEff.filter(
    (item) => item.eff < lowEffThreshold || (avgEff > 0 && item.eff < avgEff * 0.82)
  );

  // Determine target item to highlight: use latest if low, else most severe low log
  const isLatestLow = latestItem.eff < lowEffThreshold || (avgEff > 0 && latestItem.eff < avgEff * 0.82);
  const targetItem = isLatestLow ? latestItem : lowEffLogs[0];

  if (!targetItem) return null;

  const actualEff = targetItem.eff;
  const dropPct = avgEff > 0 ? ((avgEff - actualEff) / avgEff) * 100 : 0;

  // Severity
  const isCritical =
    currentType === "EV"
      ? actualEff < 3.2 || dropPct > 35
      : actualEff < 7.0 || dropPct > 35;

  const severity = isCritical ? "critical" : "warning";
  const unit = currentType === "EV" ? "กม./kWh" : "กม./ลิตร";

  // Consumption rate display
  const consumptionRate =
    currentType === "EV"
      ? `${Math.round((1 / actualEff) * 1000)} Wh/km`
      : `${((1 / actualEff) * 100).toFixed(1)} ลิตร/100km`;

  const possibleCauses =
    currentType === "EV"
      ? [
          "ขับขี่ด้วยความเร็วสูงต่อเนื่อง หรือเร่งแซงกระทันหันบ่อยครั้ง",
          "สภาพอากาศร้อนจัดเปิดระบบปรับอากาศ (A/C) เร่งความเย็นจัด",
          "แรงดันลมยางอ่อนกว่ามาตรฐาน ทำให้เกิดแรงต้านการหมุน (Rolling Resistance) สูงขึ้น",
          "ขับขี่บนเส้นทางขึ้นเขา ทางชันสูง หรือมีการบรรทุกสัมภาระน้ำหนักมาก"
        ]
      : [
          "การจราจรติดขัดรุนแรง ต้องจอดติดเครื่องยนต์ทิ้งไว้นาน",
          "เหยียบคันเร่งลึก/กระชากบ่อยครั้ง หรือลากเกียร์ต่ำในรอบเครื่องยนต์สูง",
          "แรงดันลมยางอ่อน หรือกรองอากาศ/หัวเทียนเริ่มอุดตันและเสื่อมสภาพ",
          "บรรทุกสัมภาระน้ำหนักเกินมาตรฐาน หรือเปิดแอร์ความเย็นสูงสุด"
        ];

  const recommendations =
    currentType === "EV"
      ? [
          "เปลี่ยนโหมดขับขี่เป็น ECO Mode และปรับระดับ Regenerative Braking สูงขึ้น",
          "ตรวจเช็กลมยางให้อยู่ในเกณฑ์มาตรฐาน (แนะนำ 36-40 PSI สำหรับรถ EV)",
          "ควบคุมความเร็วสม่ำเสมอช่วง 80-100 กม./ชม. เพื่อยืดระยะทางขับขี่",
          "ใช้ระบบ Pre-conditioning ตั้งอุณหภูมิห้องโดยสารล่วงหน้าขณะเสียบปลั๊กชาร์จ"
        ]
      : [
          "ขับขี่แบบ Smooth Driving ค่อยๆ เติมคันเร่งอย่างนุ่มนวลและสม่ำเสมอ",
          "ตรวจเช็กลมยางให้เหมาะสม (32-36 PSI) ช่วยลดการกินน้ำมันได้ถึง 3-5%",
          "ดับเครื่องยนต์ขณะจอดคอยเป็นเวลานาน",
          "นำรถเข้าตรวจเช็กระยะ เปลี่ยนถ่ายน้ำมันเครื่องและทำความสะอาดกรองอากาศ"
        ];

  return {
    hasAlert: true,
    severity,
    logId: targetItem.log.id,
    date: targetItem.log.date,
    stationName: targetItem.log.stationName,
    actualEfficiency: Number(actualEff.toFixed(2)),
    averageEfficiency: Number(avgEff.toFixed(2)),
    dropPercentage: Number(Math.max(0, dropPct).toFixed(1)),
    vehicleType: currentType,
    unit,
    consumptionRate,
    possibleCauses,
    recommendations,
    lowEfficiencyLogsCount: lowEffLogs.length
  };
}
