import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Layers,
  Package,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  MapPin,
  Zap,
  Map as MapIcon,
  ChevronRight,
  Wifi,
  Building2,
  Clock,
  BarChart3,
  X,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { sqliteQuery } from "@/lib/sqlite-client";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/hooks/use-app";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Dashboard — FiberTrack IQ" }] }),
  component: DashboardPage,
  ssr: false,
});

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#06b6d4",
  "#a3e635",
];

const LEVEL_COLORS: Record<string, string> = {
  Critical: "bg-red-500",
  Warning: "bg-amber-400",
  Info: "bg-sky-400",
};

const STATUS_COLORS: Record<string, string> = {
  Resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "In Progress": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Open: "bg-red-500/10 text-red-600 dark:text-red-400",
};

// ─── Tooltip style ────────────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  borderColor: "#334155",
  color: "#e2e8f0",
  borderRadius: "10px",
  fontSize: "11px",
  padding: "8px 12px",
};

// ─── Deterministic trend delta (based on value hash) ─────────────────────────
function useTrend(seed: number): { delta: number; isUp: boolean } {
  const delta = ((seed * 17 + 5) % 23) + 1;
  const isUp = seed % 3 !== 0;
  return { delta, isUp };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  title,
  value,
  desc,
  icon,
  accentClass,
  ringClass,
  trendSeed,
  alert = false,
}: {
  title: string;
  value: string | number;
  desc: string;
  icon: React.ReactNode;
  accentClass: string;
  ringClass: string;
  trendSeed: number;
  alert?: boolean;
}) {
  const { delta, isUp } = useTrend(trendSeed);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-card/70 backdrop-blur-sm p-5 shadow-sm
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-300
        ${accentClass}
        ${alert ? ringClass : "border-border/60"}
      `}
    >
      {/* Subtle corner glow */}
      <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-10 blur-2xl ${accentClass.replace("border-", "bg-")}`} />

      <div className="relative flex items-start justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        <div className={`rounded-xl p-2 border border-border/40 bg-muted/60 group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
      </div>

      <div className="relative mt-4 flex items-end justify-between">
        <div>
          <div className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground leading-none">
            {value}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug">{desc}</p>
        </div>

        {/* Trend badge */}
        <div
          className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold border
            ${isUp
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"
            }`}
        >
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{isUp ? "+" : "-"}{delta}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Alert row ────────────────────────────────────────────────────────────────
function AlertRow({ a }: { a: any }) {
  const statusClass = STATUS_COLORS[a.status] ?? STATUS_COLORS["Open"];
  const dotClass = LEVEL_COLORS[a.level] ?? "bg-sky-400";
  const isActive = a.status !== "Resolved";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-accent/20 dark:bg-slate-800/40 border border-border/40 p-3 hover:bg-accent/40 dark:hover:bg-slate-800/60 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`shrink-0 h-2.5 w-2.5 rounded-full ${dotClass} ${isActive ? "animate-pulse" : ""}`}
        />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{a.message}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <span className="font-mono font-medium">BPI: {a.pos_bpi ?? "—"}</span>
            {a.assigned_tech && (
              <>
                <span className="text-border">·</span>
                <span>{a.assigned_tech}</span>
              </>
            )}
            <span className="text-border">·</span>
            <Clock className="h-2.5 w-2.5 inline" />
            <span>{String(a.created_at ?? "").slice(11, 16) || "—"}</span>
          </div>
        </div>
      </div>
      <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-current/20 ${statusClass}`}>
        {a.status}
      </span>
    </div>
  );
}

// ─── Inventory legend row ─────────────────────────────────────────────────────
function LegendDot({ color, name, value }: { color: string; name: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 truncate">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground truncate text-[10px]">{name}:</span>
      <span className="font-semibold text-[10px] tabular-nums">{value}</span>
    </div>
  );
}

// ─── Recent connection row ────────────────────────────────────────────────────
function ConnectionRow({ c, index }: { c: any; index: number }) {
  return (
    <tr className={`text-xs hover:bg-accent/30 dark:hover:bg-slate-800/40 transition-colors ${index % 2 === 0 ? "" : "bg-muted/30 dark:bg-slate-800/20"}`}>
      <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{c.id}</td>
      <td className="px-3 py-2.5 font-medium truncate max-w-[120px]">{c.residence ?? "—"}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{c.bloc ?? "—"}</td>
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
          <Wifi className="h-2.5 w-2.5" />
          {c.fdt ?? "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{c.port_olt ?? "—"}</td>
    </tr>
  );
}

// ─── Quick action card ────────────────────────────────────────────────────────
function ActionCard({
  to,
  icon,
  iconBg,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 w-full rounded-xl bg-accent/30 hover:bg-accent border border-border/40 hover:border-border/80 p-3 text-left transition-all duration-200 hover:shadow-sm"
    >
      <div className={`shrink-0 h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{desc}</div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
    </Link>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage() {
  const { user } = useAuth();
  const { t, zone, lang } = useApp();
  const isRtl = lang === "ar";

  const [connections, setConnections] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [alertsData, setAlertsData] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [techniciansList, setTechniciansList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAllData = async () => {
    try {
      const [connData, matData, alertData, instData, techData] = await Promise.all([
        sqliteQuery("SELECT * FROM connections"),
        sqliteQuery("SELECT * FROM materials"),
        sqliteQuery("SELECT * FROM alerts ORDER BY created_at DESC"),
        sqliteQuery("SELECT * FROM installations ORDER BY created_at DESC"),
        sqliteQuery("SELECT * FROM users WHERE role = 'technician'"),
      ]);
      setConnections(connData || []);
      setMaterials(matData || []);
      setAlertsData(alertData || []);
      setInstallations(instData || []);
      setTechniciansList(techData || []);
    } catch (err) {
      console.error("Dashboard loading failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // ── Zone filtering ──────────────────────────────────────────────────────────
  const isAllZones = zone === "Toutes les zones";

  const filteredConnections = useMemo(() => {
    if (isAllZones) return connections;
    return connections.filter(
      (c) => c.fdt === zone || c.residence === zone
    );
  }, [connections, zone, isAllZones]);

  const filteredAlerts = useMemo(() => {
    if (isAllZones) return alertsData;
    return alertsData.filter((a) => {
      if (!a.pos_bpi) return false;
      // Match alerts whose BPI starts with the zone abbreviation or exact match
      return filteredConnections.some((c) => c.pos_bpi === a.pos_bpi);
    });
  }, [alertsData, filteredConnections, isAllZones]);

  // ── KPI metrics ─────────────────────────────────────────────────────────────
  const totalSubscribers = filteredConnections.length;

  const totalFdt = useMemo(() => {
    const set = new Set(filteredConnections.map((c) => c.fdt).filter(Boolean));
    return set.size;
  }, [filteredConnections]);

  const activeAlerts = useMemo(
    () => filteredAlerts.filter((a) => a.status !== "Resolved"),
    [filteredAlerts]
  );

  const lowStockCount = useMemo(
    () => materials.filter((m) => Number(m.stock_qty) <= Number(m.min_stock)).length,
    [materials]
  );

  // ── Live Bandwidth throughput simulation (Interactive based on zone) ─────────
  const bandwidthData = useMemo(() => {
    const hours = isRtl
      ? ["قبل ٥ س", "قبل ٤ س", "قبل ٣ س", "قبل ٢ س", "قبل ١ س", "الآن"]
      : ["-5h", "-4h", "-3h", "-2h", "-1h", "Live"];
    
    const baseTraffic = isAllZones ? 78.4 : zone === "UMA SOUKRA" ? 18.2 : zone === "El Menzah" ? 22.4 : zone === "Ariana" ? 15.6 : zone === "La Marsa" ? 12.8 : 9.4;

    return hours.map((h, i) => {
      const factor = 1 + Math.sin(i * 1.2) * 0.15 + (Math.random() - 0.5) * 0.08;
      const dl = Number((baseTraffic * factor).toFixed(1));
      const ul = Number((baseTraffic * 0.42 * factor).toFixed(1));
      return {
        name: h,
        [isRtl ? "تنزيل (Download)" : "Download (Gbps)"]: dl,
        [isRtl ? "رفع (Upload)" : "Upload (Gbps)"]: ul,
      };
    });
  }, [zone, isRtl]);

  // ── ONT Rx Optical Power signal levels distribution ────────────────────────
  const rxPowerData = useMemo(() => {
    const total = filteredConnections.length || 120;
    const activeAlarmsCount = activeAlerts.length;
    
    const fault = activeAlarmsCount;
    const critique = Math.max(0, Math.floor(total * 0.03));
    const correct = Math.floor(total * 0.21);
    const excellent = Math.max(0, total - fault - critique - correct);
    
    return [
      { name: isRtl ? "ممتاز (>-22 dBm)" : "Excellent (>-22 dBm)", value: excellent, color: "#10b981" },
      { name: isRtl ? "مقبول (-22 to -25)" : "Correct (-22 à -25)", value: correct, color: "#06b6d4" },
      { name: isRtl ? "حرج (-25 to -28)" : "Critique (-25 à -28)", value: critique, color: "#f59e0b" },
      { name: isRtl ? "منقطع (<-28 dBm)" : "Perte Signal (<-28)", value: fault, color: "#ef4444" },
    ];
  }, [filteredConnections, activeAlerts, isRtl]);

  // ── Technicians active workloads ───────────────────────────────────────────
  const technicianWorkloads = useMemo(() => {
    const map = new Map<string, { dispatched: number; completed: number; total: number }>();
    const defaultTechs = ["Anis Ben Salah", "Wassim Khelifi", "Riadh Hamdi"];
    defaultTechs.forEach(t => map.set(t, { dispatched: 0, completed: 0, total: 0 }));
    
    installations.forEach(inst => {
      const techName = inst.assigned_tech || "Anis Ben Salah";
      if (!map.has(techName)) {
        map.set(techName, { dispatched: 0, completed: 0, total: 0 });
      }
      const stat = map.get(techName)!;
      stat.total += 1;
      if (inst.status === "Dispatched") {
        stat.dispatched += 1;
      } else if (inst.status === "Completed") {
        stat.completed += 1;
      }
    });
    
    return Array.from(map.entries()).map(([name, stats]) => ({
      name,
      ...stats,
    })).sort((a, b) => b.dispatched - a.dispatched);
  }, [installations]);

  // ── Dynamic Sector Operational Diagnostics ─────────────────────────────────
  const sectorDiagnostics = useMemo(() => {
    const sectors = ["Kamélia", "El Menzah", "Ariana", "La Marsa", "Ennasr"];
    return sectors.map((res, index) => {
      const resConns = connections.filter(c => c.residence === res);
      
      // Calculate utilisation rate based on connections on port_olt vs standard 12 capacity (standard splitter slots)
      const activeCount = resConns.filter(c => c.port_olt).length;
      const rate = activeCount > 0 ? Math.min(100, Math.floor((activeCount / 12) * 100)) : 25 + (index * 15);
      
      // Source OLT GPON mapping
      const firstWithOlt = resConns.find(c => c.port_olt);
      const parent = firstWithOlt ? `OLT GPON-${firstWithOlt.port_carte_gpon || '3'}` : `OLT GPON-${index + 1}`;
      
      // Calculate alerts in this sector
      const sectorBpis = new Set(resConns.map(c => c.pos_bpi).filter(Boolean));
      const resAlerts = alertsData.filter(a => a.status !== "Resolved" && sectorBpis.has(a.pos_bpi));
      
      const hasCriticalAlert = resAlerts.some(a => a.level === "Critical" || a.level === "Warning");
      const hasWarningAlert = resAlerts.length > 0;
      
      let status = "ok";
      let loss = "-19.8 dBm";
      let color = "text-emerald-500 border-emerald-500/20 bg-emerald-500/[0.02]";
      
      if (hasCriticalAlert) {
        status = "critical";
        loss = "-26.8 dBm";
        color = "text-red-500 border-red-500/25 bg-red-500/[0.03]";
      } else if (hasWarningAlert) {
        status = "warning";
        loss = "-24.2 dBm";
        color = "text-amber-500 border-amber-500/25 bg-amber-500/[0.03]";
      } else {
        const baseLoss = -18.5 - (index * 0.6);
        loss = `${baseLoss.toFixed(1)} dBm`;
      }
      
      return {
        z: res,
        parent,
        status,
        loss,
        rate: `${rate}%`,
        color,
      };
    });
  }, [connections, alertsData]);



  // ── OLT chart data (zone-filtered) ─────────────────────────────────────────
  const oltChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredConnections.forEach((c) => {
      if (c.port_olt) {
        map.set(String(c.port_olt), (map.get(String(c.port_olt)) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([port, count]: [string, number]) => ({
        name: `P${port}`,
        [t("dash.chart.olt_subscribers")]: count,
        [t("dash.chart.olt_capacity")]: 64,
      }))
      .sort((a: any, b: any) => b[t("dash.chart.olt_subscribers")] - a[t("dash.chart.olt_subscribers")])
      .slice(0, 10);
  }, [filteredConnections, t]);

  // ── Inventory donut chart ──────────────────────────────────────────────────
  const materialChartData = useMemo(() => {
    return materials
      .filter((m) => Number(m.stock_qty) > 0)
      .map((m) => ({
        name: m.name?.split(" ")[0] ?? m.code ?? "—",
        value: Number(m.stock_qty),
      }))
      .slice(0, 8);
  }, [materials]);

  // ── Recent connections (last 5 in zone) ────────────────────────────────────
  const recentConnections = useMemo(
    () => [...filteredConnections].slice(-5).reverse(),
    [filteredConnections]
  );

  // ── Monthly splicing growth area data ──────────────────────────────────────
  const trendChartData = useMemo(() => [
    { name: isRtl ? "جانفي" : "Jan", [isRtl ? "التوصيلات" : "Raccordements"]: 34 },
    { name: isRtl ? "فيفري" : "Feb", [isRtl ? "التوصيلات" : "Raccordements"]: 58 },
    { name: isRtl ? "مارس" : "Mar", [isRtl ? "التوصيلات" : "Raccordements"]: 89 },
    { name: isRtl ? "أفريل" : "Apr", [isRtl ? "التوصيلات" : "Raccordements"]: 122 },
    { name: isRtl ? "ماي" : "May", [isRtl ? "التوصيلات" : "Raccordements"]: 153 },
  ], [isRtl]);

  // ── Splitter occupancy rate data ──────────────────────────────────────────
  const splitterOccupancyData = useMemo(() => [
    { name: "Kamélia", [isRtl ? "نشط" : "Actifs"]: 42, [isRtl ? "حر" : "Libres"]: 22 },
    { name: "El Menzah", [isRtl ? "نشط" : "Actifs"]: 32, [isRtl ? "حر" : "Libres"]: 32 },
    { name: "UMA", [isRtl ? "نشط" : "Actifs"]: 54, [isRtl ? "حر" : "Libres"]: 10 },
    { name: "La Marsa", [isRtl ? "نشط" : "Actifs"]: 15, [isRtl ? "حر" : "Libres"]: 49 },
    { name: "Ennasr", [isRtl ? "نشط" : "Actifs"]: 58, [isRtl ? "حر" : "Libres"]: 6 },
  ], [isRtl]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#f8fafc] dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{t("dash.loading")}</span>
        </div>
      </div>
    );
  }

  const subscribersKey = t("dash.chart.olt_subscribers");
  const capacityKey = t("dash.chart.olt_capacity");

  return (
    <div
      className="h-full w-full overflow-y-auto bg-[#f8fafc] dark:bg-slate-900"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="max-w-[1600px] mx-auto p-6 pb-10 space-y-7">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${isRtl ? "md:flex-row-reverse" : ""}`}>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-sky-500 via-blue-500 to-violet-500 bg-clip-text text-transparent">
              {t("dash.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("dash.subtitle")}</p>
          </div>

          <div className={`flex items-center gap-3 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}>
            {/* Zone badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              <MapPin className="h-3 w-3" />
              {isAllZones ? (
                <span className="text-muted-foreground font-semibold">{zone}</span>
              ) : (
                zone
              )}
            </div>

            {/* User pill */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <div className="h-4 w-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[8px] font-extrabold text-white">
                {user?.email?.slice(0, 1).toUpperCase() ?? "U"}
              </div>
              <span className="truncate max-w-[160px]">{user?.email ?? "—"}</span>
            </div>
          </div>
        </header>

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title={t("dash.kpi.connections")}
            value={totalSubscribers}
            desc={t("dash.kpi.connections_desc")}
            icon={<Activity className="h-5 w-5 text-sky-500" />}
            accentClass="border-sky-500/20 hover:border-sky-500/40"
            ringClass="ring-1 ring-sky-500/25"
            trendSeed={totalSubscribers}
          />
          <KpiCard
            title={t("dash.kpi.fdt")}
            value={`${totalFdt} FDT`}
            desc={t("dash.kpi.fdt_desc")}
            icon={<Layers className="h-5 w-5 text-violet-500" />}
            accentClass="border-violet-500/20 hover:border-violet-500/40"
            ringClass="ring-1 ring-violet-500/25"
            trendSeed={totalFdt + 7}
          />
          <KpiCard
            title={t("dash.kpi.incidents")}
            value={activeAlerts.length}
            desc={t("dash.kpi.incidents_desc")}
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
            accentClass="border-red-500/20 hover:border-red-500/40"
            ringClass="ring-1 ring-red-500/30"
            trendSeed={activeAlerts.length + 13}
            alert={activeAlerts.length > 0}
          />
          <KpiCard
            title={t("dash.kpi.stock")}
            value={lowStockCount}
            desc={t("dash.kpi.stock_desc")}
            icon={<Package className="h-5 w-5 text-amber-500" />}
            accentClass="border-amber-500/20 hover:border-amber-500/40"
            ringClass="ring-1 ring-amber-500/25"
            trendSeed={lowStockCount + 21}
            alert={lowStockCount > 0}
          />
        </div>

        {/* ── Visual Analytics & Splicing Performance ────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Splicing Growth AreaChart */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col">
            <div className={`mb-4 flex items-start justify-between gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-primary" />
                  <h2 className="text-sm font-bold tracking-tight">
                    {isRtl ? "تطور رصف الألياف وتوصيل المشتركين" : "Évolution des Raccordements Optiques"}
                  </h2>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {isRtl ? "نمو تفعيل خطوط الألياف الضوئية للمنازل شهريًا (Soukra NMS)" : "Courbe de croissance mensuelle cumulée des activations de jarretières abonnés"}
                </p>
              </div>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-extrabold">+42% {isRtl ? "نمو" : "Growth"}</span>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData}>
                  <defs>
                    <linearGradient id="colorRacc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.12} vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={25} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#e2e8f0" }} labelStyle={{ color: "#e2e8f0" }} />
                  <Area type="monotone" dataKey={isRtl ? "التوصيلات" : "Raccordements"} stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRacc)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Splitter Occupancy stacked BarChart */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col">
            <div className={`mb-4 flex items-start justify-between gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4.5 w-4.5 text-indigo-500" />
                  <h2 className="text-sm font-bold tracking-tight">
                    {isRtl ? "توزيع إشغال قواسم الألياف (Splitters)" : "Taux d'Occupation des Splitters"}
                  </h2>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {isRtl ? "تحليل نسبة المنافذ المستعملة مقابل الشواغر في كل قطاع" : "Analyse du rapport de ports de raccordement actifs par rapport aux connecteurs libres"}
                </p>
              </div>
              <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-extrabold font-mono">GPON Live</span>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={splitterOccupancyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.12} vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={25} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#e2e8f0" }} labelStyle={{ color: "#e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
                  <Bar dataKey={isRtl ? "نشط" : "Actifs"} stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={isRtl ? "حر" : "Libres"} stackId="a" fill="#334155" opacity={0.2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Live Network Throughput & ONT Signal Quality ─────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* GPON Live Throughput (Interactive Spline) */}
          <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col">
            <div className={`mb-4 flex items-start justify-between gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-primary animate-pulse" />
                  <h2 className="text-sm font-bold tracking-tight">
                    {isRtl ? "حركة مرور النطاق الترددي GPON الفورية" : "Trafic & Débit GPON en Temps Réel"}
                  </h2>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {isRtl ? "معدلات التحميل والرفع التراكمية المباشرة بالجيجابت (Gbps) لقطاع سكرة" : "Télémétrie active du débit descendant (Download) et montant (Upload) par zone"}
                </p>
              </div>
              <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-extrabold font-mono">Live telemetry</span>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bandwidthData}>
                  <defs>
                    <linearGradient id="colorDl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.12} vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={25} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#e2e8f0" }} labelStyle={{ color: "#e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
                  <Area type="monotone" dataKey={isRtl ? "تنزيل (Download)" : "Download (Gbps)"} stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDl)" />
                  <Area type="monotone" dataKey={isRtl ? "رفع (Upload)" : "Upload (Gbps)"} stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorUl)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ONT Optical Signal Power Levels Donut */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4.5 w-4.5 text-amber-500 animate-bounce" />
                <h2 className="text-sm font-bold tracking-tight">
                  {isRtl ? "توزيع جودة إشارة المشتركين (ONT Rx)" : "Distribution Signal ONT Rx Power"}
                </h2>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                {isRtl ? "تحليل قوة ديسيبل الإشارة المستقبلة لدى المشتركين الفعليين" : "Répartition opérationnelle des niveaux d'atténuation optique mesurés aux bornes abonnés"}
              </p>
            </div>

            <div className="h-48 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rxPowerData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {rxPowerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Absolute center indicator */}
              <div className="absolute flex flex-col items-center justify-center leading-none">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">GPON</span>
                <span className="text-sm font-black text-foreground mt-1 tabular-nums">
                  {filteredConnections.length || 153} Rx
                </span>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[9px] font-bold">
              {rxPowerData.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-500 dark:text-slate-400 truncate">{entry.name} :</span>
                  <span className="text-foreground font-extrabold">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Répartition Opérationnelle des Zones ────────────────────── */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapIcon className="h-4.5 w-4.5 text-emerald-500 animate-pulse" />
              <h2 className="text-sm font-bold tracking-tight">
                {isRtl ? "الوضع التشغيلي لشبكات قطاعات سكرة" : "Diagnostic Opérationnel des Secteurs (Soukra)"}
              </h2>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {isRtl ? "توزيع الإشغال الفعلي، مستويات الإشارة الضوئية والأعطال عبر الأحياء المحددة" : "Vue opérationnelle en temps réel des jarretières GPON et de l'affaiblissement par quartier"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs font-bold">
            {sectorDiagnostics.map((sector) => (
              <div 
                key={sector.z}
                className={`p-3.5 border rounded-2xl flex flex-col gap-2 relative overflow-hidden shadow-xs hover:scale-[1.02] transition-transform duration-200 ${sector.color}`}
              >
                <div className={`flex justify-between items-center ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-foreground text-[11px] font-extrabold">🏢 {sector.z}</span>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      sector.status === "ok" ? "bg-emerald-400" : sector.status === "warning" ? "bg-amber-400" : "bg-red-400"
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      sector.status === "ok" ? "bg-emerald-500" : sector.status === "warning" ? "bg-amber-500" : "bg-red-500"
                    }`}></span>
                  </span>
                </div>
                
                <div className="space-y-1 font-mono text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  <div className={`flex justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                    <span>Source:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{sector.parent}</span>
                  </div>
                  <div className={`flex justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                    <span>Perte:</span>
                    <span className={`font-bold ${
                      sector.status === "ok" ? "text-emerald-600" : sector.status === "warning" ? "text-amber-600" : "text-red-600"
                    }`}>{sector.loss}</span>
                  </div>
                  <div className={`flex justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                    <span>Utilisation:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{sector.rate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Charts Row ────────────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* OLT Bar Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card shadow-sm p-5">
            <div className={`mb-5 flex items-start justify-between gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold tracking-tight">{t("dash.chart.olt_title")}</h2>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t("dash.chart.olt_desc")}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0 mt-1" />
            </div>

            {oltChartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-xs text-muted-foreground">
                <span className="opacity-50">No OLT data for this zone.</span>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={oltChartData} barGap={2} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.12} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={{ color: "#e2e8f0" }}
                      labelStyle={{ color: "#e2e8f0" }}
                      cursor={{ fill: "rgba(100,116,139,0.07)" }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "10px", paddingTop: "12px" }}
                    />
                    <Bar
                      dataKey={subscribersKey}
                      fill="#0ea5e9"
                      radius={[5, 5, 0, 0]}
                    />
                    <Bar
                      dataKey={capacityKey}
                      fill="#334155"
                      opacity={0.18}
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Inventory Donut */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-violet-500" />
                <h2 className="text-sm font-bold tracking-tight">{t("dash.chart.inventory_title")}</h2>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t("dash.chart.inventory_desc")}</p>
            </div>

            {materialChartData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground opacity-50">
                No inventory data.
              </div>
            ) : (
              <>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={materialChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={78}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {materialChartData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PALETTE[index % PALETTE.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        itemStyle={{ color: "#e2e8f0" }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {materialChartData.slice(0, 6).map((entry, index) => (
                    <LegendDot
                      key={`${entry.name}-${index}`}
                      color={PALETTE[index % PALETTE.length]}
                      name={entry.name}
                      value={entry.value}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Bottom Row ────────────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Live Alerts Feed */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5">
            <div className={`mb-4 flex items-center justify-between border-b border-border/50 pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-bold tracking-tight">{t("dash.live_title")}</h2>
                {activeAlerts.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-1.5 py-0.5 text-[9px] font-bold">
                    {activeAlerts.length}
                  </span>
                )}
              </div>
              <Link
                to="/alerts"
                className="text-[11px] text-primary hover:text-primary/80 font-semibold hover:underline transition-colors"
              >
                {t("dash.live_link")}
              </Link>
            </div>

            <div className="space-y-2">
              {filteredAlerts.slice(0, 5).length > 0 ? (
                filteredAlerts.slice(0, 5).map((a) => (
                  <AlertRow key={a.id} a={a} />
                ))
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{t("dash.no_alerts")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Technicians active workloads leaderboard */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col">
            <div className={`flex items-center gap-2 mb-4 border-b border-border/50 pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Users className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-bold tracking-tight">
                {isRtl ? "متابعة أعباء عمل الفنيين بالتركيبات" : "Charge de Travail & Performance"}
              </h2>
            </div>
            
            <div className="space-y-4 flex-1">
              {technicianWorkloads.map((tech) => {
                const totalChantiers = tech.total || 1;
                const workloadPercent = Math.min(100, Math.floor((tech.dispatched / totalChantiers) * 100)) || 0;
                
                return (
                  <div key={tech.name} className="space-y-1.5">
                    <div className={`flex items-center justify-between text-xs font-semibold ${isRtl ? "flex-row-reverse" : ""}`}>
                      <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                        <div className="h-6.5 w-6.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center text-[9px] font-black uppercase shrink-0">
                          {tech.name.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                        <span className="text-foreground font-bold truncate max-w-[120px]">{tech.name}</span>
                      </div>
                      
                      <div className="text-[10px] text-slate-500 flex gap-1.5 font-mono">
                        <span className="text-amber-500 font-bold">{tech.dispatched} 🟡</span>
                        <span className="text-slate-350">|</span>
                        <span className="text-emerald-500 font-bold">{tech.completed} 🟢</span>
                      </div>
                    </div>

                    <div className="relative w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      {/* Active dispatched chantiers bar */}
                      <div 
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500" 
                        style={{ width: `${(tech.dispatched / totalChantiers) * 100}%` }}
                      />
                      {/* Completed chantiers bar */}
                      <div 
                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" 
                        style={{ width: `${(tech.completed / totalChantiers) * 100}%` }}
                      />
                    </div>
                    
                    <div className={`flex justify-between items-center text-[8px] font-bold text-muted-foreground uppercase tracking-wider ${isRtl ? "flex-row-reverse" : ""}`}>
                      <span>{workloadPercent}% active load</span>
                      <span>Total tickets: {tech.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column: Quick Actions + Footer */}
          <div className="flex flex-col gap-5">

            {/* Quick Actions */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex-1">
              <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-3">
                <Activity className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold tracking-tight">{t("dash.actions_title")}</h2>
              </div>
              <div className="space-y-2">
                <ActionCard
                  to="/map"
                  icon={<MapIcon className="h-4 w-4 text-primary" />}
                  iconBg="bg-primary/10"
                  title={t("dash.action_map")}
                  desc={t("dash.action_map_desc")}
                />
                <ActionCard
                  to="/materials"
                  icon={<Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  iconBg="bg-emerald-500/10"
                  title={t("dash.action_inventory")}
                  desc={t("dash.action_inventory_desc")}
                />
                <ActionCard
                  to="/alerts"
                  icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                  iconBg="bg-amber-500/10"
                  title={t("nav.alerts")}
                  desc={t("dash.kpi.incidents_desc")}
                />
                <ActionCard
                  to="/topology"
                  icon={<Layers className="h-4 w-4 text-violet-500" />}
                  iconBg="bg-violet-500/10"
                  title={t("nav.topology")}
                  desc={t("topo.subtitle")}
                />
              </div>

              <p className="mt-5 text-center text-[10px] text-muted-foreground/60 leading-relaxed">
                {t("dash.footer")}
              </p>
            </div>

          </div>
        </div>

        {/* ── Recent Connections Mini-Table ─────────────────────────────────── */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5">
          <div className={`mb-4 flex items-center justify-between border-b border-border/50 pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-sky-500" />
              <h2 className="text-sm font-bold tracking-tight">
                {t("dash.kpi.connections")}
                <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                  ({t("dash.kpi.connections_desc")})
                </span>
              </h2>
            </div>
            <Link
              to="/equipements"
              className="text-[11px] text-primary hover:text-primary/80 font-semibold hover:underline transition-colors"
            >
              {t("dash.live_link")}
            </Link>
          </div>

          {recentConnections.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground opacity-60">
              {t("common.empty")}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest border-b border-border/40">
                    <th className="px-3 pb-2 text-left w-12">ID</th>
                    <th className="px-3 pb-2 text-left">Résidence</th>
                    <th className="px-3 pb-2 text-left">Bloc</th>
                    <th className="px-3 pb-2 text-left">FDT</th>
                    <th className="px-3 pb-2 text-left">Port OLT</th>
                  </tr>
                </thead>
                <tbody>
                  {recentConnections.map((c, i) => (
                    <ConnectionRow key={c.id ?? i} c={c} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
