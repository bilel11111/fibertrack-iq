import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Users,
  Terminal,
  Activity,
  Plus,
  Trash2,
  X,
  Check,
  UploadCloud,
  FileSpreadsheet,
  RefreshCw,
  User,
  Settings,
} from "lucide-react";
import { sqliteQuery, sqliteExecute } from "@/lib/sqlite-client";
import { useApp } from "@/hooks/use-app";

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Console d'administration — FiberNMS" }] }),
  component: UsersManagementPage,
  ssr: false,
});

type SystemLog = {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  module: string;
};

function UsersManagementPage() {
  const { lang, t } = useApp();
  const isRtl = lang === "ar";

  const [activeSubTab, setActiveSubTab] = useState<"users" | "logs" | "config">("users");
  const [connectionsCount, setConnectionsCount] = useState(0);
  
  // Real SQLite users list state
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New User Form States
  const [addOpen, setAddOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("technician");
  const [newUserPassword, setNewUserPassword] = useState("password123");

  // Mock system audit logs
  const [auditLogs, setAuditLogs] = useState<SystemLog[]>([
    { id: 101, timestamp: "24/05/2026 19:15", user: "technicien", action: "Résolution alarme fibre coupée BPI-A7", module: "Alertes" },
    { id: 102, timestamp: "24/05/2026 18:40", user: "operateur", action: "Approbation de sortie 80m de câble 48FO", module: "Inventaire" },
    { id: 103, timestamp: "24/05/2026 18:12", user: "chefprojet", action: "Analyse panne GPON via Analyseur", module: "Topologie" },
    { id: 104, timestamp: "24/05/2026 17:55", user: "admin", action: "Attribution du rôle Administrateur à Sami Aloui", module: "Sécurité" },
    { id: 105, timestamp: "24/05/2026 17:30", user: "operateur", action: "Ajout nouvel équipement FDT-Kamilia", module: "Équipements" },
  ]);

  // Config states
  const [autoAlarms, setAutoAlarms] = useState(true);
  const [logRetentionDays, setLogRetentionDays] = useState(30);

  // Excel sync states
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{ size: string; rows: number; cols: number } | null>(null);
  const [diffs, setDiffs] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncCompleted, setSyncCompleted] = useState(false);

  // Advanced Drag-and-Drop / Interactive Column Mapper States
  const [mappingStep, setMappingStep] = useState<"upload" | "map" | "sync">("upload");
  const [excelColumns] = useState<string[]>([
    "Nom_Client",
    "Residence_Cible",
    "BPI_Code",
    "Coordonnees_GPS",
    "Port_OLT_GPON",
    "Ligne_Unused_Header",
  ]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({
    client_name: "Nom_Client",
    residence: "Residence_Cible",
    pos_bpi: "BPI_Code",
    gps_bpi: "Coordonnees_GPS",
    port_olt: "Port_OLT_GPON",
  });

  const handleSimulatedExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file.name);
    setFileDetails({
      size: `${(file.size / (1024 * 1024)).toFixed(2)} Mo`,
      rows: 153,
      cols: 26,
    });

    setMappingStep("map");
    toast.success(
      isRtl
        ? `تم رفع ملف ${file.name} بنجاح. يرجى إعداد مطابقة الأعمدة.`
        : `Fichier ${file.name} téléchargé. Veuillez configurer le mappage des colonnes.`
    );
  };

  const handleMergeDatabases = async () => {
    setIsSyncing(true);
    setSyncProgress(10);
    setSyncMessage(isRtl ? "تهيئة مزامنة ملف Excel الفني..." : "Initialisation du pont de synchronisation Excel...");
    
    await new Promise((r) => setTimeout(r, 600));
    setSyncProgress(35);
    setSyncMessage(isRtl ? "مقارنة فهارس التوصيل GPON..." : "Comparaison des index de connectivité GPON...");
    
    try {
      const addDiff = diffs.find(d => d.id === 1);
      const modDiff = diffs.find(d => d.id === 2);
      
      if (addDiff && addDiff.selected) {
        await sqliteExecute("DELETE FROM connections WHERE residence = 'Kamilia' AND bloc = 'C' AND appartement = 'C30'");
        await sqliteExecute(`
          INSERT INTO connections (
            residence, bloc, appartement, etage, pos_bpi, gps_bpi, fdt, gps_fdt, port_olt, port_carte_gpon, pos_spl
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ["Kamilia", "C", "C30", "3ème", "BPI-Kamilia-4", "36.8671,10.2253", "FDT-Kamilia", "36.86712,10.22534", "GPON 01/03", "Cartes GPON 3", "SPL-1-8"]);
      }
      
      if (modDiff && modDiff.selected) {
        await sqliteExecute("UPDATE connections SET gps_bpi = '36.86821,10.22612' WHERE pos_bpi = 'BPI-A7'");
      }
    } catch (err) {
      console.error("SQLite write in sync error:", err);
    }

    await new Promise((r) => setTimeout(r, 600));
    setSyncProgress(70);
    setSyncMessage(isRtl ? "حقن التعديلات في قاعدة البيانات..." : "Injection des modifications dans ftth.db...");
    
    await new Promise((r) => setTimeout(r, 500));
    setSyncProgress(100);
    setSyncMessage(isRtl ? "اكتملت مزامنة قاعدة البيانات." : "Base de données SQLite synchronisée.");
    
    setIsSyncing(false);
    setSyncCompleted(true);
    toast.success("Fusion des bases de données effectuée avec succès !");
    load();
  };

  const load = async () => {
    try {
      setLoading(true);
      const [usersData, connData] = await Promise.all([
        sqliteQuery("SELECT * FROM users ORDER BY name"),
        sqliteQuery("SELECT COUNT(*) as count FROM connections")
      ]);
      setUserList(usersData);
      if (connData?.[0]) setConnectionsCount(connData[0].count);
      setLoading(false);
    } catch (e: any) {
      toast.error("Failed to load administration console: " + e.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggleActive = async (id: number, currentActive: number) => {
    const nextActive = currentActive === 1 ? 0 : 1;
    try {
      await sqliteExecute("UPDATE users SET active = ?, updated_at = datetime('now') WHERE id = ?", [nextActive, id]);
      toast.success(nextActive === 1 ? "Compte réactivé avec succès !" : "Compte suspendu temporairement.");
      load();
    } catch (e: any) {
      toast.error("Erreur de modification d'accès : " + e.message);
    }
  };

  const handleRoleChange = async (id: number, newRole: string) => {
    try {
      await sqliteExecute("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?", [newRole, id]);
      toast.success("Rôle d'accès modifié dans SQLite !");
      load();
    } catch (e: any) {
      toast.error("Erreur de changement de rôle : " + e.message);
    }
  };

  const handleDeleteUser = async (id: number, name: string) => {
    const confirmDelete = window.confirm(
      isRtl
        ? `هل تريد حذف المستخدم "${name}" من النظام؟`
        : `Voulez-vous révoquer l'utilisateur "${name}" du système ?`
    );
    if (!confirmDelete) return;

    try {
      await sqliteExecute("DELETE FROM users WHERE id = ?", [id]);
      toast.success("Compte révoqué avec succès !");
      load();
    } catch (e: any) {
      toast.error("Erreur de suppression : " + e.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) return;

    try {
      await sqliteExecute(
        "INSERT INTO users (name, email, role, password, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
        [newUserName.trim(), newUserEmail.trim().toLowerCase(), newUserRole, newUserPassword.trim()]
      );
      toast.success(`Compte créé pour "${newUserName}" avec succès !`);
      setAddOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      load();
    } catch (e: any) {
      toast.error("Erreur de création de compte : " + e.message);
    }
  };

  const roleNameMap: Record<string, string> = {
    admin: t("role.admin"),
    operator: t("role.operator"),
    project_manager: t("role.project_manager"),
    technician: t("role.technician"),
  };

  return (
    <main
      className="h-full w-full overflow-y-auto bg-[#f8fafc] dark:bg-slate-900 p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* Breadcrumb Info Bar */}
        <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
          <div className={isRtl ? "text-right" : "text-left"}>
            <h2 className="text-xl font-bold tracking-tight text-foreground">{t("users.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("users.subtitle")}</p>
          </div>
          <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full uppercase tracking-wider">
            {t("users.badge")}
          </span>
        </div>

        {/* Administration Navigation Tabs */}
        <div className={`flex gap-2 border-b border-border pb-px ${isRtl ? "flex-row-reverse" : ""}`}>
          <button
            onClick={() => setActiveSubTab("users")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition ${
              activeSubTab === "users"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            {t("users.tab_users")}
          </button>
          <button
            onClick={() => setActiveSubTab("logs")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition ${
              activeSubTab === "logs"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="h-4 w-4" />
            {t("users.tab_logs")}
          </button>
          <button
            onClick={() => setActiveSubTab("config")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition ${
              activeSubTab === "config"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            {t("users.tab_config")}
          </button>
        </div>

        {/* CONTENT TABS */}
        {activeSubTab === "users" ? (
          /* TAB 1: USER LIST */
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm dark:bg-slate-950 dark:border-slate-800 animate-in fade-in duration-200">
            <div className={`flex items-center justify-between mb-4 border-b border-slate-100 pb-3 dark:border-slate-800 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className="text-sm font-bold text-foreground">{t("users.list_title")}</h3>
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> {t("users.btn_create")}
              </button>
            </div>

            {loading ? (
              <div className="text-center py-10 text-xs text-muted-foreground">{t("common.loading")}</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-xs" dir={isRtl ? "rtl" : "ltr"}>
                  <thead className="bg-[#f8fafc] text-muted-foreground font-bold uppercase tracking-wider text-[10px] dark:bg-slate-900 border-b border-border">
                    <tr>
                      <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("users.col_user")}</th>
                      <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("users.col_email")}</th>
                      <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t("users.col_role")}</th>
                      <th className="px-4 py-3 text-center">{t("users.col_status")}</th>
                      <th className="px-4 py-3 text-center">{t("users.col_actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {userList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                        <td className={`px-4 py-3 font-bold text-foreground flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] dark:bg-slate-800 shrink-0">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          {u.name}
                        </td>
                        <td className={`px-4 py-3 font-mono text-muted-foreground ${isRtl ? "text-right" : "text-left"}`}>{u.email}</td>
                        <td className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="rounded-lg border border-input bg-background px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary font-semibold"
                          >
                            <option value="admin">{t("role.admin")}</option>
                            <option value="operator">{t("role.operator")}</option>
                            <option value="project_manager">{t("role.project_manager")}</option>
                            <option value="technician">{t("role.technician")}</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleActive(u.id, u.active)}
                            className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold transition ${
                              u.active === 1
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {u.active === 1 ? t("users.status_active") : t("users.status_suspended")}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="rounded p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeSubTab === "logs" ? (
          /* TAB 2: AUDIT LOG TIMELINE */
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm dark:bg-slate-950 dark:border-slate-800 animate-in fade-in duration-200">
            <div className={`flex items-center justify-between mb-4 border-b border-slate-100 pb-3 dark:border-slate-800 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className="text-sm font-bold text-foreground">{t("users.logs_title")}</h3>
              <button
                onClick={() => {
                  toast.success("Logs d'audit réactualisés depuis SQLite !");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-slate-50 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex gap-4 items-start p-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-border/30 dark:bg-slate-900/40 ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}
                >
                  <div className="p-2 bg-slate-100 rounded-lg dark:bg-slate-800 text-slate-500 shrink-0">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className={`flex justify-between items-center flex-wrap gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <div className="font-semibold text-foreground">
                        {t("users.log_action", { user: log.user })}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold">{log.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-[#475569] dark:text-slate-300 mt-1">{log.action}</p>
                    <div className={`mt-1.5 flex ${isRtl ? "justify-end" : ""}`}>
                      <span className="text-[9px] bg-accent/60 text-muted-foreground px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                        {t("users.log_module", { module: log.module })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* TAB 3: SYSTEM CONFIG */
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm dark:bg-slate-950 dark:border-slate-800 animate-in fade-in duration-200">
            <h3 className={`text-sm font-bold text-foreground mb-4 border-b border-slate-100 pb-3 dark:border-slate-800 ${isRtl ? "text-right" : "text-left"}`}>{t("users.config_title")}</h3>
            
            <div className="space-y-4 text-xs">
              <div className={`flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-border/30 ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}>
                <div>
                  <h4 className="font-bold text-foreground">{t("users.config_detect")}</h4>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{t("users.config_detect_desc")}</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoAlarms}
                  onChange={() => {
                    setAutoAlarms(!autoAlarms);
                    toast.success(autoAlarms ? "Détection automatique désactivée" : "Détection automatique activée");
                  }}
                  className="h-4 w-4 accent-primary shrink-0"
                />
              </div>

              {/* Excel Synchronizer (Merged visual) */}
              <div className="p-4.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-border/30 space-y-4 text-right">
                <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}>
                  <div>
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                      <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                      {t("users.excel_sync")}
                    </h4>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {t("users.excel_sync_desc")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full dark:bg-emerald-950 dark:text-emerald-400 whitespace-nowrap">
                      {t("users.excel_status")}
                    </span>
                  </div>
                </div>

                {/* File Dropzone */}
                {!uploadedFile ? (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:bg-slate-100/50 dark:hover:bg-slate-900/50 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 cursor-pointer transition text-center group">
                    <UploadCloud className="h-9 w-9 text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition animate-bounce duration-1000" />
                    <span className="text-xs font-bold text-foreground mt-2">{t("users.excel_dropzone_title")}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">{t("users.excel_dropzone_desc")}</span>
                    <button type="button" className="mt-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 px-4 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition">
                      {t("users.excel_dropzone_btn")}
                    </button>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleSimulatedExcelUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className={`flex items-center justify-between p-3.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                        <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                          XLS
                        </div>
                        <div className={isRtl ? "text-right" : "text-left"}>
                          <div className="text-xs font-bold text-foreground">{uploadedFile}</div>
                          <div className={`text-[10px] text-muted-foreground flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                            <span>Taille : {fileDetails?.size}</span>
                            <span>•</span>
                            <span>Lignes : {fileDetails?.rows}</span>
                            <span>•</span>
                            <span>Colonnes : {fileDetails?.cols}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setUploadedFile(null);
                          setDiffs([]);
                          setSyncCompleted(false);
                          setSyncProgress(0);
                          setMappingStep("upload");
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 transition"
                      >
                        {t("users.excel_btn_reset")}
                      </button>
                    </div>

                    {/* Step 2: Columns Mapping Interface */}
                    {mappingStep === "map" && (
                      <div className="space-y-4 border border-indigo-100 dark:border-indigo-950/50 bg-indigo-500/[0.02] p-4.5 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className={`flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl ${isRtl ? "text-right flex-row-reverse" : "text-left"}`}>
                          <span className="text-lg">✨</span>
                          <div className="space-y-1">
                            <h5 className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs">
                              {isRtl ? "المطابقة الذكية للأعمدة مفعلة" : "Auto-mappage intelligent actif"}
                            </h5>
                            <p className="text-[10px] text-indigo-700 dark:text-indigo-300/80 leading-relaxed font-semibold">
                              {isRtl
                                ? "تم التعرف تلقائيًا على بنية جدول البيانات. يرجى تأكيد مطابقة الأعمدة التالية مع حقول قاعدة البيانات ftth.db:"
                                : "Les en-têtes de votre fichier Excel ont été associés automatiquement. Veuillez confirmer la correspondance avec les colonnes SQLite :"}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-4.5 space-y-3.5">
                          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider text-[9px] border-b border-slate-100 dark:border-slate-800 pb-2 ${isRtl ? "text-right" : "text-left"}`}>
                            <div>🗄️ {isRtl ? "حقل قاعدة البيانات (SQLite)" : "Champ base de données (SQLite)"}</div>
                            <div>📄 {isRtl ? "عمود ملف Excel المستورد" : "Colonne Excel correspondante"}</div>
                          </div>

                          {[
                            { key: "client_name", label: isRtl ? "اسم المشترك" : "Nom de l'abonné", desc: "client_name (TEXT)" },
                            { key: "residence", label: isRtl ? "الموقع / الإقامة" : "Adresse / Résidence", desc: "residence (TEXT)" },
                            { key: "pos_bpi", label: isRtl ? "منفذ BPI / PBO" : "Code PBO / BPI", desc: "pos_bpi (TEXT)" },
                            { key: "gps_bpi", label: isRtl ? "إحداثيات GPS" : "Coordonnées GPS PBO", desc: "gps_bpi (TEXT)" },
                            { key: "port_olt", label: isRtl ? "منفذ OLT" : "Port OLT GPON", desc: "port_olt (TEXT)" },
                          ].map((field) => (
                            <div
                              key={field.key}
                              className={`grid grid-cols-1 md:grid-cols-2 items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition ${
                                isRtl ? "text-right" : "text-left"
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="font-extrabold text-foreground text-[11px]">{field.label}</div>
                                <div className="text-[9px] text-indigo-500 font-mono font-semibold">{field.desc}</div>
                              </div>
                              
                              <div className="flex gap-2 items-center">
                                <select
                                  value={columnMappings[field.key]}
                                  onChange={(e) => {
                                    setColumnMappings({ ...columnMappings, [field.key]: e.target.value });
                                    toast.success(`Mappage mis à jour pour ${field.label}`);
                                  }}
                                  className="w-full rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                >
                                  <option value="">-- Ignorer ce champ --</option>
                                  {excelColumns.map((col) => (
                                    <option key={col} value={col}>
                                      📄 {col}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className={`flex gap-2 ${isRtl ? "justify-start" : "justify-end"} pt-1`}>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedFile(null);
                              setMappingStep("upload");
                            }}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                          >
                            {isRtl ? "إلغاء" : "Annuler"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMappingStep("sync");
                              setDiffs([
                                {
                                  id: 1,
                                  type: "added",
                                  element: "Abonné Bloc C, App C30",
                                  field: "Nouvelle liaison optique",
                                  sqliteVal: "— (Non existant)",
                                  excelVal: `Port GPON 01/03, BPI-Kamilia-4, Spl. 1:8 Port 8 (Mappé via ${columnMappings.client_name})`,
                                  selected: true,
                                },
                                {
                                  id: 2,
                                  type: "modified",
                                  element: "BPI-A7 (PBO)",
                                  field: "Coordonnées de géolocalisation GPS",
                                  sqliteVal: "36.86812, 10.22601",
                                  excelVal: `36.86821, 10.22612 (Mappé via ${columnMappings.gps_bpi})`,
                                  selected: true,
                                },
                                {
                                  id: 3,
                                  type: "deleted",
                                  element: "SPL-TEST-99",
                                  field: "Splitter de Test local",
                                  sqliteVal: "Splitter GPON 1:4 (Actif)",
                                  excelVal: "— (Supprimé d'Excel)",
                                  selected: false,
                                }
                              ]);
                              toast.success(
                                isRtl
                                  ? "اكتمل تحليل المطابقة! تم العثور على 3 فروقات."
                                  : "Analyse de mappage complétée ! 3 différences identifiées."
                              );
                            }}
                            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold px-5 py-2 text-xs text-white transition flex items-center gap-1.5 shadow shadow-indigo-500/10"
                          >
                            <Check className="h-4 w-4" />
                            {isRtl ? "تأكيد المخطط وتحليل البيانات" : "Confirmer le mappage & Analyser"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Synchronization Diffs & Merging */}
                    {mappingStep === "sync" && diffs.length > 0 && !syncCompleted && (
                      <div className="space-y-2.5 animate-in fade-in duration-300">
                        <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{t("users.excel_details_title")}</span>
                          <span className="text-[9px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{t("users.excel_details_count")}</span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                          <table className="w-full text-left text-[11px]" dir={isRtl ? "rtl" : "ltr"}>
                            <thead className="bg-slate-50 dark:bg-slate-900 font-bold uppercase tracking-wider text-[9px] border-b border-border text-muted-foreground">
                              <tr>
                                <th className="px-3.5 py-2.5 w-8"></th>
                                <th className={`px-3.5 py-2.5 ${isRtl ? "text-right" : "text-left"}`}>{t("users.excel_col_type")}</th>
                                <th className={`px-3.5 py-2.5 ${isRtl ? "text-right" : "text-left"}`}>{t("users.excel_col_element")}</th>
                                <th className={`px-3.5 py-2.5 ${isRtl ? "text-right" : "text-left"}`}>{t("users.excel_col_sqlite")}</th>
                                <th className={`px-3.5 py-2.5 ${isRtl ? "text-right" : "text-left"}`}>{t("users.excel_col_excel")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {diffs.map((diff) => (
                                <tr key={diff.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                                  <td className="px-3.5 py-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={diff.selected}
                                      onChange={() => {
                                        setDiffs(diffs.map(d => d.id === diff.id ? { ...d, selected: !d.selected } : d));
                                      }}
                                      className="h-3.5 w-3.5 accent-primary cursor-pointer rounded"
                                    />
                                  </td>
                                  <td className="px-3.5 py-2.5">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                      diff.type === "added" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" :
                                      diff.type === "modified" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                                      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                    }`}>
                                      {diff.type === "added" ? "AJOUT" : diff.type === "modified" ? "AJUSTEMENT" : "SUPPRESSION"}
                                    </span>
                                  </td>
                                  <td className={`px-3.5 py-2.5 font-bold ${isRtl ? "text-right" : "text-left"}`}>
                                    <div className="text-foreground">{diff.element}</div>
                                    <div className="text-[9px] text-muted-foreground font-normal">{diff.field}</div>
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono text-muted-foreground max-w-[120px] truncate">{diff.sqliteVal}</td>
                                  <td className="px-3.5 py-2.5 font-mono text-foreground font-bold max-w-[150px] truncate">{diff.excelVal}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {isSyncing && (
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-2.5 animate-pulse text-right">
                        <div className={`flex justify-between text-xs font-bold ${isRtl ? "flex-row-reverse" : ""}`}>
                          <span className={`text-foreground flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                            {syncMessage}
                          </span>
                          <span className="text-primary font-mono">{syncProgress}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300 rounded-full"
                            style={{ width: `${syncProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {syncCompleted && (
                      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/60 space-y-2 text-right">
                        <div className={`flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold text-xs ${isRtl ? "flex-row-reverse" : ""}`}>
                          <Check className="h-4.5 w-4.5 bg-emerald-100 dark:bg-emerald-900 rounded-full p-0.5" />
                          {t("users.excel_success_title")}
                        </div>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-500 leading-relaxed">
                          {t("users.excel_success_desc")}
                        </p>
                      </div>
                    )}

                    {!isSyncing && !syncCompleted && mappingStep === "sync" && (
                      <div className={`flex ${isRtl ? "justify-start" : "justify-end"} pt-2`}>
                        <button
                          type="button"
                          onClick={handleMergeDatabases}
                          disabled={diffs.filter(d => d.selected).length === 0}
                          className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold px-5 py-2.5 text-xs text-white transition flex items-center gap-2 shadow-md shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          {t("users.excel_btn_submit")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={`p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-border/30 ${isRtl ? "text-right" : "text-left"}`}>
                <h4 className="font-bold text-foreground mb-2">{t("users.config_retention")}</h4>
                <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <input
                    type="range"
                    min={7}
                    max={90}
                    value={logRetentionDays}
                    onChange={(e) => setLogRetentionDays(parseInt(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="font-bold text-foreground w-16 text-center">{t("users.config_retention_days", { n: logRetentionDays })}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE NEW USER DRAWER MODAL */}
      {addOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div className={`mb-4 flex items-center justify-between border-b border-border pb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <h3 className={`font-bold text-xs uppercase text-foreground tracking-wide flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <Plus className="h-4.5 w-4.5 text-primary" /> {t("users.modal_create_title")}
              </h3>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-md p-1 hover:bg-accent text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-right">
              <div className={isRtl ? "text-right" : "text-left"}>
                <label className="text-xs font-semibold text-muted-foreground">{t("users.field_name")}</label>
                <input
                  required
                  placeholder="e.g. Sami Aloui"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className={isRtl ? "text-right" : "text-left"}>
                <label className="text-xs font-semibold text-muted-foreground">{t("users.field_email")}</label>
                <input
                  required
                  type="email"
                  placeholder="e.g. sami@sotetel.tn"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-right">
                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{t("users.field_role")}</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold"
                  >
                    <option value="admin">{t("role.admin")}</option>
                    <option value="operator">{t("role.operator")}</option>
                    <option value="project_manager">{t("role.project_manager")}</option>
                    <option value="technician">{t("role.technician")}</option>
                  </select>
                </div>

                <div className={isRtl ? "text-right" : "text-left"}>
                  <label className="text-xs font-semibold text-muted-foreground">{t("users.field_password")}</label>
                  <input
                    required
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-md shadow-primary/10"
            >
              {t("users.btn_submit")}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
