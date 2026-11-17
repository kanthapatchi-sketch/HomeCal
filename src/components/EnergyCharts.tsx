import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { EnergyLog } from "../types";
import { TrendingUp, CreditCard, Droplets, Zap } from "lucide-react";

interface EnergyChartsProps {
  logs: EnergyLog[];
}

const COLORS = ["#4f46e5", "#818cf8", "#f59e0b", "#3b82f6", "#06b6d4", "#a855f7"];

export default function EnergyCharts({ logs }: EnergyChartsProps) {
  // Sort logs by date ascending
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // 1. Prepare data for Cost & Consumption Chart
  const chartData = sortedLogs.map((log) => {
    const isEV = log.type === "EV";
    return {
      date: new Date(log.date).toLocaleDateString("th-TH", {
        month: "short",
        day: "numeric",
      }),
      cost: log.totalAmount,
      energy: isEV ? (log as any).energyKwh : (log as any).volumeLiters,
      unit: isEV ? "kWh" : "ลิตร",
      efficiency: log.distanceKm && log.distanceKm > 0
        ? Number((log.distanceKm / (isEV ? (log as any).energyKwh : (log as any).volumeLiters)).toFixed(2))
        : null,
    };
  });

  // 2. Prepare data for Station Brand Breakdown
  const stationCosts: Record<string, number> = {};
  logs.forEach((log) => {
    const name = log.stationName || "อื่นๆ";
    stationCosts[name] = (stationCosts[name] || 0) + log.totalAmount;
  });

  const pieData = Object.entries(stationCosts).map(([name, value]) => ({
    name,
    value,
  })).sort((a, b) => b.value - a.value).slice(0, 5); // top 5 stations

  if (logs.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-slate-400">
        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="font-bold text-slate-600 text-sm">ยังไม่มีข้อมูลสถิติสำหรับการแสดงกราฟ</p>
        <p className="text-xs text-slate-400 mt-1">บันทึกข้อมูลค่าน้ำมันหรือไฟเพื่อเริ่มวิเคราะห์</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1: Cost over Time */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-sm">แนวโน้มค่าใช้จ่ายรวมต่อครั้ง</h4>
          </div>
          <p className="text-slate-400 text-xs mb-4">แสดงยอดชำระเงินค่าน้ำมันและค่าไฟเรียงตามลำดับเวลา</p>
        </div>

        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #f1f5f9",
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                  fontSize: "12px",
                }}
              />
              <Area type="monotone" dataKey="cost" name="ค่าใช้จ่าย (บาท)" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Station Brand Breakdown */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-sm">ยอดเงินสะสมแบ่งตามปั๊ม/สถานี (Top 5)</h4>
          </div>
          <p className="text-slate-400 text-xs mb-4">สัดส่วนค่าใช้จ่ายสะสมแบ่งตามสถานีบริการพลังงาน</p>
        </div>

        <div className="w-full h-64 flex flex-col sm:flex-row items-center justify-center">
          <div className="w-full sm:w-1/2 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} บาท`, "ยอดรวม"]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #f1f5f9",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full sm:w-1/2 space-y-2 mt-4 sm:mt-0 px-2">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-slate-600 font-medium truncate">{item.name}</span>
                </div>
                <span className="text-slate-800 font-bold shrink-0">{item.value.toLocaleString()} บาท</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 3: Efficiency Trend (If logs have distance information) */}
      {chartData.some((d) => d.efficiency !== null) && (
        <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 lg:col-span-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {logs[0]?.type === "EV" ? (
                <Zap className="w-4 h-4 text-indigo-500" />
              ) : (
                <Droplets className="w-4 h-4 text-blue-500" />
              )}
              <h4 className="font-bold text-slate-800 text-sm">
                อัตราประสิทธิภาพการใช้พลังงาน ({logs[0]?.type === "EV" ? "km/kWh" : "km/L"})
              </h4>
            </div>
            <p className="text-slate-400 text-xs mb-4">ประสิทธิภาพจริงโดยเฉลี่ยเปรียบเทียบในแต่ละรอบการขับขี่</p>
          </div>

          <div className="w-full h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip
                  formatter={(value) => [`${value} ${logs[0]?.type === "EV" ? "km/kWh" : "km/L"}`, "ประสิทธิภาพ"]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #f1f5f9",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="efficiency" fill={logs[0]?.type === "EV" ? "#4f46e5" : "#3b82f6"} radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={logs[0]?.type === "EV" ? "#4f46e5" : "#3b82f6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
