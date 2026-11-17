import React from "react";
import { Zap, Droplet, Home, Building2, MapPin, Sparkles, Plug } from "lucide-react";
import { EnergyLog, VehicleType } from "../types";

export interface StationBadgeInfo {
  networkName: string;
  badgeClass: string;
  dotColor: string;
  iconType: "ev" | "home" | "fuel" | "default";
}

/**
 * Identify station brand/network and return corresponding badge color classes
 */
export function getStationBadgeInfo(stationName: string = "", logType: VehicleType = "EV"): StationBadgeInfo {
  const name = stationName.toLowerCase().trim();

  if (logType === "ICE") {
    if (name.includes("ptt") || name.includes("ปตท")) {
      return {
        networkName: "PTT Station",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200/90 ring-1 ring-blue-500/10",
        dotColor: "bg-blue-500",
        iconType: "fuel",
      };
    }
    if (name.includes("bangchak") || name.includes("บางจาก")) {
      return {
        networkName: "Bangchak",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/90 ring-1 ring-emerald-500/10",
        dotColor: "bg-emerald-500",
        iconType: "fuel",
      };
    }
    if (name.includes("shell") || name.includes("เชลล์")) {
      return {
        networkName: "Shell",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200/90 ring-1 ring-amber-500/10",
        dotColor: "bg-amber-500",
        iconType: "fuel",
      };
    }
    if (name.includes("caltex") || name.includes("คาลเท็กซ์")) {
      return {
        networkName: "Caltex",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200/90 ring-1 ring-rose-500/10",
        dotColor: "bg-rose-500",
        iconType: "fuel",
      };
    }
    if (name.includes("pt") || name.includes("พีที")) {
      return {
        networkName: "PT Station",
        badgeClass: "bg-green-50 text-green-700 border-green-200/90 ring-1 ring-green-500/10",
        dotColor: "bg-green-500",
        iconType: "fuel",
      };
    }
    if (name.includes("susco") || name.includes("ซัสโก้")) {
      return {
        networkName: "Susco",
        badgeClass: "bg-sky-50 text-sky-700 border-sky-200/90 ring-1 ring-sky-500/10",
        dotColor: "bg-sky-500",
        iconType: "fuel",
      };
    }
    return {
      networkName: "ปั๊มน้ำมัน",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200/90 ring-1 ring-slate-400/10",
      dotColor: "bg-slate-400",
      iconType: "fuel",
    };
  }

  // EV Station Networks
  if (name.includes("pluz") || name.includes("ev station") || (name.includes("ptt") && logType === "EV")) {
    return {
      networkName: "EV Station PluZ",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200/90 ring-1 ring-sky-500/20",
      dotColor: "bg-sky-500",
      iconType: "ev",
    };
  }
  if (name.includes("pea") || name.includes("volta")) {
    return {
      networkName: "PEA VOLTA",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200/90 ring-1 ring-purple-500/20",
      dotColor: "bg-purple-500",
      iconType: "ev",
    };
  }
  if (name.includes("mea")) {
    return {
      networkName: "MEA EV",
      badgeClass: "bg-orange-50 text-orange-700 border-orange-200/90 ring-1 ring-orange-500/20",
      dotColor: "bg-orange-500",
      iconType: "ev",
    };
  }
  if (name.includes("elex") || name.includes("egat") || name.includes("กฟผ")) {
    return {
      networkName: "EleXA / EGAT",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200/90 ring-1 ring-amber-500/20",
      dotColor: "bg-amber-500",
      iconType: "ev",
    };
  }
  if (name.includes("charge+") || name.includes("chargeplus") || name.includes("ชาร์จพลัส")) {
    return {
      networkName: "Charge+",
      badgeClass: "bg-teal-50 text-teal-700 border-teal-200/90 ring-1 ring-teal-500/20",
      dotColor: "bg-teal-500",
      iconType: "ev",
    };
  }
  if (name.includes("tesla") || name.includes("supercharger")) {
    return {
      networkName: "Tesla Supercharger",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200/90 ring-1 ring-rose-500/20",
      dotColor: "bg-rose-500",
      iconType: "ev",
    };
  }
  if (
    name.includes("home") ||
    name.includes("บ้าน") ||
    name.includes("tou") ||
    name.includes("ae000") ||
    name.includes("wallbox") ||
    name.includes("ฉุกเฉิน") ||
    name.includes("portable")
  ) {
    return {
      networkName: "Home / TOU",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/90 ring-1 ring-emerald-500/20",
      dotColor: "bg-emerald-500",
      iconType: "home",
    };
  }

  return {
    networkName: "สถานีชาร์จทั่วไป",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200/90 ring-1 ring-indigo-500/20",
    dotColor: "bg-indigo-500",
    iconType: "ev",
  };
}

/**
 * Parse station name and separate branch if stored as "Station (Branch)" or in stationBranch prop
 */
export function parseStationAndBranch(stationName: string = "", stationBranch?: string) {
  let mainName = stationName.trim();
  let branch = (stationBranch || "").trim();

  // If branch not separately defined, check for parenthetical branch notation: e.g. "EV Station PluZ (บางนา)"
  if (!branch && mainName.includes("(") && mainName.endsWith(")")) {
    const match = mainName.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      mainName = match[1].trim();
      branch = match[2].trim();
    }
  }

  return { mainName, branch };
}

/**
 * Component to render a clean, color-coded Station & Branch badge cell
 */
export function StationBadgeCell({
  stationName,
  stationBranch,
  logType,
}: {
  stationName: string;
  stationBranch?: string;
  logType: VehicleType;
}) {
  const badgeInfo = getStationBadgeInfo(stationName, logType);
  const { mainName, branch } = parseStationAndBranch(stationName, stationBranch);

  // Check if mainName is already exactly the network name or if it's a specific custom location
  const isGenericNetworkName =
    mainName.toLowerCase() === badgeInfo.networkName.toLowerCase() ||
    mainName.toLowerCase().startsWith("ev station") ||
    mainName.toLowerCase().startsWith("pea volta") ||
    mainName.toLowerCase().startsWith("mea ev") ||
    mainName.toLowerCase().startsWith("elexa");

  return (
    <div className="flex flex-col gap-1 max-w-[220px]">
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Network / Brand Pill Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs ${badgeInfo.badgeClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badgeInfo.dotColor}`} />
          <span>{badgeInfo.networkName}</span>
        </span>
      </div>

      {/* Specific Location / Branch Name */}
      {branch ? (
        <div className="flex items-center gap-1 text-slate-700 font-medium text-xs truncate">
          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate font-semibold" title={branch}>
            สาขา {branch}
          </span>
        </div>
      ) : !isGenericNetworkName && mainName ? (
        <div className="flex items-center gap-1 text-slate-600 text-xs truncate">
          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate" title={mainName}>
            {mainName}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Component to render color-coded Energy Type & Charger Badge
 */
export function EnergyTypeBadgeCell({ log }: { log: EnergyLog }) {
  if (log.type === "ICE") {
    const fuel = log.fuelType || "น้ำมัน";
    let style = "bg-amber-50 text-amber-800 border-amber-200/90";
    if (fuel.includes("95") && !fuel.includes("Gasohol") && !fuel.includes("E")) {
      style = "bg-rose-50 text-rose-800 border-rose-200/90";
    } else if (fuel.includes("91")) {
      style = "bg-emerald-50 text-emerald-800 border-emerald-200/90";
    } else if (fuel.includes("E20")) {
      style = "bg-teal-50 text-teal-800 border-teal-200/90";
    } else if (fuel.includes("E85")) {
      style = "bg-purple-50 text-purple-800 border-purple-200/90";
    } else if (fuel.toLowerCase().includes("diesel") || fuel.includes("ดีเซล")) {
      style = "bg-blue-50 text-blue-800 border-blue-200/90";
    }

    return (
      <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 border shadow-2xs ${style}`}>
        <Droplet className="w-2.5 h-2.5 shrink-0" />
        <span>{fuel}</span>
      </span>
    );
  }

  // EV
  const charger = log.chargerType || "DC Fast Charge";
  const lower = charger.toLowerCase();

  // DC Fast Charge
  if (lower.includes("dc") || lower.includes("fast") || lower.includes("เร็ว")) {
    return (
      <span className="px-2.5 py-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-lg font-black text-[10px] inline-flex items-center gap-1 shadow-2xs tracking-wide">
        <Zap className="w-2.5 h-2.5 fill-amber-200 text-amber-200 shrink-0 animate-pulse" />
        <span>⚡ DC Fast Charge</span>
      </span>
    );
  }

  // AC Normal Charge
  if (lower.includes("ac") || lower.includes("normal") || lower.includes("ธรรมดา") || lower.includes("type 2")) {
    return (
      <span className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200/90 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
        <Plug className="w-2.5 h-2.5 text-sky-600 shrink-0" />
        <span>🔌 AC Normal</span>
      </span>
    );
  }

  // Home Charger / TOU / Wallbox
  if (lower.includes("home") || lower.includes("บ้าน") || lower.includes("wallbox") || lower.includes("tou")) {
    return (
      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/90 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
        <Home className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
        <span>🏠 Home Charger</span>
      </span>
    );
  }

  // Emergency / Portable
  if (lower.includes("emergency") || lower.includes("portable") || lower.includes("พกพา")) {
    return (
      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200/90 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
        <Zap className="w-2.5 h-2.5 text-slate-500 shrink-0" />
        <span>สายชาร์จพกพา</span>
      </span>
    );
  }

  return (
    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/90 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
      <Zap className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
      <span>{charger}</span>
    </span>
  );
}
