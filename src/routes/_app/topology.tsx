import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  GitBranch,
  Zap,
  Activity,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Plus,
  X,
  Database,
  Radio,
  BarChart3,
} from "lucide-react";
import { sqliteQuery } from "@/lib/sqlite-client";
import { useApp } from "@/hooks/use-app";

export const Route = createFileRoute("/_app/topology")({
  head: () => ({ meta: [{ title: "Topologie Réseau — FiberNMS" }] }),
  component: TopologyPage,
  ssr: false,
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Connection {
  id: number;
  residence: string;
  bloc: string;
  appartement: string;
  etage: string;
  pos_bpi: string;
  gps_bpi: string;
  pos_joint1: string;
  pos_joint2: string;
  pos_joint3: string;
  pos_joint4: string;
  fdt: string;
  cosh: string;
  module: string;
  port: string;
  pos_spl: string;
  port_olt: string;
  port_odf: string;
  port_carte_gpon: string;
}

interface Alert {
  id: number;
  message: string;
  level: string;
  pos_bpi: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeBpi = (raw: string | null | undefined): string =>
  String(raw ?? "").replace(/^BPI-/i, "").trim();

// ─── "Nouveau Chemin" Modal ───────────────────────────────────────────────────
function NewCheminModal({
  isOpen,
  onClose,
  fdts,
}: {
  isOpen: boolean;
  onClose: () => void;
  fdts: string[];
}) {
  const { t, lang } = useApp();
  const isRtl = lang === "ar";

  const [form, setForm] = useState({
    name: "",
    port_olt: "",
    fdt: "",
    bpi: "",
    length_km: "",
    notes: "",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.port_olt.trim() ||
      !form.fdt.trim() ||
      !form.bpi.trim()
    ) {
      toast.error(t("topo.err_required"));
      return;
    }
    // In a real app, persist to DB via sqliteExecute
    toast.success(t("topo.success"));
    setForm({ name: "", port_olt: "", fdt: "", bpi: "", length_km: "", notes: "" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-950 border border-border shadow-2xl overflow-hidden"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-blue-50 to-violet-50 dark:from-slate-900 dark:to-slate-900">
          <div>
            <h2 className="font-bold text-base text-foreground">{t("topo.modal_title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("topo.modal_subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              {t("topo.field_name")} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("topo.field_name_ph")}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          {/* Port OLT + FDT */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("topo.field_olt")} *
              </label>
              <input
                type="text"
                value={form.port_olt}
                onChange={(e) => setForm((f) => ({ ...f, port_olt: e.target.value }))}
                placeholder={t("topo.field_olt_ph")}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("topo.field_fdt")} *
              </label>
              <select
                value={form.fdt}
                onChange={(e) => setForm((f) => ({ ...f, fdt: e.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              >
                <option value="">{t("topo.field_fdt_ph")}</option>
                {fdts.map((fdt) => (
                  <option key={fdt} value={fdt}>
                    {fdt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* BPI + Length */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("topo.field_bpi")} *
              </label>
              <input
                type="text"
                value={form.bpi}
                onChange={(e) => setForm((f) => ({ ...f, bpi: e.target.value }))}
                placeholder={t("topo.field_bpi_ph")}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("topo.field_length")}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.length_km}
                onChange={(e) => setForm((f) => ({ ...f, length_km: e.target.value }))}
                placeholder={t("topo.field_length_ph")}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              {t("topo.field_notes")}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t("topo.field_notes_ph")}
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none"
            />
          </div>

          {/* Buttons */}
          <div className={`flex gap-2 pt-1 ${isRtl ? "flex-row-reverse" : ""}`}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold hover:bg-accent transition"
            >
              {t("topo.btn_cancel")}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-primary text-white py-2 text-xs font-bold hover:bg-primary/90 transition shadow-md shadow-primary/20"
            >
              {t("topo.btn_save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Stats Mini-Panel ─────────────────────────────────────────────────────────
function StatsMiniPanel({
  connections,
  alerts,
  zone,
}: {
  connections: Connection[];
  alerts: Alert[];
  zone: string;
}) {
  const { t } = useApp();

  const totalConnections = connections.length;

  const uniqueBpis = useMemo(() => {
    const s = new Set<string>();
    connections.forEach((c) => {
      if (c.pos_bpi) s.add(normalizeBpi(c.pos_bpi));
    });
    return s.size;
  }, [connections]);

  const activeAlerts = useMemo(() => {
    // Count active alerts whose pos_bpi matches any connection in the current zone
    const zoneBpis = new Set(connections.map((c) => normalizeBpi(c.pos_bpi)));
    return alerts.filter((a) => {
      const n = normalizeBpi(a.pos_bpi);
      return n && zoneBpis.has(n);
    }).length;
  }, [alerts, connections]);

  const stats = [
    {
      icon: <Database className="h-4 w-4 text-blue-500" />,
      label: t("topo.subscribers"),
      value: totalConnections,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      icon: <Radio className="h-4 w-4 text-violet-500" />,
      label: t("topo.pbo_boxes"),
      value: uniqueBpis,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/30",
    },
    {
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      label: t("topo.alarm_active"),
      value: activeAlerts,
      color: activeAlerts > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
      bg: activeAlerts > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3 border-b border-border pb-2">
        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {zone === "Toutes les zones" ? "Réseau Global" : zone}
        </span>
      </div>
      <div className="space-y-2">
        {stats.map((s, i) => (
          <div
            key={i}
            className={`flex items-center justify-between rounded-xl px-3 py-2 ${s.bg}`}
          >
            <div className="flex items-center gap-2">
              {s.icon}
              <span className="text-[11px] font-semibold text-foreground">{s.label}</span>
            </div>
            <span className={`text-sm font-bold tabular-nums ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function TopologyPage() {
  const { t, lang, zone } = useApp();
  const isRtl = lang === "ar";

  const [allConnections, setAllConnections] = useState<Connection[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "OLT-CO-Central": true,
  });
  const [faultAnalyzer, setFaultAnalyzer] = useState(false);
  const [activeView, setActiveView] = useState<"tree" | "heatmap" | "calculator">("tree");
  const [showNewCheminModal, setShowNewCheminModal] = useState(false);

  // Link Budget Calculator States
  const [wavelength, setWavelength] = useState<"1310" | "1490" | "1550">("1550");
  const [distance, setDistance] = useState<number>(1.5);
  const [splitterRatio, setSplitterRatio] = useState<"1:2" | "1:4" | "1:8" | "1:16" | "1:32" | "1:64">("1:8");
  const [spliceCount, setSpliceCount] = useState<number>(3);
  const [connectorCount, setConnectorCount] = useState<number>(2);
  const [margin, setMargin] = useState<number>(1.5);
  const [oltTxPower, setOltTxPower] = useState<number>(4.0);

  // Link Budget Derived Values
  const fiberLossCoeff = wavelength === "1310" ? 0.35 : wavelength === "1490" ? 0.25 : 0.22;
  const fiberLoss = distance * fiberLossCoeff;
  
  const splitterLoss = useMemo(() => {
    switch (splitterRatio) {
      case "1:2": return 3.5;
      case "1:4": return 6.5;
      case "1:8": return 10.0;
      case "1:16": return 13.5;
      case "1:32": return 17.0;
      case "1:64": return 20.5;
      default: return 10.0;
    }
  }, [splitterRatio]);

  const spliceLoss = spliceCount * 0.1;
  const connectorLoss = connectorCount * 0.25;
  const totalLoss = fiberLoss + splitterLoss + spliceLoss + connectorLoss + margin;
  const rxPower = oltTxPower - totalLoss;

  // ── Zone-filtered connections ─────────────────────────────────────────────
  const connections = useMemo<Connection[]>(() => {
    if (zone === "Toutes les zones") return allConnections;
    return allConnections.filter((c) => c.fdt === zone);
  }, [allConnections, zone]);

  // ── Unique FDTs for modal dropdown (from zone-filtered connections) ────────
  const uniqueFdts = useMemo(() => {
    const set = new Set<string>();
    connections.forEach((c) => {
      if (c.fdt) set.add(c.fdt);
    });
    return Array.from(set).sort();
  }, [connections]);

  // ── Active alerts (non-resolved) ─────────────────────────────────────────
  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status !== "Resolved"),
    [alerts]
  );

  // ── BPI alert match helper ─────────────────────────────────────────────────
  const getBpiAlert = (bpiCode: string): Alert | undefined => {
    const normalized = normalizeBpi(bpiCode);
    return activeAlerts.find(
      (a) => normalizeBpi(a.pos_bpi) === normalized
    );
  };

  // ── Total impacted subscribers ────────────────────────────────────────────
  const totalImpact = useMemo(() => {
    const affectedBpis = new Set(
      activeAlerts.map((a) => normalizeBpi(a.pos_bpi)).filter(Boolean)
    );
    return connections.filter((c) =>
      affectedBpis.has(normalizeBpi(c.pos_bpi))
    ).length;
  }, [activeAlerts, connections]);

  // ── Heatmap grid ──────────────────────────────────────────────────────────
  const heatmapGrid = useMemo(() => {
    const affectedBpis = new Set(
      activeAlerts.map((a) => normalizeBpi(a.pos_bpi)).filter(Boolean)
    );
    return connections.map((c) => {
      const bpiKey = normalizeBpi(c.pos_bpi);
      const inFault = affectedBpis.has(bpiKey);
      let dbm =
        -17.5 -
        ((c.id || 0) % 8) * 1.2 -
        (parseInt(c.etage) || 0) * 0.4;
      if (inFault) dbm = -32.0;
      return { ...c, dbm, inFault };
    });
  }, [connections, activeAlerts]);

  // ── GPON tree ─────────────────────────────────────────────────────────────
  const gponTree = useMemo(() => {
    const tree: any = {
      id: "OLT-CO-Central",
      name: "Central Office (OLT)",
      type: "OLT",
      children: [],
    };

    const fdtMap = new Map<string, any>();
    connections.forEach((c) => {
      if (c.fdt && !fdtMap.has(c.fdt)) {
        fdtMap.set(c.fdt, {
          id: `FDT-${c.fdt.replace(/\s+/g, "-")}`,
          name: c.fdt,
          type: "FDT",
          children: [],
        });
      }
    });

    const bpiMap = new Map<string, any>();
    connections.forEach((c) => {
      if (c.pos_bpi && c.fdt) {
        const bpiKey = normalizeBpi(c.pos_bpi);
        if (!bpiMap.has(bpiKey)) {
          bpiMap.set(bpiKey, {
            id: `BPI-${bpiKey}`,
            name: bpiKey,
            type: "BPI",
            fdtName: c.fdt,
            apartments: [] as Connection[],
          });
        }
        bpiMap.get(bpiKey)!.apartments.push(c);
      }
    });

    // Attach BPIs → FDTs
    bpiMap.forEach((bpiNode) => {
      const parentFdt = fdtMap.get(bpiNode.fdtName);
      if (parentFdt) parentFdt.children.push(bpiNode);
    });

    // Attach FDTs → OLT
    fdtMap.forEach((fdtNode) => tree.children.push(fdtNode));

    return tree;
  }, [connections]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [connData, alertData] = await Promise.all([
        sqliteQuery<Connection>("SELECT * FROM connections"),
        sqliteQuery<Alert>("SELECT * FROM alerts"),
      ]);
      setAllConnections(connData);
      setAlerts(alertData);
    } catch (e: any) {
      toast.error("Failed to load topology data: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => {
    const exp: Record<string, boolean> = { "OLT-CO-Central": true };
    gponTree.children.forEach((f: any) => {
      exp[f.id] = true;
      f.children.forEach((b: any) => {
        exp[b.id] = true;
      });
    });
    setExpandedNodes(exp);
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm">{t("topo.loading")}</span>
        </div>
      </div>
    );
  }

  // ─── Node Detail Panel Content ────────────────────────────────────────────
  const renderNodeDetail = () => {
    if (!selectedNode) {
      return (
        <div className="text-center py-8 text-xs text-muted-foreground px-2">
          {t("topo.click_hint")}
        </div>
      );
    }

    // OLT root node
    if (selectedNode === "OLT-CO-Central") {
      return (
        <div className="space-y-3 text-xs">
          <div className="font-bold text-sm text-primary">{t("topo.detail_olt")}</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.detail_capacity")}</span>
              <span className="font-semibold">64 {t("topo.lines")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.detail_sectors")}</span>
              <span className="font-semibold">{gponTree.children.length} FDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.subscribers")}</span>
              <span className="font-semibold">{connections.length}</span>
            </div>
          </div>
        </div>
      );
    }

    // FDT node
    if (selectedNode.startsWith("FDT-")) {
      const fdtName = selectedNode.replace("FDT-", "").replace(/-/g, " ");
      const fdtConns = connections.filter((c) => c.fdt === fdtName);
      const fdtNode = gponTree.children.find((f: any) => f.id === selectedNode);
      return (
        <div className="space-y-3 text-xs">
          <div className="font-bold text-sm text-violet-600">{fdtName}</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.detail_type")}</span>
              <span className="font-semibold">{t("topo.detail_fdt")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.detail_pbo_count")}</span>
              <span className="font-semibold">{fdtNode?.children?.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.detail_subscribers")}</span>
              <span className="font-semibold">{fdtConns.length}</span>
            </div>
          </div>
        </div>
      );
    }

    // PORT node (heatmap click)
    if (selectedNode.startsWith("PORT-")) {
      const portId = parseInt(selectedNode.replace("PORT-", ""));
      const port = heatmapGrid.find((p) => p.id === portId);
      if (!port)
        return (
          <div className="text-muted-foreground text-center py-4 text-xs">
            Port introuvable
          </div>
        );
      return (
        <div className="space-y-3 text-xs">
          <div className="font-bold text-sm text-primary">
            {t("topo.port_label")}
            {port.id}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground shrink-0">{t("topo.subscriber")}</span>
              <span className="font-bold text-foreground text-right">
                {port.residence} {port.bloc} Apt {port.appartement}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.floor")}</span>
              <span className="font-semibold">{port.etage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.bpi_box")}</span>
              <span className="font-mono font-bold">{port.pos_bpi}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.parent_fdt")}</span>
              <span className="font-semibold">{port.fdt}</span>
            </div>
          </div>
          <div className="mt-2 border border-border bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">
              {t("topo.link_budget")}
            </span>
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm font-bold">{port.dbm.toFixed(1)} dBm</span>
              <span
                className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                  port.dbm <= -27.0
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : port.dbm <= -23.0
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                }`}
              >
                {port.dbm <= -27.0
                  ? t("topo.bad")
                  : port.dbm <= -23.0
                  ? t("topo.avg")
                  : t("topo.good")}
              </span>
            </div>
            {port.inFault && (
              <div className="text-[10px] text-red-600 font-semibold mt-2 border-t border-red-200/50 pt-2 animate-pulse">
                {t("topo.alert_on_bpi", { bpi: port.pos_bpi })}
              </div>
            )}
          </div>
        </div>
      );
    }

    // BPI node
    if (selectedNode.startsWith("BPI-")) {
      const bpiCode = selectedNode.replace("BPI-", "");
      const bpiConns = connections.filter(
        (c) => normalizeBpi(c.pos_bpi) === bpiCode
      );
      const parentFdt = bpiConns[0]?.fdt ?? "—";
      const bpiAlert = getBpiAlert(bpiCode);

      return (
        <div className="space-y-3 text-xs">
          <div className="font-bold text-sm text-emerald-600">BPI-{bpiCode}</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.detail_parent_fdt")}</span>
              <span className="font-semibold">{parentFdt}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("topo.detail_subscribers")}</span>
              <span className="font-semibold">{bpiConns.length}</span>
            </div>
          </div>
          {bpiAlert ? (
            <div className="mt-1 border border-red-200 bg-red-500/10 p-3 rounded-xl">
              <div
                className={`font-bold text-red-600 flex items-center gap-1.5 ${
                  isRtl ? "flex-row-reverse" : ""
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                {t("topo.alarm_active")}
              </div>
              <div className="text-[11px] text-red-700 dark:text-red-400 mt-1 leading-relaxed">
                {bpiAlert.message}
              </div>
              <div className="text-[10px] text-red-500 mt-1 font-semibold uppercase tracking-wide">
                {bpiAlert.level}
              </div>
            </div>
          ) : (
            <div className="mt-1 border border-emerald-200 bg-emerald-500/10 p-3 rounded-xl">
              <div
                className={`font-bold text-emerald-600 flex items-center gap-1.5 ${
                  isRtl ? "flex-row-reverse" : ""
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                {t("topo.signal_ok")}
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                {t("topo.signal_ok_desc")}
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="h-full w-full overflow-y-auto bg-[#f8fafc] dark:bg-slate-900"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("topo.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("topo.subtitle")}</p>
            {zone !== "Toutes les zones" && (
              <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-full px-2.5 py-0.5">
                <Layers className="h-3 w-3" />
                {zone}
              </span>
            )}
          </div>

          <div
            className={`flex gap-2 flex-wrap items-center ${
              isRtl ? "flex-row-reverse" : ""
            }`}
          >
            {/* New Path button */}
            <button
              onClick={() => setShowNewCheminModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-card px-4 py-2 text-xs font-semibold hover:bg-accent transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {t("topo.new_path")}
            </button>

            {/* Fault analyzer toggle */}
            <button
              onClick={() => {
                const next = !faultAnalyzer;
                setFaultAnalyzer(next);
                if (next) expandAll();
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition duration-200 ${
                faultAnalyzer
                  ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                  : "bg-slate-800 hover:bg-slate-900 shadow-slate-500/10 dark:bg-slate-700 dark:hover:bg-slate-600"
              }`}
            >
              <Zap
                className={`h-4 w-4 ${
                  faultAnalyzer ? "animate-pulse" : ""
                }`}
              />
              {faultAnalyzer ? t("topo.fault_off") : t("topo.fault_on")}
            </button>
          </div>
        </header>

        {/* ── View Tabs ──────────────────────────────────────────────────── */}
        <div
          className={`flex gap-2 mb-5 border-b border-border text-xs ${
            isRtl ? "flex-row-reverse" : ""
          }`}
        >
          <button
            onClick={() => setActiveView("tree")}
            className={`border-b-2 px-4 py-2 font-bold transition ${
              activeView === "tree"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("topo.view_tree")}
          </button>
          <button
            onClick={() => setActiveView("heatmap")}
            className={`border-b-2 px-4 py-2 font-bold transition ${
              activeView === "heatmap"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("topo.view_heatmap")}
          </button>
          <button
            onClick={() => setActiveView("calculator")}
            className={`border-b-2 px-4 py-2 font-bold transition ${
              activeView === "calculator"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("topo.view_calculator")}
          </button>
        </div>

        {/* ── Main content view switch ────────────────────────────────────── */}
        {activeView === "calculator" ? (
          /* ── Link Budget Calculator View ───────────────────────────────── */
          <div className="grid gap-6 md:grid-cols-3 animate-in fade-in duration-200">
            {/* INPUTS COLUMN: 2 Cols */}
            <div className="md:col-span-2 space-y-6">
              {/* Card Container */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
                  <span className="text-sm font-extrabold text-foreground flex items-center gap-2">
                    🎛️ {t("topo.calc_title")}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-6 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-border/80">
                  {t("topo.calc_desc")}
                </p>

                {/* Form Elements */}
                <div className="grid gap-5 sm:grid-cols-2">
                  {/* Left sub-col */}
                  <div className="space-y-4">
                    {/* Wavelength */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        {t("topo.calc_wavelength")}
                      </label>
                      <div className="flex gap-1.5">
                        {(["1310", "1490", "1550"] as const).map((w) => {
                          const isSelected = wavelength === w;
                          const coeff = w === "1310" ? "0.35" : w === "1490" ? "0.25" : "0.22";
                          return (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setWavelength(w)}
                              className={`flex-1 rounded-xl border p-2 text-center transition cursor-pointer ${
                                isSelected
                                  ? "border-primary bg-primary/5 text-primary font-bold shadow-xs"
                                  : "border-border bg-card hover:bg-accent text-muted-foreground"
                              }`}
                            >
                              <div className="text-[11px]">{w} nm</div>
                              <div className="text-[9px] opacity-80 mt-0.5">{coeff} dB/km</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Fiber Distance */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>{t("topo.calc_fiber_len")}</span>
                        <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded text-[10.5px]">
                          {distance.toFixed(2)} km
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="0.1"
                        value={distance}
                        onChange={(e) => setDistance(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[9px] font-semibold text-muted-foreground px-1">
                        <span>0 km</span>
                        <span>10 km</span>
                        <span>20 km</span>
                      </div>
                    </div>

                    {/* Splitter Ratio */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        {t("topo.calc_splitter")}
                      </label>
                      <select
                        value={splitterRatio}
                        onChange={(e: any) => setSplitterRatio(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary transition"
                      >
                        <option value="1:2">1:2 (~3.5 dB)</option>
                        <option value="1:4">1:4 (~6.5 dB)</option>
                        <option value="1:8">1:8 (~10.0 dB)</option>
                        <option value="1:16">1:16 (~13.5 dB)</option>
                        <option value="1:32">1:32 (~17.0 dB)</option>
                        <option value="1:64">1:64 (~20.5 dB)</option>
                      </select>
                    </div>

                    {/* OLT Tx Power */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>{t("topo.calc_tx_power")}</span>
                        <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded text-[10.5px]">
                          {oltTxPower > 0 ? "+" : ""}{oltTxPower.toFixed(1)} dBm
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-5"
                        max="10"
                        step="0.5"
                        value={oltTxPower}
                        onChange={(e) => setOltTxPower(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[9px] font-semibold text-muted-foreground px-1">
                        <span>-5 dBm</span>
                        <span>+2 dBm</span>
                        <span>+10 dBm</span>
                      </div>
                    </div>
                  </div>

                  {/* Right sub-col */}
                  <div className="space-y-4">
                    {/* Splice count */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>{t("topo.calc_splices")} (0.1 dB)</span>
                        <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded text-[10.5px]">
                          {spliceCount}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={spliceCount}
                        onChange={(e) => setSpliceCount(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[9px] font-semibold text-muted-foreground px-1">
                        <span>0</span>
                        <span>10</span>
                        <span>20</span>
                      </div>
                    </div>

                    {/* Connector count */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>{t("topo.calc_connectors")} (0.25 dB)</span>
                        <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded text-[10.5px]">
                          {connectorCount}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={connectorCount}
                        onChange={(e) => setConnectorCount(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[9px] font-semibold text-muted-foreground px-1">
                        <span>0</span>
                        <span>5</span>
                        <span>10</span>
                      </div>
                    </div>

                    {/* Margin */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>{t("topo.calc_margin")}</span>
                        <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded text-[10.5px]">
                          {margin.toFixed(1)} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.5"
                        value={margin}
                        onChange={(e) => setMargin(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[9px] font-semibold text-muted-foreground px-1">
                        <span>0 dB</span>
                        <span>2.5 dB</span>
                        <span>5 dB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* DIAGNOSTICS & POWER METER COLUMN: 1 Col */}
            <div className="space-y-6">
              {/* Rx Power Meter Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-2 mb-4">
                    🔌 {t("topo.calc_status")}
                  </h2>

                  <div className="flex flex-col items-center py-4 relative">
                    {/* Glowing Liquid Rx Power Meter Display */}
                    <div className="relative w-full max-w-[200px] aspect-video flex flex-col items-center justify-center bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-inner overflow-hidden dark:bg-slate-950">
                      {/* Grid Background Lines for Tech Feel */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.3)_1px,transparent_1px)] bg-[size:10px_10px]" />
                      
                      {/* Active Status Color Bar */}
                      <div className={`absolute bottom-0 left-0 right-0 top-0 opacity-10 transition-colors duration-300 ${
                        rxPower >= -22.0
                          ? "bg-emerald-500"
                          : rxPower >= -27.0
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`} />

                      {/* Dynamic Reading */}
                      <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase z-10">
                        {t("topo.calc_rx_power")}
                      </span>
                      <span className={`text-2xl font-mono font-extrabold tracking-tight mt-1.5 tabular-nums transition-colors duration-300 z-10 ${
                        rxPower >= -22.0
                          ? "text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                          : rxPower >= -27.0
                          ? "text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.35)]"
                          : "text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                      }`}>
                        {rxPower.toFixed(2)} dBm
                      </span>

                      {/* Total Loss Display */}
                      <span className="text-[9px] text-slate-500 font-bold uppercase mt-2 tracking-wide z-10">
                        {t("topo.calc_total_loss")}: <span className="font-mono text-slate-300">{totalLoss.toFixed(2)} dB</span>
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="mt-5 w-full text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase shadow-sm ${
                        rxPower >= -22.0
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800"
                          : rxPower >= -27.0
                          ? "bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
                          : "bg-red-50 text-red-750 border border-red-200/50 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800"
                      }`}>
                        {rxPower >= -22.0 ? (
                          <>🟢 {t("topo.good")}</>
                        ) : rxPower >= -27.0 ? (
                          <>🟡 {t("topo.avg")}</>
                        ) : (
                          <>🔴 {t("topo.bad")}</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Loss Breakdown Subcard */}
                <div className="mt-4 border border-border bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-3">
                  <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider block">
                    📈 {t("topo.calc_diagram")}
                  </span>
                  
                  {/* Loss Bars Breakdown */}
                  <div className="space-y-2 text-[10.5px] font-semibold text-foreground">
                    {/* Fiber Loss */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono">
                        <span className="text-muted-foreground">Fibre ({distance.toFixed(1)} km)</span>
                        <span>-{fiberLoss.toFixed(2)} dB</span>
                      </div>
                      <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (fiberLoss / Math.max(0.1, totalLoss)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Splitter Loss */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono">
                        <span className="text-muted-foreground">Couplage Splitter ({splitterRatio})</span>
                        <span>-{splitterLoss.toFixed(1)} dB</span>
                      </div>
                      <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (splitterLoss / Math.max(0.1, totalLoss)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Splices/Soudures Loss */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono">
                        <span className="text-muted-foreground">Soudures ({spliceCount})</span>
                        <span>-{(spliceCount * 0.1).toFixed(2)} dB</span>
                      </div>
                      <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((spliceCount * 0.1) / Math.max(0.1, totalLoss)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Connectors Loss */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono">
                        <span className="text-muted-foreground">Connecteurs ({connectorCount})</span>
                        <span>-{(connectorCount * 0.25).toFixed(2)} dB</span>
                      </div>
                      <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((connectorCount * 0.25) / Math.max(0.1, totalLoss)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Margin Loss */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono">
                        <span className="text-muted-foreground">Marge de garde</span>
                        <span>-{margin.toFixed(2)} dB</span>
                      </div>
                      <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (margin / Math.max(0.1, totalLoss)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Advisor Plan d'Action Panel */}
                <div className="mt-4 border border-border bg-card p-4 rounded-2xl space-y-2">
                  <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider block">
                    📋 Plan d'Action / Conseil Technique
                  </span>
                  
                  {rxPower >= -22.0 ? (
                    <div className="text-[11px] text-emerald-700 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 leading-relaxed dark:text-emerald-400 font-medium">
                      🚀 <strong>Route validée !</strong> L'atténuation de {totalLoss.toFixed(2)} dB est tout à fait conforme aux normes GPON de SOTETEL. Le niveau de signal est idéal pour assurer le débit optimal sans saturation. Aucun correctif requis.
                    </div>
                  ) : rxPower >= -27.0 ? (
                    <div className="text-[11px] text-amber-700 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-1.5 dark:text-amber-400 leading-relaxed font-medium">
                      ⚠️ <strong>Signal Marginal détecté.</strong> Pour fiabiliser la liaison et éviter les coupures intermittentes :
                      <ul className="list-disc pl-4 space-y-0.5 mt-1 font-semibold text-[10.5px]">
                        <li>Nettoyer minutieusement les têtes de connecteurs optiques SC/APC.</li>
                        <li>Privilégier la longueur d'onde de <strong>1550 nm</strong> si possible.</li>
                        <li>Contrôler la qualité des cassettes de soudures optiques.</li>
                      </ul>
                    </div>
                  ) : (
                    <div className="text-[11px] text-red-700 bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-1.5 dark:text-red-400 leading-relaxed font-medium">
                      🛑 <strong>Échec : Signal Hors-Ligne !</strong> L'affaiblissement est trop fort pour le transceiver. Solutions requises :
                      <ul className="list-disc pl-4 space-y-0.5 mt-1 font-semibold text-[10.5px]">
                        <li>Réduire le ratio de couplage du Splitter (ex: passer de 1:32 à 1:16 pour gagner ~3.5 dB).</li>
                        <li>Changer la longueur d'onde de service vers <strong>1550 nm</strong> (atténuation minimale).</li>
                        <li>Raccourcir la distance de fibre ou utiliser une route plus directe.</li>
                        <li>Remplacer les connecteurs manuels par des épissures fusionnées (soudures).</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Original Tree / Heatmap grid ───────────────────────────────── */
          <div className="grid gap-6 md:grid-cols-3">
            {/* LEFT: Tree / Heatmap panel (2 cols) */}
            <div className="md:col-span-2 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              {activeView === "tree" ? (
                /* ── Tree View ───────────────────────────────────────────── */
                <div className="p-5">
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">
                    {t("topo.view_tree")}
                  </h2>
                  <div className="space-y-1.5 text-xs select-none">
                    {/* OLT root */}
                    <div className="flex flex-col">
                      <div
                        onClick={() => setSelectedNode(gponTree.id)}
                        className={`flex items-center justify-between rounded-xl p-2.5 cursor-pointer border transition ${
                          selectedNode === gponTree.id
                            ? "bg-blue-50/60 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
                            : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div
                          className={`flex items-center gap-2 ${
                            isRtl ? "flex-row-reverse" : ""
                          }`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(gponTree.id);
                            }}
                            className="text-muted-foreground p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            {expandedNodes[gponTree.id] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <GitBranch className="h-4 w-4 text-blue-500" />
                          <span className="font-bold text-foreground">
                            {gponTree.name}
                          </span>
                        </div>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-semibold uppercase tracking-wider tabular-nums">
                          {connections.length} {t("topo.subscribers")}
                        </span>
                      </div>

                      {/* FDT level */}
                      {expandedNodes[gponTree.id] && (
                        <div
                          className={`${
                            isRtl ? "pr-6 border-r-2" : "pl-6 border-l-2"
                          } mt-1 border-dashed border-slate-200 dark:border-slate-700 space-y-1.5`}
                        >
                          {gponTree.children.length === 0 && (
                            <div className="py-4 text-center text-[11px] text-muted-foreground italic">
                              {zone !== "Toutes les zones"
                                ? `Aucun FDT trouvé pour "${zone}"`
                                : "Aucune connexion disponible."}
                            </div>
                          )}
                          {gponTree.children.map((fdt: any) => (
                            <div key={fdt.id} className="flex flex-col">
                              <div
                                onClick={() => setSelectedNode(fdt.id)}
                                className={`flex items-center justify-between rounded-xl p-2.5 cursor-pointer border transition ${
                                  selectedNode === fdt.id
                                    ? "bg-violet-50/60 border-violet-200 dark:bg-violet-950/20 dark:border-violet-800"
                                    : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                }`}
                              >
                                <div
                                  className={`flex items-center gap-2 ${
                                    isRtl ? "flex-row-reverse" : ""
                                  }`}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpand(fdt.id);
                                    }}
                                    className="text-muted-foreground p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                  >
                                    {expandedNodes[fdt.id] ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                  <Layers className="h-4 w-4 text-violet-500" />
                                  <span className="font-semibold text-foreground">
                                    {fdt.name}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {fdt.children.length} {t("topo.pbo_boxes")}
                                </span>
                              </div>

                              {/* BPI level */}
                              {expandedNodes[fdt.id] && (
                                <div
                                  className={`${
                                    isRtl ? "pr-6 border-r-2" : "pl-6 border-l-2"
                                  } mt-1 border-dashed border-slate-200 dark:border-slate-700 space-y-1`}
                                >
                                  {fdt.children.map((bpi: any) => {
                                    const alert = getBpiAlert(bpi.name);
                                    const isFaulty = faultAnalyzer && !!alert;
                                    const borderClass = isFaulty
                                      ? "border-red-200 bg-red-50/40 hover:bg-red-50/60 shadow-sm shadow-red-500/5 animate-pulse dark:bg-red-950/20 dark:border-red-800"
                                      : selectedNode === bpi.id
                                      ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                                      : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50";

                                    return (
                                      <div
                                        key={bpi.id}
                                        onClick={() => setSelectedNode(bpi.id)}
                                        className={`flex items-center justify-between rounded-xl p-2.5 cursor-pointer border transition ${borderClass}`}
                                      >
                                        <div
                                          className={`flex items-center gap-2 ${
                                            isRtl ? "flex-row-reverse" : ""
                                          }`}
                                        >
                                          <Activity
                                            className={`h-4 w-4 ${
                                              isFaulty
                                                ? "text-red-500"
                                                : "text-emerald-500"
                                            }`}
                                          />
                                          <span
                                            className={`font-semibold ${
                                              isFaulty
                                                ? "text-red-600 dark:text-red-400"
                                                : "text-foreground"
                                            }`}
                                          >
                                            BPI-{bpi.name}
                                          </span>
                                          {isFaulty && (
                                            <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                                          )}
                                        </div>
                                        <div
                                          className={`flex items-center gap-2 ${
                                            isRtl ? "flex-row-reverse" : ""
                                          }`}
                                        >
                                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-semibold tabular-nums">
                                            {bpi.apartments.length}{" "}
                                            {t("topo.lines")}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Heatmap View ─────────────────────────────────────────── */
                <div className="p-5 space-y-4 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {t("topo.heatmap_title")}
                      </h2>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t("topo.heatmap_desc", { n: connections.length })}
                      </p>
                    </div>
                    <div
                      className={`flex items-center gap-3 text-[10px] font-bold text-slate-500 flex-wrap ${
                        isRtl ? "flex-row-reverse" : ""
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
                        {t("topo.good")} &gt; -22 dBm
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded bg-amber-500" />
                        {t("topo.avg")} -23 à -26
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded bg-red-500" />
                        {t("topo.bad")} &lt; -27
                      </span>
                    </div>
                  </div>

                  {heatmapGrid.length === 0 ? (
                    <div className="text-center py-10 text-xs text-muted-foreground">
                      {zone !== "Toutes les zones"
                        ? `Aucune connexion dans la zone "${zone}"`
                        : "Aucune donnée disponible."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5 max-h-80 overflow-y-auto pr-1">
                      {heatmapGrid.map((port, idx) => {
                        const colorClass =
                          port.dbm <= -27.0
                            ? "bg-red-500 text-white shadow-sm shadow-red-500/25 animate-pulse"
                            : port.dbm <= -23.0
                            ? "bg-amber-500 text-slate-900 shadow-sm shadow-amber-500/15"
                            : "bg-emerald-500 text-white shadow-sm shadow-emerald-500/15";
                        return (
                          <button
                            key={port.id ?? idx}
                            type="button"
                            onClick={() => setSelectedNode(`PORT-${port.id}`)}
                            className={`aspect-square rounded flex items-center justify-center font-bold text-[9px] font-mono cursor-pointer transition hover:scale-110 hover:z-10 ${colorClass}`}
                            title={`${port.residence} Apt ${port.appartement} — ${port.dbm.toFixed(1)} dBm`}
                          >
                            {port.dbm <= -27.0
                              ? "❌"
                              : `${Math.abs(port.dbm).toFixed(0)}`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: Detail panel + Stats panel */}
            <div className="flex flex-col gap-4">
              {/* Node detail */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-2 mb-4">
                  {t("topo.node_title")}
                </h2>
                {renderNodeDetail()}
              </div>

              {/* Stats mini-panel */}
              <StatsMiniPanel
                connections={connections}
                alerts={activeAlerts}
                zone={zone}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Impact badge ─────────────────────────────────────────────────── */}
      {faultAnalyzer && totalImpact > 0 && (
        <div
          className={`fixed bottom-6 z-[1000] flex items-center gap-2.5 rounded-2xl bg-red-600 text-white px-5 py-3.5 shadow-xl shadow-red-500/30 animate-bounce ${
            isRtl ? "left-6" : "right-6"
          }`}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold leading-none">
              {t("topo.impact")}
            </div>
            <div className="text-base font-bold tabular-nums mt-0.5">
              {t("topo.impact_clients", { n: totalImpact })}
            </div>
          </div>
        </div>
      )}

      {/* ── New Chemin Modal ──────────────────────────────────────────────── */}
      <NewCheminModal
        isOpen={showNewCheminModal}
        onClose={() => setShowNewCheminModal(false)}
        fdts={uniqueFdts}
      />
    </div>
  );
}
