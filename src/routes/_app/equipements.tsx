import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Cpu,
  Layers,
  MapPin,
  Search,
  Plus,
  X,
  Database,
  Trash2,
  Info,
} from "lucide-react";
import { sqliteQuery, sqliteExecute } from "@/lib/sqlite-client";
import { useApp } from "@/hooks/use-app";

export const Route = createFileRoute("/_app/equipements")({
  head: () => ({ meta: [{ title: "Equipment Directory — FiberTrack IQ" }] }),
  component: EquipmentsPage,
  ssr: false,
});

function EquipmentsPage() {
  const { lang, zone, t } = useApp();
  const isRtl = lang === "ar";

  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"All" | "OLT" | "FDT" | "BPI">("All");
  const [search, setSearch] = useState("");
  
  // Modals / Drawers
  const [newOpen, setNewOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"specs" | "splice" | "label">("specs");
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // When opening details, reset active tab
  useEffect(() => {
    if (detailItem) setDetailTab("specs");
  }, [detailItem]);

  // New Equipment fields
  const [eqName, setEqName] = useState("");
  const [eqType, setEqType] = useState<"OLT" | "FDT" | "BPI">("BPI");
  const [eqGps, setEqGps] = useState("");
  const [eqParent, setEqParent] = useState("");

  const loadData = async () => {
    try {
      const data = await sqliteQuery("SELECT * FROM connections");
      setConnections(data);
      setLoading(false);
    } catch (e: any) {
      toast.error("Failed to load equipments: " + e.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Zone filter
  const filteredConnections = useMemo(() => {
    if (zone === "Toutes les zones") return connections;
    return connections.filter(
      (c) => c.fdt === zone || c.residence === zone
    );
  }, [connections, zone]);

  // Parse distinct hardware assets from zone-filtered connections
  const olts = useMemo(() => {
    const map = new Map<string, any>();
    filteredConnections.forEach((c) => {
      if (c.port_olt) {
        const id = `OLT-${c.port_olt}`;
        if (!map.has(id)) {
          map.set(id, {
            id,
            name: `OLT Port ${c.port_olt}`,
            type: "OLT",
            card: c.port_carte_gpon || "GPON-0",
            subscribers: filteredConnections.filter((x) => x.port_olt === c.port_olt).length,
            parent: "Central Office Soukra"
          });
        }
      }
    });
    return Array.from(map.values());
  }, [filteredConnections]);

  const fdts = useMemo(() => {
    const map = new Map<string, any>();
    filteredConnections.forEach((c) => {
      if (c.fdt) {
        const id = `FDT-${c.fdt.replace(/\s+/g, "-")}`;
        if (!map.has(id)) {
          map.set(id, {
            id,
            name: c.fdt,
            type: "FDT",
            gps: c.gps_fdt || "36.8643276, 10.2167956",
            subscribers: filteredConnections.filter((x) => x.fdt === c.fdt).length,
            parent: c.residence || "SOUKRA"
          });
        }
      }
    });
    return Array.from(map.values());
  }, [filteredConnections]);

  const bpis = useMemo(() => {
    const map = new Map<string, any>();
    filteredConnections.forEach((c) => {
      if (c.pos_bpi) {
        const id = `BPI-${c.pos_bpi}`;
        if (!map.has(id)) {
          map.set(id, {
            id,
            name: c.pos_bpi,
            type: "BPI",
            gps: c.gps_bpi || "36.8671225, 10.2253475",
            subscribers: filteredConnections.filter((x) => x.pos_bpi === c.pos_bpi).length,
            parent: c.fdt || "UMA SOUKRA"
          });
        }
      }
    });
    return Array.from(map.values());
  }, [filteredConnections]);

  const allEquipments = useMemo(() => {
    return [...olts, ...fdts, ...bpis];
  }, [olts, fdts, bpis]);

  const filtered = useMemo(() => {
    return allEquipments.filter((eq) => {
      const tMatch = tab === "All" || eq.type === tab;
      const qMatch =
        !search.trim() ||
        eq.name.toLowerCase().includes(search.toLowerCase()) ||
        eq.parent.toLowerCase().includes(search.toLowerCase()) ||
        (eq.card && eq.card.toLowerCase().includes(search.toLowerCase()));
      return tMatch && qMatch;
    });
  }, [allEquipments, tab, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqName.trim()) return;

    try {
      let res;
      if (eqType === "OLT") {
        res = await sqliteExecute(
          "INSERT INTO connections (appartement, bloc, port_olt, port_carte_gpon) VALUES ('New OLT', 'M', ?, ?)",
          [eqName.trim(), eqParent.trim() || "GPON-1"]
        );
      } else if (eqType === "FDT") {
        res = await sqliteExecute(
          "INSERT INTO connections (appartement, bloc, fdt, gps_fdt, residence) VALUES ('Cabinet', 'C', ?, ?, ?)",
          [eqName.trim(), eqGps.trim() || "36.8643276, 10.2167956", eqParent.trim() || "Kamilia"]
        );
      } else {
        res = await sqliteExecute(
          "INSERT INTO connections (appartement, bloc, pos_bpi, gps_bpi, fdt) VALUES ('BPI', 'B', ?, ?, ?)",
          [eqName.trim(), eqGps.trim() || "36.8671225, 10.2253475", eqParent.trim() || "UMA SOUKRA"]
        );
      }

      if (res.success) {
        toast.success(t("alerts.create_success"));
        setNewOpen(false);
        setEqName("");
        setEqGps("");
        setEqParent("");
        loadData();
      }
    } catch (err: any) {
      toast.error("Failed to add equipment: " + err.message);
    }
  };

  const handleDelete = async (eq: any) => {
    const confirmDelete = window.confirm(
      lang === "ar"
        ? `هل تريد حذف الجهاز "${eq.name}"؟`
        : `Voulez-vous supprimer l'équipement "${eq.name}" ?`
    );
    if (!confirmDelete) return;

    try {
      let sql = "";
      let params = [];
      let unlinkSql = "";
      let unlinkParams = [];
      
      if (eq.type === "OLT") {
        const cleanName = eq.name.replace("OLT Port ", "");
        sql = "DELETE FROM connections WHERE port_olt = ? AND appartement = 'New OLT'";
        params = [cleanName];
        unlinkSql = "UPDATE connections SET port_olt = NULL, port_carte_gpon = NULL WHERE port_olt = ?";
        unlinkParams = [cleanName];
      } else if (eq.type === "FDT") {
        sql = "DELETE FROM connections WHERE fdt = ? AND appartement = 'Cabinet'";
        params = [eq.name];
        unlinkSql = "UPDATE connections SET fdt = NULL, gps_fdt = NULL WHERE fdt = ?";
        unlinkParams = [eq.name];
      } else {
        sql = "DELETE FROM connections WHERE pos_bpi = ? AND appartement = 'BPI'";
        params = [eq.name];
        unlinkSql = "UPDATE connections SET pos_bpi = NULL, gps_bpi = NULL WHERE pos_bpi = ?";
        unlinkParams = [eq.name];
      }

      await sqliteExecute(sql, params);
      const res = await sqliteExecute(unlinkSql, unlinkParams);
      if (res.success) {
        toast.success(
          lang === "ar"
            ? "تمت إزالة الجهاز بأمان دون حذف المشتركين."
            : "Equipment safely disassociated from database without deleting subscribers."
        );
        loadData();
      }
    } catch (err: any) {
      toast.error("Deletion failed: " + err.message);
    }
  };

  const handleExportExcel = () => {
    toast.loading(isRtl ? "جاري تحضير ملف الإكسل..." : "Préparation du fichier Excel...", { id: "export-loading" });
    const a = document.createElement("a");
    a.href = "/api/equipments/export";
    a.download = "FTTH_Equipements.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      toast.dismiss("export-loading");
      toast.success(isRtl ? "تم تحميل ملف الإكسل بنجاح!" : "Fichier Excel téléchargé avec succès !");
    }, 1200);
  };

  const handleImportExcel = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64String = window.btoa(binary);
        
        const res = await fetch("/api/equipments/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileData: base64String })
        });
        
        const payload = await res.json();
        setImporting(false);
        
        if (payload.success) {
          toast.success(
            isRtl
              ? `تم الاستيراد بنجاح! إضافة: ${payload.olt_added} OLT, ${payload.fdt_added} FDT, ${payload.bpi_added} PBO. تحديث: ${payload.fdt_updated} FDT, ${payload.bpi_updated} PBO.`
              : `Importation réussie ! Ajoutés : ${payload.olt_added} OLT, ${payload.fdt_added} FDT, ${payload.bpi_added} PBO. Mis à jour : ${payload.fdt_updated} FDT, ${payload.bpi_updated} PBO.`
          );
          setImportOpen(false);
          loadData();
        } else {
          toast.error("Import error: " + (payload.error || "Unknown error"));
        }
      } catch (err: any) {
        setImporting(false);
        toast.error("Import failed: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(() => {
    sqliteQuery("SELECT pos_bpi FROM alerts WHERE status != 'Resolved'")
      .then(data => setAlerts(data))
      .catch(() => {});
  }, [connections]);

  const activeAlertBpis = useMemo(() => new Set(alerts.map(a => a.pos_bpi).filter(Boolean)), [alerts]);

  return (
    <main
      className="h-full w-full overflow-y-auto bg-[#f8fafc] dark:bg-slate-900 p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-5xl">
        
        {/* Main Card Wrapper */}
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm dark:bg-slate-950 dark:border-slate-800 animate-in fade-in duration-200">
          
          {/* Top Controls Row */}
          <div className={`flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 mb-6 ${isRtl ? "xl:flex-row-reverse" : ""}`}>
            
            {/* Search + Add Group */}
            <div className={`flex-1 flex flex-wrap items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div className="relative flex-1 min-w-[200px]">
                <Search className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground`} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("equip.search_ph")}
                  className={`w-full rounded-xl border border-input bg-background py-2 ${isRtl ? "pr-9 pl-3" : "pl-9 pr-3"} text-xs outline-none focus:ring-1 focus:ring-primary`}
                />
              </div>
              <button
                onClick={() => setNewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 text-xs font-bold shadow-sm transition whitespace-nowrap"
              >
                {t("equip.add")}
              </button>
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-3 py-2 text-xs font-bold shadow-sm transition whitespace-nowrap"
              >
                📥 {isRtl ? "تصدير إكسل" : "Exporter Excel"}
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-3 py-2 text-xs font-bold shadow-sm transition whitespace-nowrap"
              >
                📤 {isRtl ? "استيراد إكسل" : "Importer Excel"}
              </button>
            </div>

            {/* Scan Rapide Green Pill */}
            <button
              onClick={() => setScanOpen(true)}
              className={`flex items-center justify-between bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-2xl gap-3 shadow-md shadow-emerald-500/10 transition shrink-0 cursor-pointer ${isRtl ? "text-right flex-row-reverse" : "text-left"} border-none outline-none`}
            >
              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <div className="text-lg font-bold">📷</div>
                <div className={`leading-tight ${isRtl ? "text-right" : "text-left"}`}>
                  <div className="text-[10px] font-extrabold uppercase tracking-wide">{t("equip.scan_title")}</div>
                  <div className="text-[9px] opacity-90 font-medium">{t("equip.scan_desc")}</div>
                </div>
              </div>
              <div
                className="bg-white/20 p-1.5 rounded-lg text-white"
                title={t("equip.scan_title")}
              >
                📷
              </div>
            </button>

          </div>

          {/* Quick Filter Tabs */}
          <div className={`flex gap-1.5 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3 text-xs ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="text-muted-foreground flex items-center mr-2 ml-2">{t("equip.filter_type")}</span>
            {(["All", "OLT", "FDT", "BPI"] as const).map((tVal) => (
              <button
                key={tVal}
                onClick={() => setTab(tVal)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                  tab === tVal
                    ? "bg-slate-100 dark:bg-slate-800 text-foreground"
                    : "text-muted-foreground hover:bg-accent/40"
                }`}
              >
                {tVal === "All" ? t("equip.filter_all") : tVal === "BPI" ? "PBO / BPI" : tVal}
              </button>
            ))}
          </div>

          {/* Equipments Table */}
          {loading ? (
            <div className="text-center py-10 text-xs text-muted-foreground">{t("equip.loading")}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-xs" dir={isRtl ? "rtl" : "ltr"}>
                <thead className="bg-[#f8fafc] text-muted-foreground font-bold uppercase tracking-wider text-[10px] dark:bg-slate-900 border-b border-border">
                  <tr>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("equip.col_serial")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("equip.col_name")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("equip.col_type")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("equip.col_manufacturer")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("equip.col_zone")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("equip.col_status")}</th>
                    <th className="px-4 py-3 text-center">{t("equip.col_actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((eq) => {
                    const isOlt = eq.type === "OLT";
                    const isFdt = eq.type === "FDT";
                    
                    const serial = isOlt
                      ? `SN-OLT-HW-${eq.name.replace("OLT Port ", "00")}`
                      : isFdt
                      ? `SN-FDT-CN-${eq.name.slice(-4).replace(/\s+/g, "")}`
                      : `SN-PBO-ZT-${eq.name.replace("BPI-", "")}`;

                    const manufacturer = isOlt
                      ? "Huawei GPON"
                      : isFdt
                      ? "Corning Fiber"
                      : "ZTE Telecom";

                    const inFault = eq.type === "BPI" && activeAlertBpis.has(eq.name);
                    const statusText = inFault ? t("equip.status_fault") : t("equip.status_active");
                    const statusColor = inFault
                      ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400";

                    return (
                      <tr key={eq.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                        <td className={`px-4 py-3 font-mono font-bold text-primary text-[10px] whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>
                          {serial}
                        </td>
                        <td className={`px-4 py-3 font-bold text-foreground truncate whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>
                          {eq.name}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>
                          <span className="text-[10px] font-semibold bg-accent px-2 py-0.5 rounded text-muted-foreground uppercase">
                            {eq.type === "BPI" ? "PBO Box" : eq.type}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-muted-foreground whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>
                          {manufacturer}
                        </td>
                        <td className={`px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 truncate whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>
                          {eq.parent}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${statusColor}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${inFault ? "bg-red-500 animate-ping" : "bg-emerald-500"}`} />
                            {statusText}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1.5 justify-center items-center">
                            <button
                              onClick={() => setDetailItem(eq)}
                              className="rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 p-1.5 text-muted-foreground hover:text-foreground transition"
                              title="Informations"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(eq)}
                              className="rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 transition"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                        {t("equip.no_equip")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination bar */}
          <div className={`mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-muted-foreground ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
              <span>{t("alerts.per_page")}</span>
              <select className="bg-transparent border border-input rounded p-0.5 text-xs outline-none">
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
            </div>
            <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
              <span>
                1-{filtered.length} de {filtered.length}
              </span>
              <div className="flex gap-2">
                <button disabled className="p-1.5 rounded-lg border border-border opacity-50 cursor-not-allowed">❮</button>
                <button disabled className="p-1.5 rounded-lg border border-border opacity-50 cursor-not-allowed">❯</button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Equipment Detailed Drawer Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className="font-bold text-xs uppercase text-primary tracking-wide">{t("equip.modal_detail_title")}</h3>
              <button
                onClick={() => setDetailItem(null)}
                className="rounded-md p-1 hover:bg-accent text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Drawer Tabs */}
            <div className="flex gap-2 border-b border-border pb-px mb-4 text-xs">
              <button
                type="button"
                onClick={() => setDetailTab("specs")}
                className={`flex-1 border-b-2 pb-2 font-bold text-center transition ${
                  detailTab === "specs"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("equip.tab_specs")}
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("splice")}
                className={`flex-1 border-b-2 pb-2 font-bold text-center transition ${
                  detailTab === "splice"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("equip.tab_splice")}
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("label")}
                className={`flex-1 border-b-2 pb-2 font-bold text-center transition ${
                  detailTab === "label"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                🖨️ Sticker QR
              </button>
            </div>
            
            {detailTab === "specs" ? (
              <div className="space-y-3.5 text-xs text-foreground animate-in fade-in duration-150">
                <div className={`flex justify-between border-b border-border/40 pb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-muted-foreground">{t("equip.detail_name")}</span>
                  <span className="font-bold">{detailItem.name}</span>
                </div>
                <div className={`flex justify-between border-b border-border/40 pb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-muted-foreground">{t("equip.detail_type")}</span>
                  <span className="font-bold bg-primary/10 px-2 py-0.5 rounded text-primary uppercase text-[10px]">
                    {detailItem.type === "BPI" ? "PBO (Distribution Box)" : detailItem.type}
                  </span>
                </div>
                <div className={`flex justify-between border-b border-border/40 pb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-muted-foreground">{t("equip.detail_parent")}</span>
                  <span className="font-bold">{detailItem.parent}</span>
                </div>
                {detailItem.gps && (
                  <div className={`flex justify-between border-b border-border/40 pb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <span className="text-muted-foreground">{t("equip.detail_gps")}</span>
                    <span className={`font-mono font-bold text-primary flex items-center gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <MapPin className="h-3.5 w-3.5" /> {detailItem.gps}
                    </span>
                  </div>
                )}
                <div className={`flex justify-between pb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-muted-foreground">{t("equip.detail_subscribers")}</span>
                  <span className="font-bold text-emerald-600">{t("equip.detail_subscribers_count", { n: detailItem.subscribers })}</span>
                </div>
              </div>
            ) : detailTab === "splice" ? (
              <div className="animate-in fade-in duration-150">
                <SpliceCassette equipment={detailItem} t={t} isRtl={isRtl} />
              </div>
            ) : (
              <div className="animate-in fade-in duration-150">
                <AssetLabelCard equipment={detailItem} t={t} isRtl={isRtl} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add New Equipment Modal */}
      {newOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className={`font-bold text-xs uppercase text-foreground tracking-wide flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <Plus className="h-4.5 w-4.5 text-primary" /> {t("equip.modal_add_title")}
              </h3>
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="rounded-md p-1 hover:bg-accent text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-right">
              <div className="grid grid-cols-2 gap-3">
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{t("equip.field_type")}</label>
                  <select
                    value={eqType}
                    onChange={(e: any) => setEqType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="OLT">OLT (Optical Terminal)</option>
                    <option value="FDT">FDT (Cabinet)</option>
                    <option value="BPI">BPI / PBO Box</option>
                  </select>
                </div>
                
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{t("equip.field_name")}</label>
                  <input
                    required
                    placeholder={eqType === "OLT" ? "e.g. 1" : eqType === "FDT" ? "e.g. FDT-Soukra-G" : "e.g. BPI-A8"}
                    value={eqName}
                    onChange={(e) => setEqName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                  />
                </div>
              </div>

              {eqType !== "OLT" && (
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{t("equip.field_gps")}</label>
                  <input
                    placeholder={eqType === "FDT" ? "e.g. 36.8643, 10.2167" : "e.g. 36.8671, 10.2253"}
                    value={eqGps}
                    onChange={(e) => setEqGps(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              )}

              <div className={isRtl ? "text-right" : "text-left"}>
                <label className="text-xs font-semibold text-muted-foreground">
                  {eqType === "OLT" ? t("equip.field_parent_olt") : eqType === "FDT" ? t("equip.field_parent_fdt") : t("equip.field_parent_bpi")}
                </label>
                <input
                  placeholder={eqType === "OLT" ? "e.g. GPON-1" : eqType === "FDT" ? "e.g. Kamilia" : "e.g. UMA SOUKRA"}
                  value={eqParent}
                  onChange={(e) => setEqParent(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/10 transition"
            >
              {t("equip.btn_submit")}
            </button>
          </form>
        </div>
      )}

      {scanOpen && (
        <EquipmentScanner
          equipments={allEquipments}
          onClose={() => setScanOpen(false)}
          onResult={(eq) => {
            setDetailItem(eq);
            setScanOpen(false);
            toast.success(
              lang === "ar"
                ? `تم التعرف على الجهاز "${eq.name}"!`
                : `Équipement "${eq.name}" identifié !`
            );
          }}
          t={t}
          isRtl={isRtl}
        />
      )}

      {importOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
            <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className="font-bold text-sm text-foreground tracking-wide flex items-center gap-2">
                📤 {isRtl ? "استيراد ملف إكسل" : "Importer Classeur Excel"}
              </h3>
              <button onClick={() => setImportOpen(false)} className="rounded-md p-1 hover:bg-accent text-muted-foreground transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {importing ? (
              <div className="py-10 flex flex-col items-center justify-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                <p className="text-xs text-muted-foreground font-semibold">
                  {isRtl ? "جاري معالجة وتحديث قاعدة البيانات..." : "Importation et mise à jour de la base de données…"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-500/5 transition cursor-pointer"
                  onClick={() => document.getElementById("excel-file-input")?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleImportExcel(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-xs font-bold text-foreground mb-1">
                    {isRtl ? "اسحب وأسقط ملف الإكسل هنا" : "Glissez-déposez votre fichier Excel ici"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isRtl ? "ملفات .xlsx أو .xls فقط (الحد الأقصى 10 ميجا)" : "Fichiers .xlsx ou .xls uniquement (max. 10 Mo)"}
                  </p>
                  <input
                    id="excel-file-input"
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImportExcel(e.target.files[0]);
                      }
                    }}
                  />
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border p-3 text-[11px] text-muted-foreground leading-relaxed">
                  💡 <strong>{isRtl ? "تنبيه فني :" : "Astuce :"}</strong> {isRtl 
                    ? "يجب أن يحتوي الملف على أعمدة: النوع (OLT, FDT, BPI)، الاسم، والمنطقة، والإحداثيات. سيتم دمج العناصر وتحديثها تلقائيًا." 
                    : "Le fichier doit avoir des colonnes valides : Type (OLT, FDT, BPI), Nom, Parent, et Coordonnées GPS. La fusion s'opère automatiquement."}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function EquipmentScanner({
  equipments,
  onClose,
  onResult,
  t,
  isRtl,
}: {
  equipments: any[];
  onClose: () => void;
  onResult: (eq: any) => void;
  t: (k: string) => string;
  isRtl: boolean;
}) {
  const [manual, setManual] = useState("");

  const handleManualSearch = () => {
    if (!manual.trim()) return;
    const eq = equipments.find(
      (e) =>
        e.name.toLowerCase() === manual.trim().toLowerCase() ||
        `SN-OLT-HW-${e.name.replace("OLT Port ", "00")}`.toLowerCase() === manual.trim().toLowerCase() ||
        `SN-PBO-ZT-${e.name.replace("BPI-", "")}`.toLowerCase() === manual.trim().toLowerCase() ||
        `SN-FDT-CN-${e.name.slice(-4).replace(/\s+/g, "")}`.toLowerCase() === manual.trim().toLowerCase()
    );
    if (eq) {
      onResult(eq);
    } else {
      toast.error(
        isRtl
          ? `لم يتم العثور على أي جهاز يطابق الرمز "${manual}"`
          : `Aucun équipement correspondant au code "${manual}"`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
          <h3 className={`font-bold text-xs uppercase text-foreground tracking-wide flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            📷 {t("equip.scanner_title")}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Animated simulation scan frame */}
        <div className="relative overflow-hidden rounded-xl bg-black border border-slate-800 flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: 180 }}>
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent animate-pulse pointer-events-none" />
          <div className="absolute left-0 right-0 h-0.5 bg-primary shadow-lg shadow-primary animate-bounce top-1/2" />
          <div className="text-3xl mb-2">📷</div>
          <p className="text-[10px] text-muted-foreground max-w-[280px]">
            {t("equip.scanner_placeholder")}
          </p>
        </div>

        {/* Quick Simulator BDD Panel */}
        <div className="mt-4 pt-3 border-t border-border">
          <label className={`text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-2 ${isRtl ? "text-right" : "text-left"}`}>
            {t("equip.scanner_sim")}
          </label>
          <div className={`flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 ${isRtl ? "flex-row-reverse" : ""}`}>
            {equipments.map((eq) => (
              <button
                key={eq.id}
                type="button"
                onClick={() => onResult(eq)}
                className={`inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200 hover:bg-primary hover:text-white dark:bg-slate-900 dark:border-slate-800 px-2.5 py-1 text-[10px] font-bold transition text-slate-700 dark:text-slate-200 ${isRtl ? "flex-row-reverse" : ""}`}
              >
                📡 {eq.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <label className={`text-xs font-semibold text-muted-foreground block ${isRtl ? "text-right" : "text-left"}`}>
            {t("equip.scanner_manual")}
          </label>
          <div className={`mt-1.5 flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="e.g. BPI-A3 ou SN-OLT..."
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
            />
            <button
              onClick={handleManualSearch}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              {t("equip.scanner_btn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpliceCassette({
  equipment,
  t,
  isRtl,
}: {
  equipment: any;
  t: (k: string, vars?: any) => string;
  isRtl: boolean;
}) {
  // 12 Standard optical fiber colors
  const fiberColors = [
    { name: isRtl ? "1 - أزرق" : "1 - Bleu", color: "#3b82f6" },
    { name: isRtl ? "2 - برتقالي" : "2 - Orange", color: "#f97316" },
    { name: isRtl ? "3 - أخضر" : "3 - Vert", color: "#22c55e" },
    { name: isRtl ? "4 - بني" : "4 - Marron", color: "#78350f" },
    { name: isRtl ? "5 - رمادي" : "5 - Gris", color: "#64748b" },
    { name: isRtl ? "6 - أبيض" : "6 - Blanc", color: "#e2e8f0" },
    { name: isRtl ? "7 - أحمر" : "7 - Rouge", color: "#ef4444" },
    { name: isRtl ? "8 - أسود" : "8 - Noir", color: "#0f172a" },
    { name: isRtl ? "9 - أصفر" : "9 - Jaune", color: "#eab308" },
    { name: isRtl ? "10 - بنفسجي" : "10 - Violet", color: "#a855f7" },
    { name: isRtl ? "11 - وردي" : "11 - Rose", color: "#ec4899" },
    { name: isRtl ? "12 - فيروزي" : "12 - Turquoise", color: "#06b6d4" },
  ];

  const [selectedFeeder, setSelectedFeeder] = useState<number | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<number | null>(null);
  const [splices, setSplices] = useState<Record<number, number>>({
    0: 0,
    1: 1,
    2: 2,
    3: 3,
  });

  const handleSolder = (feederIdx: number, dropIdx: number) => {
    setSplices(prev => ({ ...prev, [feederIdx]: dropIdx }));
    setSelectedFeeder(null);
    setSelectedDrop(null);
    toast.success(
      isRtl
        ? "تم إجراء اللحام الضوئي بنجاح في الكاسيت!"
        : "Soudure optique effectuée dans la cassette !"
    );
  };

  const handleClearSplice = (feederIdx: number) => {
    setSplices(prev => {
      const copy = { ...prev };
      delete copy[feederIdx];
      return copy;
    });
    toast.info(
      isRtl
        ? "تم إلغاء اللحام."
        : "Soudure révoquée."
    );
  };

  return (
    <div className={`space-y-4 text-xs text-foreground animate-in fade-in duration-150 ${isRtl ? "text-right" : "text-left"}`}>
      <div className="text-[10px] text-muted-foreground font-semibold leading-relaxed border-b border-border/40 pb-2">
        {isRtl
          ? "كاسيت اللحامات البصرية: حدد ليفاً ضوئياً حراً من كابل التغذية Feeder ثم اختر منفذ التوزيع Drop لدمجهما باللحام."
          : "Cassette d'épissurage : Sélectionnez une fibre du câble Feeder puis associez-la à un port de distribution ONT."}
      </div>

      <div className={`grid grid-cols-2 gap-4 h-64 relative overflow-hidden bg-slate-50 dark:bg-slate-900 border border-border/80 rounded-2xl p-3 ${isRtl ? "flex-row-reverse" : ""}`}>
        {/* Draw connections using absolutely positioned SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {Object.entries(splices).map(([feederIdxStr, dropIdx]) => {
            const feederIdx = parseInt(feederIdxStr);
            const y1 = 28 + (feederIdx / 12) * 210;
            const y2 = 28 + (dropIdx / 12) * 210;
            const feederColor = fiberColors[feederIdx]?.color || "#cbd5e1";
            
            // Adjust SVG coordinates for RTL
            const startX = isRtl ? 230 : 16;
            const endX = isRtl ? 16 : 230;
            const controlPoint1 = isRtl ? 230 - 80 : 80;
            const controlPoint2 = isRtl ? 80 : 230 - 80;

            return (
              <path
                key={feederIdx}
                d={`M ${startX} ${y1} C ${controlPoint1} ${y1}, ${controlPoint2} ${y2}, ${endX} ${y2}`}
                fill="none"
                stroke={feederColor}
                strokeWidth="2.5"
                className="opacity-90 drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.3)]"
              />
            );
          })}
        </svg>

        {/* Feeder Fibers (Input) */}
        <div className={`flex flex-col gap-1 z-10 overflow-y-auto max-h-[235px] pr-1 ${isRtl ? "items-end text-right order-2" : "items-start text-left"}`}>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block sticky top-0 bg-slate-50 dark:bg-slate-900 py-0.5">{isRtl ? "ألياف Feeder" : "Fibres Feeder (12)"}</span>
          {fiberColors.map((f, idx) => {
            const isSelected = selectedFeeder === idx;
            const isSpliced = splices[idx] !== undefined;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (isSpliced) {
                    handleClearSplice(idx);
                  } else {
                    setSelectedFeeder(idx);
                    if (selectedDrop !== null) {
                      handleSolder(idx, selectedDrop);
                    }
                  }
                }}
                className={`flex items-center gap-2 rounded-lg p-1 font-bold transition border w-full text-left ${isRtl ? "flex-row-reverse" : ""} ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : isSpliced
                    ? "border-emerald-200/50 bg-emerald-500/5 hover:border-red-400 hover:bg-red-50/20 text-[#1e293b] dark:text-slate-200"
                    : "border-border/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: f.color }} />
                <span className="truncate flex-1 text-[9px] font-semibold">{f.name}</span>
                {isSpliced ? (
                  <span className="text-[7px] bg-emerald-100 text-emerald-800 px-1 rounded-sm uppercase tracking-wide font-black">OK</span>
                ) : (
                  <span className="text-[7px] text-muted-foreground">libre</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Drop Fibers (Output) */}
        <div className={`flex flex-col gap-1 z-10 overflow-y-auto max-h-[235px] pl-1 ${isRtl ? "items-start text-left order-1" : "items-end text-right"}`}>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block sticky top-0 bg-slate-50 dark:bg-slate-900 py-0.5">{isRtl ? "منافذ ONT" : "Coupleurs ONT (12)"}</span>
          {fiberColors.map((f, idx) => {
            const isSelected = selectedDrop === idx;
            const isSpliced = Object.values(splices).includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (!isSpliced) {
                    setSelectedDrop(idx);
                    if (selectedFeeder !== null) {
                      handleSolder(selectedFeeder, idx);
                    }
                  }
                }}
                className={`flex items-center gap-2 rounded-lg p-1 font-bold transition border w-full text-right ${isRtl ? "" : "flex-row-reverse"} ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : isSpliced
                    ? "border-emerald-200/50 bg-emerald-500/5 opacity-55"
                    : "border-border/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                disabled={isSpliced}
              >
                <span className="truncate flex-1 text-[9px] font-semibold">{isRtl ? `منفذ ONT ${idx + 1}` : `Port ONT ${idx + 1}`}</span>
                <span className="h-2.5 w-2.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: f.color }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Printable QR Sticker & Label Designer Component ──────────────────────────
function AssetLabelCard({ equipment, t, isRtl }: { equipment: any; t: (k: string) => string; isRtl: boolean }) {
  const serialNumber = `SN-${equipment.type}-SOT-${equipment.name.replace(/\D/g, "") || "9921"}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`FTTH-SOTETEL-ASSET-${equipment.id}`)}`;

  const handlePrint = () => {
    const printContent = document.getElementById("sotetel-sticker-label")?.innerHTML;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Imprimer Étiquette SOTETEL - ${equipment.name}</title>
            <style>
              body {
                background: #ffffff;
                font-family: 'Courier New', Courier, monospace;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 10px;
              }
              .sticker {
                background: white;
                border: 1.5px solid #000;
                padding: 12px;
                border-radius: 8px;
                width: 250px;
                text-align: center;
                box-sizing: border-box;
              }
              .logo {
                font-family: Arial, sans-serif;
                font-size: 12px;
                font-weight: 900;
                text-align: center;
                margin-bottom: 2px;
                letter-spacing: 1px;
                color: #000;
              }
              .title {
                font-family: Arial, sans-serif;
                font-size: 7px;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: #444;
                margin-bottom: 6px;
              }
              .divider {
                border-bottom: 1px solid #000;
                margin: 4px 0 8px 0;
              }
              .qr-container {
                display: flex;
                justify-content: center;
                margin: 8px 0;
              }
              .qr-container img {
                width: 60px;
                height: 60px;
              }
              .details {
                font-size: 8px;
                line-height: 1.4;
                font-weight: 700;
                text-align: left;
              }
              .details div {
                display: flex;
                justify-content: space-between;
                border-bottom: 0.5px dotted #aaa;
                padding: 2px 0;
              }
              .details div:last-child {
                border-bottom: none;
              }
              .barcode-box {
                text-align: center;
                margin-top: 10px;
                border-top: 1.5px dashed #000;
                padding-top: 6px;
              }
              .barcode-sim {
                font-size: 16px;
                letter-spacing: 2px;
                margin-bottom: 2px;
                font-weight: bold;
              }
              .footer-text {
                font-size: 5.5px;
                text-align: center;
                color: #777;
                margin-top: 6px;
                letter-spacing: 0.5px;
              }
            </style>
          </head>
          <body>
            <div class="sticker">
              ${printContent}
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  return (
    <div className={`space-y-4 animate-in fade-in duration-150 ${isRtl ? "text-right" : "text-left"}`}>
      <div className="text-[10px] text-muted-foreground font-semibold leading-relaxed border-b pb-2">
        {isRtl 
          ? "معاينة ملصق الباركود ورمز الاستجابة السريعة (QR) للأصول الميدانية. يمكنك طباعة الملصق ولصقه مباشرة على المعدات المادية."
          : "Fiche d'étiquetage d'équipement actif pour le terrain. Génère un sticker autocollant normé avec QR-Code et Code-barres."}
      </div>

      {/* STICKER CONTAINER FOR PRINT */}
      <div className="flex justify-center p-2 bg-slate-50 dark:bg-slate-900 border rounded-2xl">
        <div 
          id="sotetel-sticker-label"
          className="bg-white text-slate-900 p-4.5 rounded-xl border border-slate-350 max-w-[280px] w-full shadow-xs"
        >
          {/* Logo */}
          <div className="logo font-black text-center text-xs bg-gradient-to-r from-orange-600 to-indigo-600 bg-clip-text text-transparent">
            SOTETEL TELECOM
          </div>
          <div className="title text-[7px] text-center tracking-widest text-slate-400 font-bold uppercase mt-0.5">
            INFRASTRUCTURE GPON FTTH
          </div>
          
          <div className="border-b border-slate-900/10 my-2" />

          {/* QR Code */}
          <div className="qr-container flex justify-center my-2 bg-white p-1 rounded-lg border border-slate-100 max-w-[70px] mx-auto">
            <img src={qrUrl} alt="Asset QR Code" className="h-14 w-14 object-contain" />
          </div>

          {/* Details Table */}
          <div className="details text-[9px] space-y-0.5 font-mono font-semibold">
            <div className="flex justify-between border-b border-dashed border-slate-100 pb-0.5">
              <span className="text-slate-400">ID ASSET:</span>
              <span className="font-bold">#{equipment.id}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-100 pb-0.5">
              <span className="text-slate-400">NOM/TAG:</span>
              <span className="font-bold">{equipment.name}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-100 pb-0.5">
              <span className="text-slate-400">TYPE:</span>
              <span className="font-bold uppercase text-[8px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 rounded">
                {equipment.type === "BPI" ? "PBO Cabinet" : equipment.type}
              </span>
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-100 pb-0.5">
              <span className="text-slate-400">PARENT:</span>
              <span className="font-bold truncate max-w-[120px]">{equipment.parent}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-100 pb-0.5">
              <span className="text-slate-400">GPS:</span>
              <span className="font-bold text-orange-600 truncate max-w-[140px]">{equipment.gps || "36.8671, 10.2253"}</span>
            </div>
            <div className="flex justify-between pb-0.5">
              <span className="text-slate-400">ABONNÉS:</span>
              <span className="font-bold text-emerald-600">{equipment.subscribers} actifs</span>
            </div>
          </div>

          {/* Barcode representation */}
          <div className="barcode-box text-center mt-3.5 pt-2.5 border-t border-dashed border-slate-900/10">
            <div className="barcode-sim text-base font-mono tracking-[3px] text-slate-700 select-none">
              ||||| | ||| |||| | | |||
            </div>
            <div className="text-[8px] font-mono font-bold text-slate-500 mt-0.5">{serialNumber}</div>
          </div>

          <div className="footer-text text-[6px] text-center text-slate-350 font-bold uppercase tracking-wider mt-3">
            FiberTrack IQ Label Sheet · SOTETEL R&D
          </div>
        </div>
      </div>

      {/* PRINT BUTTON */}
      <button
        onClick={handlePrint}
        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white font-bold py-2.5 text-xs shadow-md shadow-orange-500/10 transition flex items-center justify-center gap-1.5"
      >
        🖨️ {isRtl ? "طباعة الملصق اللاصق" : "Lancer l'impression de l'étiquette"}
      </button>
    </div>
  );
}

