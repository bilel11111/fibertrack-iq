import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  PlusCircle,
  Search,
  AlertTriangle,
  Package,
  X,
  Check,
  Trash2,
  History,
  SlidersHorizontal,
  Truck,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/hooks/use-app";
import { sqliteQuery, sqliteExecute } from "@/lib/sqlite-client";

export const Route = createFileRoute("/_app/materials")({
  head: () => ({ meta: [{ title: "Inventaire & Stock — FiberNMS" }] }),
  component: MaterialsPage,
  ssr: false,
});

type Material = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  stock_qty: number;
  min_stock: number;
};

type MaterialUsage = {
  id: number;
  material_id: number;
  material_name: string;
  material_unit: string;
  material_code: string;
  user_id: string;
  quantity: number;
  bpi_id: string;
  note: string;
  scanned_at: string;
  status: "Pending" | "Approved";
};

const CATEGORIES = ["cable", "connector", "splice", "enclosure", "tool", "other"] as const;

function MaterialsPage() {
  const { user } = useAuth();
  const { lang, zone, t } = useApp();
  const isRtl = lang === "ar";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [usages, setUsages] = useState<MaterialUsage[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"history" | "catalog">("history");
  const [q, setQ] = useState(""); // Catalog search
  const [qh, setQh] = useState(""); // History search
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"All" | "Pending" | "Approved">("All");

  // Modals state
  const [scanOpen, setScanOpen] = useState(false);
  const [useFor, setUseFor] = useState<Material | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [materialsData, usagesData, connData] = await Promise.all([
        sqliteQuery("SELECT * FROM materials ORDER BY name"),
        sqliteQuery(`
          SELECT mu.*, m.name as material_name, m.unit as material_unit, m.code as material_code
          FROM material_usages mu
          JOIN materials m ON mu.material_id = m.id
          ORDER BY mu.scanned_at DESC
        `),
        sqliteQuery("SELECT * FROM connections")
      ]);
      setMaterials(materialsData);
      setUsages(usagesData);
      setConnections(connData);
      setLoading(false);
    } catch (e: any) {
      toast.error("Failed to load inventory: " + e.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Compute metric cards stats
  const totalStockSum = useMemo(() => {
    return materials.reduce((acc, m) => acc + m.stock_qty, 0);
  }, [materials]);

  const pendingCount = useMemo(() => {
    return usages.filter((u) => u.status === "Pending").length;
  }, [usages]);

  const lowStockCount = useMemo(() => {
    return materials.filter((m) => m.stock_qty <= m.min_stock).length;
  }, [materials]);

  // Catalog filtered
  const filteredCatalog = useMemo(() => {
    let list = materials;
    if (showLowStockOnly) {
      list = list.filter((m) => m.stock_qty <= m.min_stock);
    }
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((m) => m.code.toLowerCase().includes(s) || m.name.toLowerCase().includes(s));
  }, [materials, q, showLowStockOnly]);

  // History filtered by search, status, and zone
  const filteredHistory = useMemo(() => {
    let list = usages;

    // Filter by zone
    if (zone !== "Toutes les zones") {
      const zoneBpis = new Set(
        connections
          .filter((c) => c.fdt === zone || c.residence === zone)
          .map((c) => c.pos_bpi)
          .filter(Boolean)
      );
      list = list.filter((u) => u.bpi_id && zoneBpis.has(u.bpi_id));
    }

    if (filterStatus !== "All") {
      list = list.filter((u) => u.status === filterStatus);
    }
    const s = qh.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (u) =>
        u.material_name.toLowerCase().includes(s) ||
        u.material_code.toLowerCase().includes(s) ||
        (u.bpi_id && u.bpi_id.toLowerCase().includes(s)) ||
        (u.note && u.note.toLowerCase().includes(s)) ||
        u.user_id.toLowerCase().includes(s)
    );
  }, [usages, qh, filterStatus, zone, connections]);

  // QR scanned code
  const handleScanned = (code: string) => {
    setScanOpen(false);
    const m = materials.find((x) => x.code.toLowerCase() === code.toLowerCase());
    if (!m) {
      toast.error(
        isRtl
          ? `لم يتم العثور على مادة بالرمز "${code}"`
          : `Aucun matériel trouvé avec le code "${code}"`
      );
      return;
    }
    setUseFor(m);
  };

  // Record a usage (Starts as Pending)
  const recordUsage = async (m: Material, quantity: number, bpiId: string, note: string) => {
    if (!user) return;
    if (quantity <= 0) {
      toast.error(
        isRtl ? "يجب أن تكون الكمية أكبر من 0." : "La quantité doit être supérieure à 0."
      );
      return;
    }
    if (quantity > m.stock_qty) {
      toast.error(
        isRtl
          ? "الكمية المطلوبة أكبر من المخزون المتاح."
          : "Quantité demandée supérieure au stock disponible."
      );
      return;
    }

    try {
      const res = await sqliteExecute(
        `INSERT INTO material_usages (material_id, user_id, quantity, bpi_id, note, status, scanned_at)
         VALUES (?, ?, ?, ?, ?, 'Pending', datetime('now'))`,
        [
          m.id,
          user.email?.split("@")[0] || "technicien",
          quantity,
          bpiId || null,
          note || null
        ]
      );

      if (!res.success) {
        toast.error("SQLite insert failed");
        return;
      }

      toast.success(
        isRtl
          ? `تم إنشاء طلب سحب لـ ${quantity} ${m.unit} من ${m.name} (قيد الانتظار)`
          : `Demande de sortie pour ${quantity} ${m.unit} de ${m.name} créée avec succès (En attente) !`
      );
      setUseFor(null);
      load();
    } catch (err: any) {
      toast.error("Erreur de création de mouvement : " + err.message);
    }
  };

  // Approve all pending usages
  const approveAllPending = async () => {
    const pending = usages.filter((u) => u.status === "Pending");
    if (pending.length === 0) {
      toast.info(
        isRtl ? "لا توجد حركة مخزون معلقة." : "Aucun mouvement en attente d'approbation."
      );
      return;
    }

    try {
      for (const item of pending) {
        await sqliteExecute(
          "UPDATE materials SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE id = ?",
          [item.quantity, item.material_id]
        );
      }

      await sqliteExecute("UPDATE material_usages SET status = 'Approved' WHERE status = 'Pending'");
      toast.success(
        isRtl
          ? `تمت الموافقة على ${pending.length} حركات مخزون وخصمها!`
          : `${pending.length} mouvements de stock approuvés et déduits du stock !`
      );
      load();
    } catch (err: any) {
      toast.error("Échec d'approbation globale : " + err.message);
    }
  };

  // Approve a single movement
  const approveSingle = async (u: MaterialUsage) => {
    try {
      await sqliteExecute(
        "UPDATE materials SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE id = ?",
        [u.quantity, u.material_id]
      );
      await sqliteExecute("UPDATE material_usages SET status = 'Approved' WHERE id = ?", [u.id]);
      toast.success(
        isRtl ? "تمت الموافقة بنجاح!" : "Mouvement approuvé avec succès !"
      );
      load();
    } catch (err: any) {
      toast.error("Erreur d'approbation : " + err.message);
    }
  };

  // Delete a movement
  const deleteMovement = async (id: number) => {
    const confirmDelete = window.confirm(
      isRtl
        ? "هل تريد حذف حركة المخزون هذه؟"
        : "Voulez-vous supprimer ce mouvement d'inventaire ?"
    );
    if (!confirmDelete) return;

    try {
      await sqliteExecute("DELETE FROM material_usages WHERE id = ?", [id]);
      toast.success(
        isRtl ? "تم حذف الحركة بنجاح." : "Mouvement supprimé du registre."
      );
      load();
    } catch (err: any) {
      toast.error("Échec de suppression : " + err.message);
    }
  };

  return (
    <main
      className="h-full w-full overflow-y-auto bg-[#f8fafc] dark:bg-slate-900 p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* Metric Cards Row */}
        <div className={`grid gap-5 md:grid-cols-3 ${isRtl ? "md:flex-row-reverse" : ""}`}>
          {/* Blue Card */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 flex flex-col justify-between min-h-[140px] shadow-md shadow-blue-500/10">
            <div>
              <span className="text-xs font-semibold opacity-90">{t("mat.kpi_stock")}</span>
              <div className="text-3xl font-extrabold tabular-nums mt-1">{materials.length}</div>
            </div>
            <button
              onClick={() => {
                toast.success(
                  isRtl
                    ? "تم إرسال طلب إعادة التموين إلى المستودع المركزي!"
                    : "Demande de réapprovisionnement transmise au stock central Sotetel !"
                );
              }}
              className="mt-3 w-full py-2 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white font-bold rounded-xl text-xs transition border border-white/10"
            >
              {t("mat.btn_replenish")}
            </button>
          </div>

          {/* Teal Card */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-5 flex flex-col justify-between min-h-[140px] shadow-md shadow-emerald-500/10">
            <div>
              <span className="text-xs font-semibold opacity-90">{t("mat.kpi_pending")}</span>
              <div className="text-3xl font-extrabold tabular-nums mt-1">{pendingCount}</div>
            </div>
            <button
              onClick={approveAllPending}
              disabled={pendingCount === 0}
              className="mt-3 w-full py-2 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white font-bold rounded-xl text-xs transition border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("mat.btn_approve_all")}
            </button>
          </div>

          {/* Red Card */}
          <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white p-5 flex flex-col justify-between min-h-[140px] shadow-md shadow-rose-500/10">
            <div>
              <span className="text-xs font-semibold opacity-90">{t("mat.kpi_low_stock")}</span>
              <div className="text-3xl font-extrabold tabular-nums mt-1">{lowStockCount}</div>
            </div>
            <button
              onClick={() => {
                setShowLowStockOnly(!showLowStockOnly);
                setActiveTab("catalog");
                toast.info(showLowStockOnly ? "Filtre stock bas retiré." : "Affichage des articles en stock bas uniquement !");
              }}
              className={`mt-3 w-full py-2 text-white font-bold rounded-xl text-xs transition border border-white/10 ${
                showLowStockOnly ? "bg-white/30" : "bg-white/15 hover:bg-white/25 active:bg-white/30"
              }`}
            >
              {showLowStockOnly ? t("mat.btn_show_all") : t("mat.btn_show_low")}
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className={`flex gap-2 border-b border-border pb-px ${isRtl ? "flex-row-reverse" : ""}`}>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-4 w-4" />
            {t("mat.tab_history")}
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition ${
              activeTab === "catalog"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4" />
            {t("mat.tab_catalog")}
          </button>
        </div>

        {/* MAIN PANEL CONTENT */}
        {activeTab === "history" ? (
          /* SECTION 1: HISTORIQUE DES MOUVEMENTS DE STOCK */
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm dark:bg-slate-950 dark:border-slate-800 animate-in fade-in duration-200">
            <div className={`flex flex-wrap items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h2 className="text-sm font-bold text-foreground">
                {t("mat.history_title")}
              </h2>
              
              <div className={`flex flex-wrap items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                {/* Search bar for history */}
                <div className="relative min-w-[200px]">
                  <Search className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground`} />
                  <input
                    value={qh}
                    onChange={(e) => setQh(e.target.value)}
                    placeholder={t("mat.history_filter")}
                    className={`w-full rounded-xl border border-input bg-background py-1.5 ${isRtl ? "pr-9 pl-3" : "pl-9 pr-3"} text-xs outline-none focus:ring-1 focus:ring-primary`}
                  />
                </div>

                {/* Status Filter buttons */}
                <div className={`flex bg-accent/40 rounded-xl p-1 border border-border/85 ${isRtl ? "flex-row-reverse" : ""}`}>
                  {(["All", "Pending", "Approved"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                        filterStatus === st
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent/40"
                      }`}
                    >
                      {st === "All" ? t("mat.history_status_all") : st === "Pending" ? t("mat.history_status_pending") : t("mat.history_status_approved")}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setQh("");
                    setFilterStatus("All");
                    toast.success("Filtres réinitialisés");
                  }}
                  className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
                  title="Filtres"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-10 text-xs text-muted-foreground">{t("mat.loading")}</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-xs" dir={isRtl ? "rtl" : "ltr"}>
                  <thead className="bg-[#f8fafc] text-muted-foreground font-bold uppercase tracking-wider text-[10px] dark:bg-slate-900 border-b border-border">
                    <tr>
                      <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("mat.col_date")}</th>
                      <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("mat.col_item")}</th>
                      <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("mat.col_type")}</th>
                      <th className={`px-4 py-3 ${isRtl ? "text-left" : "text-right"}`}>{t("mat.col_qty")}</th>
                      <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("mat.col_to")}</th>
                      <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("mat.col_user")}</th>
                      <th className="px-4 py-3 text-center">{t("mat.col_actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredHistory.map((u) => {
                      const isPending = u.status === "Pending";
                      const dateObj = new Date(u.scanned_at);
                      const formattedDate = isNaN(dateObj.getTime())
                        ? u.scanned_at
                        : dateObj.toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                          <td className={`px-4 py-3 text-muted-foreground whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>{formattedDate}</td>
                          <td className={`px-4 py-3 font-semibold text-foreground ${isRtl ? "text-right" : "text-left"}`}>
                            <div>{u.material_name}</div>
                            <div className="font-mono text-[9px] text-muted-foreground font-normal">{u.material_code}</div>
                          </td>
                          <td className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                isPending
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${isPending ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                              {isPending ? t("mat.status_pending") : t("mat.status_approved")}
                            </span>
                          </td>
                          <td className={`px-4 py-3 font-bold tabular-nums text-foreground whitespace-nowrap ${isRtl ? "text-left" : "text-right"}`}>
                            {u.quantity} {u.material_unit}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap font-medium text-[#475569] dark:text-slate-300 ${isRtl ? "text-right" : "text-left"}`}>
                            {u.bpi_id ? (
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                {u.bpi_id}
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground">{t("mat.local")}</span>
                            )}
                            {u.note && <span className="ml-1.5 mr-1.5 text-muted-foreground font-normal text-[10px]">({u.note})</span>}
                          </td>
                          <td className={`px-4 py-3 font-semibold text-[#64748b] dark:text-slate-400 ${isRtl ? "text-right" : "text-left"}`}>
                            <span className={`flex items-center gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                              <User className="h-3 w-3" /> {u.user_id}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center items-center gap-1.5">
                              {isPending && (
                                <button
                                  onClick={() => approveSingle(u)}
                                  className="rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 p-1.5 border border-emerald-100 transition"
                                  title="Approuver"
                                >
                                  <Check className="h-3.5 w-3.5 font-bold" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteMovement(u.id)}
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
                    {filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                          {t("mat.no_movements")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination simulator */}
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
                  1-{filteredHistory.length} de {filteredHistory.length}
                </span>
                <div className="flex gap-2">
                  <button disabled className="p-1.5 rounded-lg border border-border opacity-50 cursor-not-allowed">❮</button>
                  <button disabled className="p-1.5 rounded-lg border border-border opacity-50 cursor-not-allowed">❯</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* SECTION 2: CATALOGUE DES ARTICLES EN STOCK */
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm dark:bg-slate-950 dark:border-slate-800 animate-in fade-in duration-200">
            <div className={`flex flex-wrap items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div className={isRtl ? "text-right" : "text-left"}>
                <h2 className="text-sm font-bold text-foreground">
                  {t("mat.catalog_title")}
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t("mat.catalog_count", { n: filteredCatalog.length })}
                  {showLowStockOnly && (
                    <span className="ml-1.5 mr-1.5 bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded-full text-[9px]">
                      {isRtl ? "تنبيه انخفاض المخزون نشط" : "Filtre Stock Bas Activé"}
                    </span>
                  )}
                </p>
              </div>

              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <button
                  onClick={() => setScanOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#10b981] hover:bg-[#059669] px-3.5 py-2 text-xs font-semibold text-white transition shadow-sm shadow-emerald-500/10"
                >
                  <Camera className="h-4 w-4" /> {t("mat.btn_scan_qr")}
                </button>
                <button
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 px-3.5 py-2 text-xs font-semibold text-primary-foreground transition shadow-sm"
                >
                  <PlusCircle className="h-4 w-4" /> {t("mat.btn_new_item")}
                </button>
              </div>
            </div>

            {/* Catalog search bar */}
            <div className="relative mb-4">
              <Search className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("mat.catalog_search")}
                className={`w-full rounded-xl border border-input bg-background py-2 ${isRtl ? "pr-9 pl-3" : "pl-9 pr-3"} text-xs outline-none focus:ring-1 focus:ring-primary`}
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-xs" dir={isRtl ? "rtl" : "ltr"}>
                <thead className="bg-[#f8fafc] text-muted-foreground font-bold uppercase tracking-wider text-[10px] dark:bg-slate-900 border-b border-border">
                  <tr>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("mat.col_code")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("mat.col_name")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("mat.col_cat")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-left" : "text-right"}`}>{t("mat.col_stock")}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-left" : "text-right"}`}>{t("mat.col_alert")}</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCatalog.map((m) => {
                    const low = m.stock_qty <= m.min_stock;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                        <td className={`px-4 py-3 font-mono font-bold text-primary text-[10px] ${isRtl ? "text-right" : "text-left"}`}>{m.code}</td>
                        <td className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>
                          <span className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                            <Package className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-semibold text-foreground">{m.name}</span>
                          </span>
                        </td>
                        <td className={`px-4 py-3 capitalize text-muted-foreground font-medium ${isRtl ? "text-right" : "text-left"}`}>{m.category}</td>
                        <td
                          className={`px-4 py-3 font-extrabold tabular-nums whitespace-nowrap text-sm ${isRtl ? "text-left" : "text-right"} ${
                            low ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                          }`}
                        >
                          {m.stock_qty} {m.unit}
                          {low && (
                            <span className="ml-1.5 mr-1.5 inline-flex items-center text-rose-500" title="Stock Bas Alert">
                              <AlertTriangle className="h-3.5 w-3.5 fill-rose-500/10" />
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-3 tabular-nums text-muted-foreground font-semibold ${isRtl ? "text-left" : "text-right"}`}>
                          {m.min_stock} {m.unit}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setUseFor(m)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2.5 py-1 text-[10px] font-bold text-foreground transition"
                          >
                            <Truck className="h-3 w-3" /> {t("mat.btn_use")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCatalog.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                        {t("mat.no_articles")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {scanOpen && <Scanner materials={materials} onClose={() => setScanOpen(false)} onResult={handleScanned} t={t} isRtl={isRtl} />}
      {useFor && <UseDialog material={useFor} onClose={() => setUseFor(null)} onConfirm={recordUsage} t={t} isRtl={isRtl} />}
      {addOpen && <AddDialog onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); }} t={t} isRtl={isRtl} />}
    </main>
  );
}

// Scanner component matching design rules
function Scanner({
  materials,
  onClose,
  onResult,
  t,
  isRtl,
}: {
  materials: Material[];
  onClose: () => void;
  onResult: (code: string) => void;
  t: (k: string) => string;
  isRtl: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [manual, setManual] = useState("");

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
          <h3 className={`font-bold text-xs uppercase text-foreground tracking-wide flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Camera className="h-4.5 w-4.5 text-primary" /> {t("mat.scanner_title")}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Sim scanner feed */}
        <div className="relative overflow-hidden rounded-xl bg-black border border-slate-800 flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: 150 }}>
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent animate-pulse pointer-events-none" />
          <div className="absolute left-0 right-0 h-0.5 bg-primary shadow-lg shadow-primary animate-bounce top-1/2" />
          <div className="text-3xl mb-2">📷</div>
          <p className="text-[10px] text-muted-foreground max-w-[280px]">
            {isRtl ? "البحث عن بث الفيديو... الكاميرا جاهزة." : "Recherche de flux vidéo… Caméra locale prête."}
          </p>
        </div>
        
        {/* Quick Simulator BDD Panel */}
        <div className="mt-4 pt-3 border-t border-border">
          <label className={`text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-2 ${isRtl ? "text-right" : "text-left"}`}>{t("mat.scanner_sim")}</label>
          <div className={`flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 ${isRtl ? "flex-row-reverse" : ""}`}>
            {materials.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onResult(m.code)}
                className={`inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200 hover:bg-primary hover:text-white dark:bg-slate-900 dark:border-slate-800 px-2.5 py-1 text-[10px] font-bold transition text-slate-700 dark:text-slate-200 ${isRtl ? "flex-row-reverse" : ""}`}
              >
                📦 {m.code}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <label className={`text-xs font-semibold text-muted-foreground block ${isRtl ? "text-right" : "text-left"}`}>{t("mat.scanner_manual")}</label>
          <div className={`mt-1.5 flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="e.g. CBL-DROP-1F"
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
            />
            <button
              onClick={() => manual.trim() && onResult(manual.trim())}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              {isRtl ? "تأكيد" : "Valider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dialog to declare a movement usage
function UseDialog({
  material,
  onClose,
  onConfirm,
  t,
  isRtl,
}: {
  material: Material;
  onClose: () => void;
  onConfirm: (m: Material, q: number, b: string, n: string) => void;
  t: (k: string, vars?: any) => string;
  isRtl: boolean;
}) {
  const [qty, setQty] = useState<number>(1);
  const [bpi, setBpi] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
          <h3 className={`font-bold text-xs uppercase text-foreground tracking-wide flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Truck className="h-4.5 w-4.5 text-primary" /> {t("mat.use_title")}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={`rounded-xl bg-accent/40 p-4 border border-border/80 mb-4 ${isRtl ? "text-right" : "text-left"}`}>
          <div className="font-bold text-foreground text-sm">{material.name}</div>
          <div className="font-mono text-[10px] text-primary font-semibold mt-0.5">{material.code}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {t("mat.use_stock_qty")} <span className="font-extrabold text-foreground tabular-nums">{material.stock_qty} {material.unit}</span>
          </div>
        </div>
        <div className="space-y-3.5 text-right">
          <div className={isRtl ? "text-right" : "text-left"}>
            <label className="text-xs font-semibold text-muted-foreground">{t("mat.use_field_qty")} ({material.unit})</label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              max={material.stock_qty}
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className={isRtl ? "text-right" : "text-left"}>
            <label className="text-xs font-semibold text-muted-foreground">{t("mat.use_field_bpi")}</label>
            <input
              value={bpi}
              onChange={(e) => setBpi(e.target.value)}
              placeholder="e.g. BPI-A3"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
            />
          </div>
          <div className={isRtl ? "text-right" : "text-left"}>
            <label className="text-xs font-semibold text-muted-foreground">{t("mat.use_field_note")}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Raccordement client villa 4"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <button
          onClick={() => onConfirm(material, qty, bpi, note)}
          className="mt-5 w-full rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-md shadow-primary/10"
        >
          {t("mat.use_btn_submit")}
        </button>
      </div>
    </div>
  );
}

// Dialog to declare a new material item in catalog
function AddDialog({
  onClose,
  onAdded,
  t,
  isRtl,
}: {
  onClose: () => void;
  onAdded: () => void;
  t: (k: string) => string;
  isRtl: boolean;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("cable");
  const [unit, setUnit] = useState("pcs");
  const [stock, setStock] = useState(0);
  const [min, setMin] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setBusy(true);

    try {
      const res = await sqliteExecute(
        `INSERT INTO materials (code, name, category, unit, stock_qty, min_stock, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [code.trim().toUpperCase(), name.trim(), category, unit, stock, min]
      );

      setBusy(false);
      if (!res.success) {
        toast.error("Failed to add material");
        return;
      }

      toast.success(
        isRtl
          ? `تم تسجيل المادة "${name}" في الكتالوج بنجاح!`
          : `Matériel "${name}" enregistré dans le catalogue !`
      );
      onAdded();
    } catch (err: any) {
      setBusy(false);
      toast.error("Failed: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
          <h3 className={`font-bold text-xs uppercase text-foreground tracking-wide flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <PlusCircle className="h-4.5 w-4.5 text-primary" /> {t("mat.add_title")}
          </h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-accent text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3.5 text-right">
          <div className={isRtl ? "text-right" : "text-left"}>
            <span className="text-xs font-semibold text-muted-foreground block mb-1">{t("mat.add_field_code")}</span>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
              placeholder="e.g. CBL-48FO-GT"
            />
          </div>
          <div className={isRtl ? "text-right" : "text-left"}>
            <span className="text-xs font-semibold text-muted-foreground block mb-1">{t("mat.add_field_name")}</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Câble Fibre Optique 48FO"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3.5 text-right">
            <div className={isRtl ? "text-right" : "text-left"}>
              <span className="text-xs font-semibold text-muted-foreground block mb-1">{t("mat.add_field_cat")}</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            
            <div className={isRtl ? "text-right" : "text-left"}>
              <span className="text-xs font-semibold text-muted-foreground block mb-1">{t("mat.add_field_unit")}</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. m, pcs, rouleau"
              />
            </div>
            
            <div className={isRtl ? "text-right" : "text-left"}>
              <span className="text-xs font-semibold text-muted-foreground block mb-1">{t("mat.add_field_stock")}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={stock}
                onChange={(e) => setStock(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className={isRtl ? "text-right" : "text-left"}>
              <span className="text-xs font-semibold text-muted-foreground block mb-1">{t("mat.add_field_min")}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={min}
                onChange={(e) => setMin(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
        
        <button
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition shadow-md shadow-primary/10"
        >
          {busy ? (isRtl ? "جاري الحفظ..." : "Enregistrement en cours…") : t("mat.add_btn_submit")}
        </button>
      </form>
    </div>
  );
}
