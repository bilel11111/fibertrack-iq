import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Building2,
  MapPin,
  Clock,
  Plus,
  X,
  Users,
  Search,
  CheckCircle,
  AlertTriangle,
  Send,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { sqliteQuery, sqliteExecute } from "@/lib/sqlite-client";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/hooks/use-app";

export const Route = createFileRoute("/_app/clients")({
  head: () => ({ meta: [{ title: "Raccordements & Clients — FiberTrack" }] }),
  component: ClientsPage,
  ssr: false,
});

function ClientsPage() {
  const { user } = useAuth();
  const { t, zone, lang } = useApp();
  const isRtl = lang === "ar";

  const [installations, setInstallations] = useState<any[]>([]);
  const [techniciansList, setTechniciansList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // New Connection Form States
  const [newInstOpen, setNewInstOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [instResidence, setInstResidence] = useState("Kamélia");
  const [instBloc, setInstBloc] = useState("Bloc A");
  const [instAppt, setInstAppt] = useState("");
  const [instEtage, setInstEtage] = useState("");
  const [instGps, setInstGps] = useState("36.8671,10.2253");
  const [instNotes, setInstNotes] = useState("");

  // Dispatch state
  const [dispatchItem, setDispatchItem] = useState<any | null>(null);
  const [selectedTech, setSelectedTech] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [instData, techData] = await Promise.all([
        sqliteQuery("SELECT * FROM installations ORDER BY created_at DESC"),
        sqliteQuery("SELECT * FROM users WHERE role = 'technician'"),
      ]);
      setInstallations(instData || []);
      setTechniciansList(techData || []);
    } catch (err) {
      console.error("Failed to load installations data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateInstallation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !instAppt.trim()) {
      toast.error(isRtl ? "يرجى ملء جميع الحقول المطلوبة" : "Veuillez remplir les champs obligatoires");
      return;
    }

    try {
      const nowStr = new Date().toISOString();
      await sqliteExecute(`
        INSERT INTO installations (client_name, residence, bloc, appartement, etage, gps, status, notes, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
      `, [
        clientName.trim(),
        instResidence,
        instBloc,
        instAppt.trim(),
        instEtage.trim(),
        instGps.trim(),
        instNotes.trim() || "Demande de raccordement standard.",
        nowStr,
        nowStr
      ]);
      toast.success(isRtl ? "تم تسجيل طلب التوصيل بنجاح!" : "Demande d'installation enregistrée avec succès !");
      setNewInstOpen(false);
      setClientName("");
      setInstAppt("");
      setInstEtage("");
      setInstNotes("");
      loadData();
    } catch (err: any) {
      toast.error("Failed to save connection: " + err.message);
    }
  };

  const handleDispatchInstallation = async () => {
    if (!dispatchItem || !selectedTech) return;
    try {
      const nowStr = new Date().toISOString();
      await sqliteExecute(
        "UPDATE installations SET status = 'Dispatched', assigned_tech = ?, updated_at = ? WHERE id = ?",
        [selectedTech, nowStr, dispatchItem.id]
      );
      toast.success(
        isRtl
          ? `تم تكليف التقني ${selectedTech} بالمهمة.`
          : `Mission affectée au technicien ${selectedTech} avec succès !`
      );
      setDispatchItem(null);
      setSelectedTech("");
      loadData();
    } catch (err: any) {
      toast.error("Dispatch assignment failed: " + err.message);
    }
  };

  // ── Filters & Search ────────────────────────────────────────────────────────
  const isAllZones = zone === "Toutes les zones";

  const filteredInstallations = useMemo(() => {
    let result = installations;
    
    // Filter by zone
    if (!isAllZones) {
      result = result.filter(inst => inst.residence === zone);
    }

    // Search query matching
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        inst =>
          inst.client_name?.toLowerCase().includes(query) ||
          inst.residence?.toLowerCase().includes(query) ||
          inst.bloc?.toLowerCase().includes(query) ||
          inst.notes?.toLowerCase().includes(query) ||
          inst.assigned_tech?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [installations, zone, isAllZones, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#f8fafc] dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Chargement des abonnés...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full overflow-y-auto bg-[#f8fafc] dark:bg-slate-900 p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header Section */}
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-4 ${isRtl ? "md:flex-row-reverse" : ""}`}>
          <div className={isRtl ? "text-right" : "text-left"}>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">
              {isRtl ? "بوابة طلبات رصف الألياف والتركيبات" : "Installations & Raccordements Clients"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRtl ? "إدارة وتتبع وتكليف chantiers abonnés GPON" : "Gérer les chantiers d'abonnés et l'affectation des techniciens de raccordement"}
            </p>
          </div>
          
          <div className={`flex gap-3 items-center flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}>
            {/* Search Input */}
            <div className="relative text-xs">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl ? "ابحث عن مشترك أو عنوان..." : "Rechercher un client, note..."}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-1.5 outline-none focus:ring-1 focus:ring-primary pl-8 text-right font-medium max-w-[200px]"
                dir={isRtl ? "rtl" : "ltr"}
              />
              <span className={`absolute top-2 text-slate-400 ${isRtl ? "right-3.5" : "left-3"}`}>🔍</span>
            </div>

            <button
              onClick={() => setNewInstOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 px-4 py-2 text-xs font-bold shadow-sm transition"
            >
              <Plus className="h-4 w-4" /> {isRtl ? "طلب توصيل جديد" : "Créer Raccordement"}
            </button>
          </div>
        </div>

        {/* Dashboard Stat Counters (Specific for connection chantiers) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
          <div className="bg-white dark:bg-slate-950 border p-4.5 rounded-2xl flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Demandes</span>
            <span className="text-xl font-extrabold text-foreground">{installations.length}</span>
          </div>
          <div className="bg-white dark:bg-slate-950 border p-4.5 rounded-2xl flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wider">En attente (Pending)</span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{installations.filter(x => x.status === "Pending").length}</span>
          </div>
          <div className="bg-white dark:bg-slate-950 border p-4.5 rounded-2xl flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider">Planifiés (Dispatched)</span>
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{installations.filter(x => x.status === "Dispatched").length}</span>
          </div>
          <div className="bg-white dark:bg-slate-950 border p-4.5 rounded-2xl flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Raccordés (Completed)</span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{installations.filter(x => x.status === "Completed").length}</span>
          </div>
        </div>

        {/* Main Connection Chantiers Card */}
        <div className="rounded-2xl border border-border bg-white dark:bg-slate-950 shadow-sm p-5 animate-in fade-in duration-200">
          {filteredInstallations.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              {isRtl ? "لا توجد أي طلبات مطابقة للبحث" : "Aucun chantier d'installation identifié"}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-xs" dir={isRtl ? "rtl" : "ltr"}>
                <thead className="bg-[#f8fafc] text-muted-foreground font-bold uppercase tracking-wider text-[9px] dark:bg-slate-900 border-b border-border">
                  <tr>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "المشترك" : "Client / Abonné"}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "العنوان / الموقع" : "Localisation"}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "ملاحظات" : "Description / Notes"}</th>
                    <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "الحالة" : "Statut"}</th>
                    <th className="px-4 py-3 text-center">{isRtl ? "الإجراءات" : "Affectation"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInstallations.map((inst) => {
                    let statusColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
                    let statusLabel = inst.status;

                    if (inst.status === "Pending") {
                      statusColor = "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200/20";
                      statusLabel = isRtl ? "في الانتظار" : "En attente";
                    } else if (inst.status === "Dispatched") {
                      statusColor = "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/20";
                      statusLabel = isRtl ? `مكلّف: ${inst.assigned_tech}` : `Affecté : ${inst.assigned_tech}`;
                    } else if (inst.status === "Completed") {
                      statusColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/20";
                      statusLabel = isRtl ? "مكتمل" : "Raccordé";
                    } else if (inst.status === "Cancelled") {
                      statusColor = "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-200/20";
                      statusLabel = isRtl ? "ملغي (رفض العميل)" : "Annulé (Refus)";
                    } else if (inst.status === "Fault") {
                      statusColor = "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/20";
                      statusLabel = isRtl ? "عطل فني في الموقع" : "Panne signalée";
                    }

                    return (
                      <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                        <td className={`px-4 py-3 font-bold text-foreground truncate whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>
                          👤 {inst.client_name}
                        </td>
                        <td className={`px-4 py-3 text-muted-foreground whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>
                          🏢 {inst.residence} {inst.bloc} - Appt {inst.appartement}
                          <div className="text-[9px] text-primary/70 font-mono mt-0.5">GPS: {inst.gps}</div>
                        </td>
                        <td className={`px-4 py-3 text-muted-foreground max-w-xs truncate ${isRtl ? "text-right" : "text-left"}`}>
                          {inst.notes || "—"}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap ${isRtl ? "text-right" : "text-left"}`}>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${statusColor}`}>
                            {inst.status === "Dispatched" || inst.status === "Fault" ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />
                            ) : null}
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {inst.status === "Pending" ? (
                            <button
                              onClick={() => {
                                setDispatchItem(inst);
                                setSelectedTech(techniciansList[0]?.name || "Anis Ben Salah");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-800/40 dark:text-indigo-400 px-2.5 py-1 text-[10px] font-bold shadow-sm transition"
                            >
                              ⚙️ {isRtl ? "تكليف فني" : "Affecter"}
                            </button>
                          ) : inst.status === "Dispatched" ? (
                            <button
                              onClick={() => {
                                setDispatchItem(inst);
                                setSelectedTech(inst.assigned_tech || "Anis Ben Salah");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-400 px-2.5 py-1 text-[10px] font-bold shadow-sm transition"
                            >
                              🔄 {isRtl ? "تغيير الفني" : "Réaffecter"}
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60 italic">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal: Affecter Technicien */}
      {dispatchItem && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
            <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className="font-bold text-xs uppercase text-primary tracking-wide">
                ⚙️ {isRtl ? "تكليف فني بالتركيب" : "Affecter un Technicien"}
              </h3>
              <button onClick={() => setDispatchItem(null)} className="rounded-md p-1 hover:bg-accent text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 border text-xs">
                <div className="font-bold text-foreground">Abonné: {dispatchItem.client_name}</div>
                <div className="text-muted-foreground mt-1">Adresse: {dispatchItem.residence} {dispatchItem.bloc} - Appt {dispatchItem.appartement}</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  {isRtl ? "التقني المعيّن" : "Sélectionner le technicien"}
                </label>
                <select
                  value={selectedTech}
                  onChange={(e) => setSelectedTech(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold"
                >
                  {techniciansList.map((t) => (
                    <option key={t.id} value={t.name}>
                      🛠️ {t.name} ({t.email})
                    </option>
                  ))}
                  {techniciansList.length === 0 && (
                    <option value="Anis Ben Salah">Anis Ben Salah</option>
                  )}
                </select>
              </div>

              <button
                onClick={handleDispatchInstallation}
                className="w-full rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/10 transition mt-2"
              >
                {isRtl ? "تأكيد التكليف" : "Confirmer l'affectation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nouveau Raccordement */}
      {newInstOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form onSubmit={handleCreateInstallation} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
            <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className="font-bold text-xs uppercase text-primary tracking-wide">
                ➕ {isRtl ? "تسجيل طلب توصيل جديد" : "Nouvelle Demande d'Installation"}
              </h3>
              <button type="button" onClick={() => setNewInstOpen(false)} className="rounded-md p-1 hover:bg-accent text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-right">
              <div className={isRtl ? "text-right" : "text-left"}>
                <label className="text-xs font-semibold text-muted-foreground">{isRtl ? "اسم المشترك كامل" : "Nom complet du client"}</label>
                <input
                  required
                  placeholder="e.g. Salim Ben Ali"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{isRtl ? "الإقامة / المجمع" : "Résidence"}</label>
                  <select
                    value={instResidence}
                    onChange={(e) => setInstResidence(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Kamélia">Kamélia</option>
                    <option value="El Menzah">El Menzah</option>
                    <option value="La Marsa">La Marsa</option>
                    <option value="Ariana">Ariana</option>
                    <option value="Ennasr">Ennasr</option>
                  </select>
                </div>

                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{isRtl ? "الكتلة / Bloc" : "Bloc"}</label>
                  <input
                    required
                    placeholder="e.g. Bloc A"
                    value={instBloc}
                    onChange={(e) => setInstBloc(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{isRtl ? "الشقة" : "Appartement"}</label>
                  <input
                    required
                    placeholder="e.g. A.3"
                    value={instAppt}
                    onChange={(e) => setInstAppt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{isRtl ? "الطابق" : "Étage"}</label>
                  <input
                    placeholder="e.g. 1"
                    value={instEtage}
                    onChange={(e) => setInstEtage(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{isRtl ? "إحداثيات GPS" : "Coordonnées GPS"}</label>
                  <input
                    placeholder="e.g. 36.8671,10.2253"
                    value={instGps}
                    onChange={(e) => setInstGps(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{isRtl ? "تفاصيل إضافية" : "Commentaire / Note"}</label>
                  <input
                    placeholder="Ex: Raccordement standard"
                    value={instNotes}
                    onChange={(e) => setInstNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/10 transition"
            >
              {isRtl ? "تسجيل الطلب وإدراجه" : "Enregistrer la demande"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
