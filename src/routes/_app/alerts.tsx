import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  UserCheck,
  Plus,
  X,
  Search,
  Download,
  ShieldAlert,
  Info,
  ChevronLeft,
  ChevronRight,
  Activity,
  BarChart3,
} from "lucide-react";
import { sqliteQuery, sqliteExecute } from "@/lib/sqlite-client";
import { technicians } from "@/lib/mock-network";
import { useApp } from "@/hooks/use-app";
import { ZONES } from "@/hooks/use-app";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/alerts")({
  head: () => ({ meta: [{ title: "Alertes Réseau — FiberTrack IQ" }] }),
  component: AlertsSupervisionPage,
  ssr: false,
});

// ─── Types ─────────────────────────────────────────────────────────────────────
type AlertLevel = "Critical" | "Warning" | "Info";
type AlertStatus = "Open" | "In Progress" | "Resolved";
type StatusFilter = "All" | "Open" | "In Progress" | "Resolved";
type LevelFilter = "All" | "Critical" | "Warning" | "Info";

interface Alert {
  id: number;
  message: string;
  level: AlertLevel;
  pos_bpi: string | null;
  status: AlertStatus;
  assigned_tech: string | null;
  created_at: string;
}

interface Connection {
  id: number;
  pos_bpi: string | null;
  fdt: string | null;
  [key: string]: any;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return "N/A";
  return iso.replace("T", " ").slice(0, 16);
}

function exportToCSV(alerts: Alert[], filename = "alerts_export.csv") {
  const headers = ["ID", "Sévérité", "Message", "Équipement (BPI)", "Statut", "Technicien", "Créé le"];
  const rows = alerts.map((a) => [
    a.id,
    a.level,
    `"${a.message.replace(/"/g, '""')}"`,
    a.pos_bpi || "N/A",
    a.status,
    a.assigned_tech || "—",
    formatDate(a.created_at),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── OTDR Trace Component ──────────────────────────────────────────────────────
function OTDRTraceModal({ alertItem, onClose, t }: { alertItem: Alert; onClose: () => void; t: (k: string) => string }) {
  const bpiCode = alertItem.pos_bpi || "BPI-A4";
  const lastDigitStr = bpiCode.replace(/\D/g, "");
  const lastDigit = parseInt(lastDigitStr) || 4;
  const breakDistance = lastDigit * 120 + 80;
  const isResolved = alertItem.status === "Resolved";

  // Dynamic states for interactive simulation
  const [liveBreakDistance, setLiveBreakDistance] = useState(breakDistance);
  const [connLoss, setConnLoss] = useState(1.2);
  const [spliceLoss, setSpliceLoss] = useState(0.6);
  const [macrobendLoss, setMacrobendLoss] = useState(0.4);
  const [fiberLossPerKm, setFiberLossPerKm] = useState(0.24); // dB/km

  const width = 500;
  const height = 220;
  const totalDistance = 1200;

  // Compute dynamic X mapping on the SVG canvas
  const connX = (150 / totalDistance) * width;
  const splitX = (350 / totalDistance) * width;
  const spliceX = (650 / totalDistance) * width;
  const breakX = (liveBreakDistance / totalDistance) * width;

  // Calculate dynamic losses at each stage
  const lengthKm = (isResolved ? totalDistance : liveBreakDistance) / 1000;
  const cumulativeFiberLoss = lengthKm * fiberLossPerKm;
  const splitterStepLoss = 10.5; // Constant standard 1:8 splitter loss in dB
  
  const totalDbLoss = connLoss + splitterStepLoss + spliceLoss + macrobendLoss + cumulativeFiberLoss;

  // Dynamically map dB losses to SVG Y coordinates (e.g. 1 dB = 3px vertical drop)
  // Base power level is at Y = 40 (0 dB loss)
  const getY = (lossDb: number) => Math.min(height - 30, 40 + lossDb * 6);

  const points: [number, number][] = [[0, 40]];

  // 1. Connector loss
  const yAfterConn = getY(connLoss);
  points.push([connX - 2, 40 + (connX / width) * 5]);
  points.push([connX, yAfterConn - 10]); // reflection spike
  points.push([connX + 2, yAfterConn]);

  // 2. Splitter loss
  const yAfterSplit = getY(connLoss + splitterStepLoss);
  const slopeToSplit = (splitX - connX) * 0.01;
  points.push([splitX - 2, yAfterConn + slopeToSplit]);
  points.push([splitX, yAfterSplit]);

  // 3. Splice loss
  const currentLossAtSplice = connLoss + splitterStepLoss + (spliceX / width) * 3;
  const yAfterSplice = getY(currentLossAtSplice + spliceLoss);
  points.push([spliceX - 2, getY(currentLossAtSplice)]);
  points.push([spliceX, yAfterSplice - 5]); // slight fusion spike
  points.push([spliceX + 2, yAfterSplice]);

  // 4. Macrobend loss
  const bendX = (900 / totalDistance) * width;
  const currentLossAtBend = currentLossAtSplice + spliceLoss + ((bendX - spliceX) / width) * 3;
  const yAfterBend = getY(currentLossAtBend + macrobendLoss);
  
  if (isResolved || liveBreakDistance > 900) {
    points.push([bendX - 2, getY(currentLossAtBend)]);
    points.push([bendX, yAfterBend]);
  }

  // 5. Final section: Nominal line OR physical fiber rupture cut drop
  let lossAtBreak = 0;
  if (isResolved) {
    points.push([width, getY(totalDbLoss)]);
  } else {
    lossAtBreak = connLoss + splitterStepLoss + spliceLoss + (liveBreakDistance > 900 ? macrobendLoss : 0) + (liveBreakDistance / 1000) * fiberLossPerKm;
    const yAtBreak = getY(lossAtBreak);
    
    points.push([breakX - 3, yAtBreak]);
    points.push([breakX, getY(lossAtBreak) - 15]); // giant backscatter reflection spike
    points.push([breakX + 2, height - 30]); // absolute floor cutoff
    points.push([width, height - 30]);
  }

  const pathD = "M " + points.map((p) => `${p[0]} ${p[1]}`).join(" L ");

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-xs uppercase text-foreground tracking-wide flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-indigo-500" />
              {t("alerts.otdr_title")} [Injecteur de Pertes Interactif]
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Simulateur de signal réflectométrique en direct sur la liaison{" "}
              <span className="font-bold text-primary">{bpiCode}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dynamic simulator variables grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-border">
          {!isResolved && (
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Rupture (Distance)</label>
              <input 
                type="range" 
                min={180} 
                max={1100} 
                step={10}
                value={liveBreakDistance} 
                onChange={(e) => setLiveBreakDistance(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-250 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[10px] font-bold font-mono text-indigo-600 block mt-1">{liveBreakDistance} m</span>
            </div>
          )}
          <div>
            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Perte Connecteur</label>
            <input 
              type="range" 
              min={0.1} 
              max={4.0} 
              step={0.1}
              value={connLoss} 
              onChange={(e) => setConnLoss(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-250 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[10px] font-bold font-mono text-slate-700 dark:text-slate-300 block mt-1">{connLoss.toFixed(1)} dB</span>
          </div>
          <div>
            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Perte Épissure</label>
            <input 
              type="range" 
              min={0.05} 
              max={2.5} 
              step={0.05}
              value={spliceLoss} 
              onChange={(e) => setSpliceLoss(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-250 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[10px] font-bold font-mono text-slate-700 dark:text-slate-300 block mt-1">{spliceLoss.toFixed(2)} dB</span>
          </div>
          <div>
            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Macrocourbure</label>
            <input 
              type="range" 
              min={0} 
              max={5.0} 
              step={0.1}
              value={macrobendLoss} 
              onChange={(e) => setMacrobendLoss(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-250 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[10px] font-bold font-mono text-slate-700 dark:text-slate-300 block mt-1">{macrobendLoss.toFixed(1)} dB</span>
          </div>
          <div>
            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Atténuation Linéique</label>
            <input 
              type="range" 
              min={0.15} 
              max={0.45} 
              step={0.01}
              value={fiberLossPerKm} 
              onChange={(e) => setFiberLossPerKm(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-250 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[10px] font-bold font-mono text-slate-700 dark:text-slate-300 block mt-1">{fiberLossPerKm.toFixed(2)} dB/km</span>
          </div>
        </div>

        {/* Dynamic Computed Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-border/80">
            <span className="text-[9px] text-muted-foreground font-semibold block uppercase tracking-wider mb-1">
              {t("alerts.otdr_dist")}
            </span>
            <span className="font-bold text-sm text-foreground tabular-nums font-mono">
              {isResolved ? t("alerts.otdr_nominal") : `${liveBreakDistance} m`}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-border/80">
            <span className="text-[9px] text-muted-foreground font-semibold block uppercase tracking-wider mb-1">
              Atténuation cumulative (dB)
            </span>
            <span className={`font-bold text-sm tabular-nums font-mono ${isResolved ? "text-emerald-600" : "text-red-600"}`}>
              {isResolved ? `${totalDbLoss.toFixed(2)} dB` : `> ${(lossAtBreak + 45).toFixed(1)} dB (Coupe)`}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-border/80">
            <span className="text-[9px] text-muted-foreground font-semibold block uppercase tracking-wider mb-1">
              {t("alerts.otdr_wavelength")}
            </span>
            <span className="font-bold text-sm text-slate-700 dark:text-slate-300 font-mono">1550 nm</span>
          </div>
        </div>

        {/* SVG Trace */}
        <div className="relative rounded-xl border border-border bg-slate-950 p-3 overflow-hidden">
          <div className="absolute top-2 left-3 text-[8px] font-mono text-slate-500 flex gap-4 uppercase font-bold">
            <span>Trace: OTDR-Soukra-{bpiCode}</span>
            <span>Y: Puissance (dB)</span>
            <span>X: Distance (m)</span>
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible mt-3">
            {/* Grid lines */}
            {[40, 80, 120, 160, 190].map((y) => (
              <line key={`hy-${y}`} x1="0" y1={y} x2={width} y2={y} stroke="#fff" strokeOpacity="0.06" strokeDasharray="3 3" />
            ))}
            {[100, 200, 300, 400, 500].map((x) => (
              <line key={`vx-${x}`} x1={x} y1="0" x2={x} y2={height} stroke="#fff" strokeOpacity="0.06" strokeDasharray="3 3" />
            ))}

            {/* Trace path */}
            <path d={pathD} fill="none" stroke={isResolved ? "#10b981" : "#ef4444"} strokeWidth="2.5" className="transition-all duration-300" />

            {/* Splitter marker */}
            <g transform={`translate(${splitX}, ${height - 20})`}>
              <circle r="4" fill="#8b5cf6" />
              <text y="-8" textAnchor="middle" fill="#8b5cf6" fontSize="8" fontFamily="monospace" fontWeight="bold">Splitter</text>
            </g>

            {/* Splice marker */}
            <g transform={`translate(${spliceX}, ${height - 20})`}>
              <circle r="4" fill="#0ea5e9" />
              <text y="-8" textAnchor="middle" fill="#0ea5e9" fontSize="8" fontFamily="monospace" fontWeight="bold">Épissure</text>
            </g>

            {/* Macrobend marker */}
            {(isResolved || liveBreakDistance > 900) && (
              <g transform={`translate(${bendX}, ${height - 20})`}>
                <circle r="4" fill="#f59e0b" />
                <text y="-8" textAnchor="middle" fill="#f59e0b" fontSize="8" fontFamily="monospace" fontWeight="bold">Courbure</text>
              </g>
            )}

            {/* Fault marker */}
            {!isResolved && (
              <g transform={`translate(${breakX}, ${height - 20})`}>
                <line x1="0" y1="-180" x2="0" y2="0" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" />
                <circle r="5" fill="#ef4444" opacity="0.3" className="animate-ping" />
                <circle r="3.5" fill="#ef4444" />
                <text y="-8" textAnchor="middle" fill="#ef4444" fontSize="8" fontFamily="monospace" fontWeight="bold">Rupture</text>
              </g>
            )}

            {/* Axis labels */}
            <text x="5" y="30" fill="#64748b" fontSize="8" fontFamily="monospace">0 dB</text>
            <text x="5" y="190" fill="#64748b" fontSize="8" fontFamily="monospace">-60 dB</text>
            <text x="10" y={height - 5} fill="#64748b" fontSize="8" fontFamily="monospace">0m</text>
            <text x={splitX} y={height - 5} fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">350m</text>
            <text x={spliceX} y={height - 5} fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">650m</text>
            <text x={width - 10} y={height - 5} fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">1200m</text>
          </svg>
        </div>

        {/* Diagnosis */}
        <div className="mt-3.5 bg-accent/40 rounded-xl p-3 border border-border text-[11px] text-muted-foreground leading-relaxed font-medium">
          {isResolved ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              ✓ Liaison optique nominale. Affaiblissement total conforme aux exigences de l'infrastructure SOTETEL (&lt; 22 dB).
            </span>
          ) : (
            <span className="text-red-700 dark:text-red-400 font-semibold">
              ⚠ Rupture optique nette détectée à {liveBreakDistance} m du Central. Perte totale de signal après ce point — intervention soudure sur câble/PBO suspecté requise.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Assign Modal ──────────────────────────────────────────────────────────────
function AssignModal({
  alertItem,
  onClose,
  onAssign,
  t,
}: {
  alertItem: Alert;
  onClose: () => void;
  onAssign: (alertId: number, techName: string) => Promise<void>;
  t: (k: string) => string;
}) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-semibold text-xs text-foreground uppercase tracking-wide flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              {t("alerts.assign_title")}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[280px]" title={alertItem.message}>
              {alertItem.message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-[10px] text-muted-foreground mb-3 font-bold uppercase tracking-wider">
          {t("alerts.tech_available")}
        </div>
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-0.5">
          {technicians.map((tech) => (
            <button
              key={tech.id}
              onClick={() => onAssign(alertItem.id, tech.name)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-medium hover:bg-accent bg-accent/30 border border-border/50 hover:border-border transition"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    tech.status === "online"
                      ? "bg-emerald-500 animate-pulse"
                      : tech.status === "busy"
                      ? "bg-amber-500"
                      : "bg-gray-400"
                  }`}
                />
                <span className="font-semibold text-foreground">{tech.name}</span>
              </span>
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                {tech.status}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Declare Modal ─────────────────────────────────────────────────────────────
function DeclareModal({
  onClose,
  onCreate,
  t,
}: {
  onClose: () => void;
  onCreate: (msg: string, level: AlertLevel, bpi: string, zone: string) => Promise<void>;
  t: (k: string) => string;
}) {
  const [msg, setMsg] = useState("");
  const [level, setLevel] = useState<AlertLevel>("Warning");
  const [bpi, setBpi] = useState("");
  const [zone, setZone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setSubmitting(true);
    await onCreate(msg.trim(), level, bpi.trim().toUpperCase(), zone);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-xs uppercase text-foreground tracking-wide flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t("alerts.declare_title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              {t("alerts.field_message")} *
            </label>
            <input
              required
              placeholder={t("alerts.field_message_ph")}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          {/* Severity + BPI */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {t("alerts.field_severity")}
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as AlertLevel)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40 transition"
              >
                <option value="Critical">{t("alerts.filter_critical")}</option>
                <option value="Warning">{t("alerts.filter_warning")}</option>
                <option value="Info">{t("alerts.filter_info")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {t("alerts.field_bpi")}
              </label>
              <input
                placeholder="ex: BPI-A4"
                value={bpi}
                onChange={(e) => setBpi(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40 transition font-mono uppercase"
              />
            </div>
          </div>

          {/* Zone */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              {t("alerts.field_zone")}
            </label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40 transition"
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/10 transition disabled:opacity-60"
        >
          {submitting ? t("common.loading") : t("alerts.submit")}
        </button>
      </form>
    </div>
  );
}

// ─── Severity Stats Bar ─────────────────────────────────────────────────────────
function SeverityStatsBar({
  alerts,
  t,
}: {
  alerts: Alert[];
  t: (k: string) => string;
}) {
  const critCount = alerts.filter((a) => a.level === "Critical").length;
  const warnCount = alerts.filter((a) => a.level === "Warning").length;
  const infoCount = alerts.filter((a) => a.level === "Info").length;
  const total = alerts.length;

  const critPct = total > 0 ? (critCount / total) * 100 : 0;
  const warnPct = total > 0 ? (warnCount / total) * 100 : 0;
  const infoPct = total > 0 ? (infoCount / total) * 100 : 0;

  return (
    <div className="mb-5 rounded-xl border border-border/80 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/60 dark:to-slate-900/30 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <BarChart3 className="h-3.5 w-3.5" />
          Distribution Sévérité
        </div>
        <span className="text-[10px] text-muted-foreground">{total} alertes au total</span>
      </div>

      {/* Progress bar */}
      <div className="flex h-2 w-full rounded-full overflow-hidden mb-3 bg-slate-100 dark:bg-slate-800">
        {critPct > 0 && (
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${critPct}%` }} />
        )}
        {warnPct > 0 && (
          <div className="bg-amber-500 transition-all duration-500" style={{ width: `${warnPct}%` }} />
        )}
        {infoPct > 0 && (
          <div className="bg-sky-500 transition-all duration-500" style={{ width: `${infoPct}%` }} />
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-bold text-red-600 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-400">
          <ShieldAlert className="h-3 w-3" />
          {t("alerts.filter_critical")}: {critCount}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-600 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {t("alerts.filter_warning")}: {warnCount}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-600 dark:bg-sky-950/30 dark:border-sky-900/40 dark:text-sky-400">
          <Info className="h-3 w-3" />
          {t("alerts.filter_info")}: {infoCount}
        </span>
        {alerts.filter((a) => a.status !== "Resolved").length > 0 && (
          <span className="ms-auto inline-flex items-center gap-1.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
            {alerts.filter((a) => a.status !== "Resolved").length} actives non résolues
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
function AlertsSupervisionPage() {
  const { user } = useAuth();
  const { t, zone, lang } = useApp();
  const isRtl = lang === "ar";

  // Data state
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub Tab
  const [activeSubTab, setActiveSubTab] = useState<"alerts" | "interventions">("alerts");

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("All");
  const [search, setSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Modals
  const [assignFor, setAssignFor] = useState<Alert | null>(null);
  const [declareOpen, setDeclareOpen] = useState(false);
  const [otdrAlert, setOtdrAlert] = useState<Alert | null>(null);

  // Technician installation drawers
  const [installingItem, setInstallingItem] = useState<any | null>(null);
  const [usedMaterials, setUsedMaterials] = useState<Record<string, number>>({});
  const [reportText, setReportText] = useState("");
  const [selectedBpi, setSelectedBpi] = useState("");
  const [selectedFdt, setSelectedFdt] = useState("");
  const [selectedOlt, setSelectedOlt] = useState("");
  const [isFaultModal, setIsFaultModal] = useState(false);
  const [faultLevel, setFaultLevel] = useState<AlertLevel>("Critical");
  const [faultDesc, setFaultDesc] = useState("");

  // ─── Data loading ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [alertData, connData, instData, matData] = await Promise.all([
        sqliteQuery<Alert>("SELECT * FROM alerts ORDER BY id DESC"),
        sqliteQuery<Connection>("SELECT id, pos_bpi, fdt FROM connections"),
        sqliteQuery<any>("SELECT * FROM installations ORDER BY id DESC"),
        sqliteQuery<any>("SELECT * FROM materials ORDER BY name"),
      ]);
      setAlerts(alertData);
      setConnections(connData);
      setInstallations(instData);
      setMaterials(matData);
      setLoading(false);
    } catch (e: any) {
      toast.error("Erreur de chargement : " + e.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Prefill connection names when selecting an installation
  useEffect(() => {
    if (installingItem) {
      setReportText("");
      setUsedMaterials({});
      // Autocomplete suggested names
      setSelectedBpi(`BPI-${installingItem.bloc?.slice(-1)}${installingItem.appartement?.slice(-1) || "1"}`);
      setSelectedFdt("UMA SOUKRA");
      setSelectedOlt("3");
    }
  }, [installingItem]);

  const handleCancelInstallation = async (instId: number) => {
    const confirmCancel = window.confirm(
      isRtl 
        ? "هل أنت متأكد من إلغاء هذا الطلب بسبب رفض المشترك؟" 
        : "Êtes-vous sûr d'annuler cette demande à cause du refus du client ?"
    );
    if (!confirmCancel) return;
    try {
      const res = await fetch("/api/sqlite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "UPDATE installations SET status = 'Cancelled', updated_at = ? WHERE id = ?",
          params: [new Date().toISOString(), instId]
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isRtl ? "تم إلغاء الطلب بنجاح." : "Demande annulée (Refus client) enregistrée.");
        loadData();
      }
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  const handleSubmitInstallation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installingItem) return;

    try {
      // 1. Deduct Materials Stock & Log Usages
      for (const [matId, qty] of Object.entries(usedMaterials)) {
        if (qty > 0) {
          // Deduct
          await sqliteExecute("UPDATE materials SET stock_qty = stock_qty - ? WHERE id = ?", [qty, matId]);
          // Log Usage
          await sqliteExecute(
            `INSERT INTO material_usages (material_id, user_id, quantity, bpi_id, note, status, scanned_at) 
             VALUES (?, ?, ?, ?, ?, 'Approved', datetime('now'))`,
            [matId, user?.email?.split("@")[0] || "anis", qty, selectedBpi, `Raccordement ${installingItem.client_name}`]
          );
        }
      }

      // 2. Add Subscriber Connection
      const connRes = await sqliteExecute(
        `INSERT INTO connections (residence, bloc, appartement, etage, pos_bpi, gps_bpi, fdt, gps_fdt, port_olt, port_carte_gpon) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'GPON-0')`,
        [
          installingItem.residence,
          installingItem.bloc,
          installingItem.appartement,
          installingItem.etage || "1",
          selectedBpi,
          installingItem.gps || "36.8671,10.2253",
          selectedFdt,
          "36.8643,10.2167",
          selectedOlt
        ]
      );

      if (connRes.success) {
        // 3. Mark Installation Completed
        const matUsedJson = JSON.stringify(usedMaterials);
        await sqliteExecute(
          "UPDATE installations SET status = 'Completed', notes = ?, materials_used = ?, updated_at = ? WHERE id = ?",
          [reportText || "Raccordement drop et épissures optiques terminés avec succès.", matUsedJson, new Date().toISOString(), installingItem.id]
        );

        toast.success(isRtl ? "تم إكمال التوصيل وخصم المواد من المخزن بنجاح!" : "Installation finalisée et matériel déduit du stock avec succès !");
        setInstallingItem(null);
        loadData();
      }
    } catch (err: any) {
      toast.error("Installation failed: " + err.message);
    }
  };

  const handleSubmitFault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installingItem) return;

    try {
      const nowStr = new Date().toISOString();
      // 1. Insert alert in database
      const alertMsg = faultDesc.trim() || `Panne de signal de raccordement signalée chez ${installingItem.client_name}`;
      const alertRes = await sqliteExecute(
        `INSERT INTO alerts (message, level, pos_bpi, status, assigned_tech, created_at) 
         VALUES (?, ?, ?, 'Open', ?, ?)`,
        [alertMsg, faultLevel, selectedBpi, user?.email || "Anis Ben Salah", nowStr]
      );

      if (alertRes.success) {
        // 2. Update installation status to 'Fault'
        await sqliteExecute(
          "UPDATE installations SET status = 'Fault', notes = ?, updated_at = ? WHERE id = ?",
          [`⚠ Panne signalée : ${alertMsg}`, nowStr, installingItem.id]
        );

        toast.warning(isRtl ? "تم تسجيل العطل وإخطار مدير المشروع." : "Incident enregistré et notifié au Chef de Projet.");
        setIsFaultModal(false);
        setInstallingItem(null);
        loadData();
      }
    } catch (err: any) {
      toast.error("Failed to register fault: " + err.message);
    }
  };

  // ─── Zone → BPI mapping ────────────────────────────────────────────────────
  // Build set of pos_bpi values that belong to the selected zone (via connections.fdt)
  const zoneBpiSet = useMemo(() => {
    if (zone === "Toutes les zones") return null; // null = no zone filter
    const set = new Set<string>();
    connections.forEach((c) => {
      if (c.fdt === zone && c.pos_bpi) {
        set.add(String(c.pos_bpi).toUpperCase());
      }
    });
    return set;
  }, [zone, connections]);

  // ─── Filtered alerts ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      // Zone filter
      if (zoneBpiSet !== null) {
        const bpi = a.pos_bpi ? String(a.pos_bpi).toUpperCase() : "";
        if (!zoneBpiSet.has(bpi)) return false;
      }

      // Status tab
      if (statusFilter !== "All" && a.status !== statusFilter) return false;

      // Level dropdown
      if (levelFilter !== "All" && a.level !== levelFilter) return false;

      // Search
      const q = search.trim().toLowerCase();
      if (q) {
        const inMessage = a.message.toLowerCase().includes(q);
        const inBpi = a.pos_bpi ? a.pos_bpi.toLowerCase().includes(q) : false;
        const inTech = a.assigned_tech ? a.assigned_tech.toLowerCase().includes(q) : false;
        if (!inMessage && !inBpi && !inTech) return false;
      }

      return true;
    });
  }, [alerts, zoneBpiSet, statusFilter, levelFilter, search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, levelFilter, search, zone]);

  // ─── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // ─── Tab counts ────────────────────────────────────────────────────────────
  const openCount = alerts.filter((a) => a.status === "Open").length;
  const inProgCount = alerts.filter((a) => a.status === "In Progress").length;
  const resolvedCount = alerts.filter((a) => a.status === "Resolved").length;

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleAssign = async (alertId: number, techName: string) => {
    try {
      const res = await sqliteExecute(
        "UPDATE alerts SET assigned_tech = ?, status = 'In Progress' WHERE id = ?",
        [techName, alertId]
      );
      if (res.success) {
        toast.success(t("alerts.assign_success").replace("{tech}", techName));
        setAssignFor(null);
        loadData();
      }
    } catch (e: any) {
      toast.error("Échec d'assignation : " + e.message);
    }
  };

  const handleResolve = async (alertId: number) => {
    try {
      const res = await sqliteExecute(
        "UPDATE alerts SET status = 'Resolved' WHERE id = ?",
        [alertId]
      );
      if (res.success) {
        toast.success(t("alerts.resolve_success"));
        loadData();
      }
    } catch (e: any) {
      toast.error("Échec résolution : " + e.message);
    }
  };

  const handleCreate = async (msg: string, level: AlertLevel, bpi: string, zoneVal: string) => {
    try {
      const nowStr = new Date().toISOString();
      const res = await sqliteExecute(
        "INSERT INTO alerts (message, level, pos_bpi, status, assigned_tech, created_at) VALUES (?, ?, ?, 'Open', NULL, ?)",
        [msg, level, bpi || null, nowStr]
      );
      if (res.success) {
        toast.success(t("alerts.create_success"));
        setDeclareOpen(false);
        loadData();
      }
    } catch (e: any) {
      toast.error("Échec déclaration : " + e.message);
    }
  };

  const handleExport = () => {
    exportToCSV(filtered);
    toast.success(t("alerts.export_success"));
  };

  // ─── Level Badge ───────────────────────────────────────────────────────────
  const getLevelClasses = (level: string) => {
    if (level === "Critical")
      return "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/25 dark:text-red-400 dark:border-red-900/30";
    if (level === "Warning")
      return "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/25 dark:text-amber-400 dark:border-amber-900/30";
    return "bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/25 dark:text-sky-400 dark:border-sky-900/30";
  };

  const getLevelLabel = (level: string) => {
    if (level === "Critical") return t("alerts.filter_critical");
    if (level === "Warning") return t("alerts.filter_warning");
    return t("alerts.filter_info");
  };

  // ─── Status badge ──────────────────────────────────────────────────────────
  const getStatusClasses = (status: string) => {
    if (status === "Open")
      return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
    if (status === "In Progress")
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400";
  };

  const getDotClasses = (status: string) => {
    if (status === "Open") return "bg-red-500 animate-ping";
    if (status === "In Progress") return "bg-amber-500 animate-pulse";
    return "bg-emerald-500";
  };

  const getStatusLabel = (status: string) => {
    if (status === "Open") return t("alerts.status_open");
    if (status === "In Progress") return t("alerts.status_inprog");
    return t("alerts.status_resolved");
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground bg-background">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-6 w-6 animate-pulse text-primary" />
          <span>{t("alerts.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <main
      className="h-full w-full overflow-y-auto bg-[#f8fafc] dark:bg-slate-900 p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-6xl space-y-5">

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("alerts.title")}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {zone !== "Toutes les zones"
                ? `Supervision zone : ${zone}`
                : "Supervision globale réseau FTTH · SOTETEL"}
            </p>
          </div>
          <div className={`flex items-center gap-3 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}>
            {/* Sub-tab navigation */}
            <div className="flex bg-[#f1f5f9] dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveSubTab("alerts")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeSubTab === "alerts"
                    ? "bg-[#6366f1] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                ⚠️ {isRtl ? "التنبيهات" : "Alertes Réseau"}
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("interventions")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeSubTab === "interventions"
                    ? "bg-[#10b981] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                🛠️ {isRtl ? "مهام التركيب" : "Chantiers & Raccordements"}
              </button>
            </div>

            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-3.5 py-2 text-xs font-bold shadow-sm transition"
            >
              <Download className="h-3.5 w-3.5" />
              {t("alerts.export")}
            </button>
            <button
              onClick={() => setDeclareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-foreground transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("alerts.declare")}
            </button>
          </div>
        </header>

        {/* Severity stats bar */}
        <SeverityStatsBar alerts={alerts} t={t} />

        {/* Conditionally render Interventions or Alerts Panel */}
        {activeSubTab === "interventions" ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Statistics summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">{isRtl ? "مهمات معلّقة" : "Chantiers Affectés"}</span>
                  <span className="text-xl font-black text-amber-500 tabular-nums">
                    {installations.filter(x => x.assigned_tech && (x.status === "Dispatched" || x.status === "Fault")).length}
                  </span>
                </div>
                <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500">🛠️</div>
              </div>
              <div className="bg-card border rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">{isRtl ? "مهمات مكتملة" : "Installations Réussies"}</span>
                  <span className="text-xl font-black text-emerald-500 tabular-nums">
                    {installations.filter(x => x.status === "Completed").length}
                  </span>
                </div>
                <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500">✓</div>
              </div>
              <div className="bg-card border rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">{isRtl ? "حسابك النشط" : "Technicien Connecté"}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block truncate max-w-[180px]">
                    👤 {user?.email?.split("@")[0] || "Technicien SOTETEL"}
                  </span>
                </div>
                <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-500">👤</div>
              </div>
            </div>

            {/* Chantiers List */}
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm dark:bg-slate-950 dark:border-slate-800">
              <h3 className="font-bold text-sm text-foreground mb-4 border-b pb-2 flex items-center gap-1.5">
                💼 {isRtl ? "قائمة المهام والتدخلات الميدانية" : "Vos Bons d'Intervention Optique"}
              </h3>

              {installations.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center gap-3">
                  <div className="text-3xl">☕</div>
                  <p className="text-xs text-muted-foreground font-semibold">
                    {isRtl ? "لا توجد أي مهام معينة حالياً." : "Aucune demande d'installation raccordée dans la base."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {installations.map((inst) => {
                    const isPendingAction = inst.status === "Dispatched" || inst.status === "Fault";
                    
                    let statusColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
                    let statusText = inst.status;

                    if (inst.status === "Pending") {
                      statusColor = "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
                      statusText = isRtl ? "بانتظار التكليف" : "Demande en attente";
                    } else if (inst.status === "Dispatched") {
                      statusColor = "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400";
                      statusText = isRtl ? `معيّن لـ: ${inst.assigned_tech}` : `Affecté : ${inst.assigned_tech}`;
                    } else if (inst.status === "Completed") {
                      statusColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400";
                      statusText = isRtl ? "مكتمل" : "Raccordé";
                    } else if (inst.status === "Cancelled") {
                      statusColor = "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
                      statusText = isRtl ? "ملغي (رفض)" : "Refus Client";
                    } else if (inst.status === "Fault") {
                      statusColor = "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400";
                      statusText = isRtl ? "عطل فني بالمرجع" : "Panne signalée";
                    }

                    return (
                      <div 
                        key={inst.id} 
                        className={`rounded-xl border p-4.5 transition hover:shadow-md flex flex-col justify-between gap-4 ${
                          inst.status === "Completed" 
                            ? "bg-slate-50/50 border-slate-200 opacity-80 dark:bg-slate-900/10 dark:border-slate-800" 
                            : inst.status === "Fault"
                            ? "border-rose-300 bg-rose-500/5 dark:border-rose-900/30"
                            : "border-indigo-100 bg-white hover:border-indigo-300 dark:bg-slate-900 dark:border-slate-800/80 dark:hover:border-indigo-800"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-sm text-foreground flex items-center gap-1.5 truncate">
                              👤 {inst.client_name}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${statusColor}`}>
                              {statusText}
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground mt-2 space-y-1 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div>📍 <strong>{isRtl ? "الموقع :" : "Adresse :"}</strong> {inst.residence} {inst.bloc} - Appt {inst.appartement} (Et. {inst.etage || "RDC"})</div>
                            <div className="font-mono text-[9px] text-primary/80">🌐 GPS: {inst.gps}</div>
                          </div>

                          <div className="text-xs text-[#475569] dark:text-slate-300 mt-2.5 font-semibold">
                            📝 {isRtl ? "ملاحظات وتوجيهات :" : "Instructions PM :"} <span className="font-medium text-muted-foreground">{inst.notes || "—"}</span>
                          </div>

                          {inst.status === "Completed" && inst.materials_used && (
                            <div className="text-[10px] mt-2.5 text-muted-foreground/80 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-dashed">
                              🛠️ <strong>{isRtl ? "المواد المستهلكة من المخزن :" : "Matériels déduits du stock :"}</strong>
                              <ul className="list-disc pl-3.5 mt-1 space-y-0.5">
                                {Object.entries(JSON.parse(inst.materials_used)).map(([matId, qty]: any) => {
                                  const matName = materials.find(m => String(m.id) === String(matId))?.name || `Matériau ID ${matId}`;
                                  return (
                                    <li key={matId}>{matName} x <span className="font-bold text-foreground">{qty}</span></li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>

                        {isPendingAction && (
                          <div className="flex gap-2 border-t pt-3 mt-1 border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => {
                                setInstallingItem(inst);
                                setIsFaultModal(false);
                              }}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 text-xs font-bold shadow-md shadow-emerald-500/10 transition"
                            >
                              ✓ {isRtl ? "كتابة تقرير وتركيب" : "Investiguer & Installer"}
                            </button>
                            <button
                              onClick={() => {
                                setInstallingItem(inst);
                                setIsFaultModal(true);
                                setFaultDesc("");
                                setFaultLevel("Critical");
                              }}
                              className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400 px-2.5 py-1.5 text-xs font-bold transition"
                              title={isRtl ? "تبليغ عطل للشبكة" : "Signaler une Panne"}
                            >
                              ⚠
                            </button>
                            <button
                              onClick={() => handleCancelInstallation(inst.id)}
                              className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 px-2 py-1.5 text-[10px] font-bold transition"
                            >
                              ✕ {isRtl ? "رفض العميل" : "Refus"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm dark:bg-slate-950 dark:border-slate-800">

            {/* Panel header: search */}
            <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 ${isRtl ? "md:flex-row-reverse" : ""}`}>
              <div className={`relative min-w-[240px] max-w-md w-full ${isRtl ? "ms-auto" : ""}`}>
                <Search className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground ${isRtl ? "right-3" : "left-3"}`} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("alerts.search_ph")}
                  className={`w-full rounded-xl border border-input bg-background py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 transition ${isRtl ? "pr-9 pl-3" : "pl-9 pr-3"}`}
                />
              </div>

              <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isRtl ? "flex-row-reverse" : ""}`}>
                <span className="hidden md:block">{t("alerts.filter_severity")}</span>
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
                  className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs outline-none text-foreground font-semibold focus:ring-2 focus:ring-primary/30 transition"
                >
                  <option value="All">{t("alerts.filter_all")}</option>
                  <option value="Critical">{t("alerts.filter_critical")}</option>
                  <option value="Warning">{t("alerts.filter_warning")}</option>
                  <option value="Info">{t("alerts.filter_info")}</option>
                </select>
                <span className="text-[10px] font-semibold whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                  {t("alerts.found").replace("{n}", String(filtered.length))}
                </span>
              </div>
            </div>

            {/* Status tabs */}
            <div className={`flex gap-0 border-b border-slate-100 dark:border-slate-800 overflow-x-auto px-5 ${isRtl ? "flex-row-reverse" : ""}`}>
              {(
                [
                  { key: "All", label: t("alerts.tab_all"), count: null },
                  { key: "Open", label: t("alerts.tab_open"), count: openCount },
                  { key: "In Progress", label: t("alerts.tab_inprog"), count: inProgCount },
                  { key: "Resolved", label: t("alerts.tab_resolved"), count: resolvedCount },
                ] as const
              ).map((tab) => {
                const selected = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`relative py-3.5 px-4 text-xs font-bold transition whitespace-nowrap ${
                      selected
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                    {tab.count !== null && (
                      <span className="ms-1.5 inline-flex items-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[9px] font-bold tabular-nums">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Alerts Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs" dir={isRtl ? "rtl" : "ltr"}>
                <thead className="bg-[#f8fafc] text-muted-foreground font-bold uppercase tracking-wider text-[10px] dark:bg-slate-900 border-b border-border">
                  <tr>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("alerts.col_id")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("alerts.col_severity")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("alerts.col_message")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("alerts.col_equipment")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("alerts.col_status")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("alerts.col_created")}</th>
                    <th className="px-4 py-3 text-center">{t("alerts.col_actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                      <td className="px-4 py-3 font-mono font-bold text-muted-foreground">#{a.id}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getLevelClasses(a.level)}`}>
                          {getLevelLabel(a.level)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground max-w-sm truncate" title={a.message}>
                        {a.message}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{a.pos_bpi || t("common.na")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getStatusClasses(a.status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${getDotClasses(a.status)}`} />
                          {getStatusLabel(a.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">{formatDate(a.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setOtdrAlert(a)}
                            className="rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-800/40 dark:text-indigo-400 px-2 py-1 text-[10px] font-bold shadow-xs transition"
                            title="Lancer OTDR"
                          >
                            📈 OTDR
                          </button>
                          
                          {a.status === "Open" && (
                            <button
                              onClick={() => setAssignFor(a)}
                              className="rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-indigo-400 px-2.5 py-1 text-[10px] font-bold shadow-xs transition"
                            >
                              👤 {t("alerts.assign")}
                            </button>
                          )}

                          {a.status === "In Progress" && (
                            <>
                              <button
                                onClick={() => setAssignFor(a)}
                                className="rounded-lg bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-400 px-2 py-1 text-[10px] font-bold shadow-xs transition"
                              >
                                {t("alerts.reassign")}
                              </button>
                              <button
                                onClick={() => handleResolve(a.id)}
                                className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 text-[10px] font-bold shadow-sm transition"
                              >
                                ✓ {t("alerts.resolve")}
                              </button>
                            </>
                          )}

                          {a.status === "Resolved" && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                              ✓ {t("alerts.signal_ok")}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-xs text-muted-foreground font-semibold">
                        {t("alerts.none")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className={`flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-5 py-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                <span className="text-[11px] text-muted-foreground font-semibold">
                  Page <span className="font-bold text-foreground">{page}</span> sur <span className="font-bold text-foreground">{totalPages}</span>
                </span>
                
                <div className={`flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-border hover:bg-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRtl ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`min-w-[28px] h-7 rounded-lg border text-[10px] font-bold transition ${
                        pg === page
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      {pg}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-border hover:bg-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRtl ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {assignFor && (
        <AssignModal
          alertItem={assignFor}
          onClose={() => setAssignFor(null)}
          onAssign={handleAssign}
          t={t}
        />
      )}

      {declareOpen && (
        <DeclareModal
          onClose={() => setDeclareOpen(false)}
          onCreate={handleCreate}
          t={t}
        />
      )}

      {otdrAlert && (
        <OTDRTraceModal
          alertItem={otdrAlert}
          onClose={() => setOtdrAlert(null)}
          t={t}
        />
      )}

      {/* 🛠️ Technician Raccordement Report Modal */}
      {installingItem && !isFaultModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <form
            onSubmit={handleSubmitInstallation}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className="font-bold text-xs uppercase text-emerald-600 tracking-wide flex items-center gap-2">
                ✓ {isRtl ? "كتابة تقرير وإتمام التركيب" : "Rapport d'Investigation & Raccordement"}
              </h3>
              <button
                type="button"
                onClick={() => setInstallingItem(null)}
                className="rounded-md p-1 hover:bg-accent text-muted-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-right">
              {/* Info block */}
              <div className="bg-slate-50 dark:bg-slate-900 border p-3.5 rounded-xl text-xs space-y-1">
                <div className={`flex justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                  <strong className="text-foreground">{isRtl ? "اسم المشترك :" : "Abonné :"}</strong>
                  <span className="text-muted-foreground">{installingItem.client_name}</span>
                </div>
                <div className={`flex justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                  <strong className="text-foreground">{isRtl ? "الموقع الجغرافي :" : "Adresse :"}</strong>
                  <span className="text-muted-foreground">{installingItem.residence} {installingItem.bloc} - Appt {installingItem.appartement}</span>
                </div>
                <div className={`flex justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                  <strong className="text-foreground">GPS :</strong>
                  <span className="text-primary font-mono">{installingItem.gps}</span>
                </div>
              </div>

              {/* Hardware / GPON parameters */}
              <div className="grid grid-cols-3 gap-3">
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-1">PBO / BPI d'affectation</label>
                  <input
                    required
                    placeholder="BPI-A7"
                    value={selectedBpi}
                    onChange={(e) => setSelectedBpi(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-1">Cabinet FDT parent</label>
                  <select
                    value={selectedFdt}
                    onChange={(e) => setSelectedFdt(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold"
                  >
                    {ZONES.map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-1">Port OLT d'affectation</label>
                  <input
                    required
                    placeholder="e.g. 3"
                    value={selectedOlt}
                    onChange={(e) => setSelectedOlt(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              {/* Materials deduction checklist */}
              <div className={isRtl ? "text-right" : "text-left"}>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  🛠️ {isRtl ? "خصم المواد المستخدمة من المخزن :" : "Prélever du matériel de l'inventaire :"}
                </label>
                <div className="space-y-2 max-h-[160px] overflow-y-auto border rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900">
                  {materials.map((m) => (
                    <div key={m.id} className={`flex items-center justify-between gap-3 text-xs border-b border-slate-100 dark:border-slate-800 pb-1.5 last:border-0 last:pb-0 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <span className={`truncate flex-1 ${isRtl ? "text-right" : "text-left"}`} title={m.name}>
                        📦 {m.name} <span className="text-[10px] text-muted-foreground">({m.stock_qty} {m.unit} dispo)</span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={Number(m.stock_qty)}
                        value={usedMaterials[m.id] || ""}
                        onChange={(e) => {
                          const val = Math.min(Number(m.stock_qty), Math.max(0, parseInt(e.target.value) || 0));
                          setUsedMaterials({ ...usedMaterials, [m.id]: val });
                        }}
                        placeholder="0"
                        className="w-14 rounded-lg border border-input bg-background px-2 py-1 text-center font-bold text-xs outline-none"
                      />
                    </div>
                  ))}
                  {materials.length === 0 && (
                    <div className="text-center py-4 text-xs text-muted-foreground">Aucun matériel disponible.</div>
                  )}
                </div>
              </div>

              {/* Report text */}
              <div className={isRtl ? "text-right" : "text-left"}>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  📝 {isRtl ? "تقرير التركيب وتفاصيل التدخل :" : "Rapport technique d'intervention :"}
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={isRtl ? "اكتب هنا تفاصيل عملية التوصيل وتجربة الإشارة الضوئية..." : "ex. Raccordement drop optique terminé, test réflectométrique nominal, niveau reçu -19.4 dBm."}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3 py-2.5 text-xs shadow-md shadow-emerald-500/10 transition"
            >
              ✓ {isRtl ? "تأكيد إتمام التركيب وتحديث البيانات" : "Valider et finaliser le raccordement"}
            </button>
          </form>
        </div>
      )}

      {/* ⚠️ Technician Declare Panne / Fault Modal */}
      {installingItem && isFaultModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <form
            onSubmit={handleSubmitFault}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className="font-bold text-xs uppercase text-rose-600 tracking-wide flex items-center gap-2">
                ⚠ {isRtl ? "التبليغ عن عطل في الموقع" : "Signaler une Panne Optique / Obstacle"}
              </h3>
              <button
                type="button"
                onClick={() => setInstallingItem(null)}
                className="rounded-md p-1 hover:bg-accent text-muted-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-right">
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3 rounded-xl text-xs text-rose-800 dark:text-rose-400">
                {isRtl 
                  ? "سوف يتم إرسال تنبيه فوري لمدير المشروع وتعليق عملية التركيب لحين صيانة الشبكة." 
                  : "Le chantier sera suspendu et marqué en anomalie technique. Un incident sera déclaré sur le PBO de destination."}
              </div>

              {/* BPI code */}
              <div className={isRtl ? "text-right" : "text-left"}>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">PBO / BPI concerné</label>
                <input
                  required
                  placeholder="BPI-A7"
                  value={selectedBpi}
                  onChange={(e) => setSelectedBpi(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              {/* Severity */}
              <div className={isRtl ? "text-right" : "text-left"}>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Sévérité du problème</label>
                <select
                  value={faultLevel}
                  onChange={(e) => setFaultLevel(e.target.value as AlertLevel)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold"
                >
                  <option value="Critical">{t("alerts.filter_critical")}</option>
                  <option value="Warning">{t("alerts.filter_warning")}</option>
                  <option value="Info">{t("alerts.filter_info")}</option>
                </select>
              </div>

              {/* Description */}
              <div className={isRtl ? "text-right" : "text-left"}>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Description de l'incident / Panne *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={isRtl ? "صف بدقة المشكلة (مثال: كابل Feeder مقطوع بالكامل، صندوق PBO محطم...)" : "ex. Absence de signal optique au PBO BPI-A7. Suspicion de jarretière cassée en amont dans la boîte de distribution."}
                  value={faultDesc}
                  onChange={(e) => setFaultDesc(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-2.5 text-xs shadow-md shadow-rose-600/10 transition"
            >
              ⚠ {isRtl ? "تأكيد وإرسال التنبيه" : "Confirmer et suspendre le chantier"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
