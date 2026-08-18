import { createFileRoute, Outlet, Navigate, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useApp, ZONES } from "@/hooks/use-app";
import { useState, useEffect } from "react";
import {
  Map,
  Package,
  LogOut,
  LayoutDashboard,
  AlertTriangle,
  Cpu,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Bell,
  Sun,
  Moon,
  Shield,
  Sparkles,
  Users,
  Building2,
  Globe,
  MapPin,
  HelpCircle,
  X,
} from "lucide-react";
import { AIAssistant } from "@/components/AIAssistant";
import { toast } from "sonner";
import { sqliteQuery } from "@/lib/sqlite-client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
  ssr: false,
});

function LogoIcon() {
  return (
    <svg
      className="h-8 w-8 min-w-[2rem] select-none filter drop-shadow-[0_2px_6px_rgba(236,72,153,0.25)] hover:scale-105 transition-transform duration-200"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="42" stroke="url(#logo-grad)" strokeWidth="3.5" strokeDasharray="6 6" opacity="0.3" className="animate-spin-slow" />
      <path
        d="M25 50C25 35 37.5 25 50 25C62.5 25 75 35 75 50C75 65 62.5 75 50 75C37.5 75 25 65 25 50Z"
        stroke="url(#logo-grad)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="50" r="9" fill="url(#logo-grad)" />
      <circle cx="50" cy="50" r="3.5" fill="white" className="animate-pulse" />
    </svg>
  );
}

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { lang, setLang, zone, setZone, t } = useApp();
  const loc = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const isRtl = lang === "ar";

  // Clients & Abonnés Live Portal States
  const [clientDrawerOpen, setClientDrawerOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientFilterActive, setClientFilterActive] = useState<"all" | "active">("all");
  const [rebootingClient, setRebootingClient] = useState<number | null>(null);
  const [laserChecking, setLaserChecking] = useState<number | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ft_theme");
      if (saved === "dark" || saved === "light") return saved;
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const saved = localStorage.getItem("ft_theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      setTheme("light");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("ft_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    toast.success(nextTheme === "dark" ? t("layout.dark_enabled") : t("layout.light_enabled"));
  };

  // Load alert count on mount and periodically
  useEffect(() => {
    const loadAlertCount = async () => {
      try {
        const activeAlerts = await sqliteQuery("SELECT COUNT(*) as count FROM alerts WHERE status != 'Resolved'");
        if (activeAlerts && activeAlerts[0]) {
          setAlertCount(activeAlerts[0].count || 0);
        }
      } catch (e) {
        console.error("Failed to load alert count:", e);
      }
    };

    loadAlertCount();
    const interval = setInterval(loadAlertCount, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Load subscriber connections from SQLite on mount
  useEffect(() => {
    sqliteQuery("SELECT * FROM connections")
      .then((data) => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch((err) => {
        console.error("Failed to load subscriber list:", err);
      });
  }, [clientDrawerOpen]);

  const handleBellClick = async () => {
    try {
      const activeAlerts = await sqliteQuery("SELECT message FROM alerts WHERE status != 'Resolved'");
      if (activeAlerts.length > 0) {
        toast.error(t("layout.bell_alerts", { n: activeAlerts.length }));
        // Navigate to alerts page if user is technician
        if (role === "technician") {
          navigate({ to: "/alerts" });
        }
      } else {
        toast.success(t("layout.bell_ok", { zone: zone === "Toutes les zones" ? t("layout.all_zones") : zone }));
      }
    } catch (e: any) {
      console.error("Bell notification error:", e);
      toast.error(`Erreur de notification: ${e.message || "Impossible de récupérer les alertes"}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground bg-[#f8fafc]">
        {t("layout.loading")}
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  const role = user.role || "technician";

  const roleNameMap: Record<string, string> = {
    admin: t("role.admin"),
    operator: t("role.operator"),
    project_manager: t("role.project_manager"),
    technician: t("role.technician"),
  };
  const userRole = roleNameMap[role] || t("role.technician");

  const getHeaderInfo = () => {
    const path = loc.pathname;
    if (path === "/" || path === "") return { title: t("nav.dashboard"), breadcrumb: t("nav.dashboard") };
    if (path.startsWith("/alerts")) return { title: t("nav.alerts"), breadcrumb: t("nav.alerts") };
    if (path.startsWith("/equipements")) return { title: t("nav.equipements"), breadcrumb: t("nav.equipements") };
    if (path.startsWith("/map")) return { title: t("nav.localisation"), breadcrumb: t("nav.localisation") };
    if (path.startsWith("/topology")) return { title: t("nav.topology"), breadcrumb: t("nav.topology") };
    if (path.startsWith("/materials")) return { title: t("nav.materials"), breadcrumb: t("nav.materials") };
    if (path.startsWith("/users")) return { title: t("nav.users"), breadcrumb: t("nav.users") };
    if (path.startsWith("/clients")) return { title: isRtl ? "طلبات التوصيل والتركيب" : "Chantiers & Raccordements", breadcrumb: isRtl ? "العملاء" : "Clients" };
    return { title: "FiberNMS", breadcrumb: t("nav.dashboard") };
  };
  const { title: pageTitle, breadcrumb } = getHeaderInfo();

  const checkAccess = () => {
    const path = loc.pathname;
    if (role === "admin") return true; // admin has access to everything
    if (path === "/" || path === "") return ["admin", "project_manager"].includes(role);
    if (path.startsWith("/users")) return ["admin"].includes(role);
    if (path.startsWith("/materials")) return ["operator"].includes(role);
    if (path.startsWith("/equipements")) return ["operator", "technician"].includes(role);
    if (path.startsWith("/map")) return ["project_manager", "technician"].includes(role);
    if (path.startsWith("/topology")) return ["project_manager"].includes(role);
    if (path.startsWith("/alerts")) return ["technician"].includes(role);
    if (path.startsWith("/clients")) return ["admin", "project_manager", "technician"].includes(role);
    return true;
  };
  const hasAccess = checkAccess();

  const getAllowedRolesForRoute = () => {
    const path = loc.pathname;
    if (path === "/" || path === "") return [t("role.admin"), t("role.project_manager")];
    if (path.startsWith("/users")) return [t("role.admin")];
    if (path.startsWith("/materials")) return [t("role.operator"), t("role.admin")];
    if (path.startsWith("/equipements")) return [t("role.operator"), t("role.technician"), t("role.admin")];
    if (path.startsWith("/map")) return [t("role.project_manager"), t("role.technician"), t("role.admin")];
    if (path.startsWith("/topology")) return [t("role.project_manager"), t("role.admin")];
    if (path.startsWith("/alerts")) return [t("role.technician"), t("role.admin")];
    if (path.startsWith("/clients")) return [t("role.admin"), t("role.project_manager"), t("role.technician")];
    return [];
  };

  return (
    <div
      className="flex h-screen w-screen bg-[#f8fafc] text-[#1e293b] overflow-hidden dark:bg-slate-950 dark:text-slate-50"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Collapsible Sidebar */}
      <aside
        className={`relative flex flex-col border-r border-[#e2e8f0] bg-white shadow-sm transition-all duration-300 dark:bg-slate-950 dark:border-slate-800 shrink-0 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Branding */}
        <div className="flex h-16 items-center justify-between px-3 border-b border-[#e2e8f0] dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/10">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <LogoIcon />
            {!collapsed && (
              <div className="flex flex-col select-none leading-none animate-in fade-in duration-200">
                <span className="text-[13px] font-black tracking-tight bg-gradient-to-r from-orange-500 via-pink-500 to-indigo-500 bg-clip-text text-transparent">
                  FiberTrack
                </span>
                <span className="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                  IQ Supervision
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex h-6 w-6 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </div>

        {/* User Role Card */}
        <div className="p-3 border-b border-[#e2e8f0] dark:border-slate-800">
          <div className={`flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2.5 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex h-8 w-8 min-w-[2rem] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white font-bold text-xs uppercase shadow-sm">
              {user.email?.slice(0, 1).toUpperCase() || "A"}
            </div>
            {!collapsed && (
              <div className="overflow-hidden leading-tight">
                <div className="text-xs font-semibold truncate text-[#334155] dark:text-slate-200">{user.email}</div>
                <div className="text-[9px] text-emerald-600 font-extrabold mt-0.5 uppercase tracking-wide">
                  {userRole}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zone Selector (when not collapsed) */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-[#e2e8f0] dark:border-slate-800">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{t("layout.zone_label")}</span>
            </div>
            <select
              value={zone}
              onChange={(e: any) => setZone(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary transition"
            >
              {ZONES.map(z => (
                <option key={z} value={z}>
                  {z === "Toutes les zones" ? t("layout.all_zones") : z}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-3.5 p-2 overflow-y-auto">
          {/* CATEGORY 1: PILOTAGE & SUPERVISION */}
          {["admin", "project_manager", "technician"].includes(role) && (
            <div className="space-y-1">
              {!collapsed && (
                <div className={`px-3 mb-1.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${isRtl ? "text-right" : "text-left"}`}>
                  {isRtl ? "المراقبة والتوجيه" : "Supervision & Pilotage"}
                </div>
              )}
              {(role === "admin" || role === "project_manager") && (
                <NavLink to="/" active={loc.pathname === "/"} icon={<LayoutDashboard className="h-4 w-4 text-orange-500" />} collapsed={collapsed}>
                  {t("nav.dashboard")}
                </NavLink>
              )}

              {(role === "admin" || role === "project_manager" || role === "technician") && (
                <NavLink to="/map" active={loc.pathname.startsWith("/map")} icon={<Map className="h-4 w-4 text-indigo-500" />} collapsed={collapsed}>
                  {t("nav.localisation")}
                </NavLink>
              )}

              {(role === "admin" || role === "project_manager") && (
                <NavLink to="/topology" active={loc.pathname.startsWith("/topology")} icon={<GitBranch className="h-4 w-4 text-violet-500" />} collapsed={collapsed}>
                  {t("nav.topology")}
                </NavLink>
              )}
            </div>
          )}

          {/* CATEGORY 2: RESSOURCES & OPÉRATIONS */}
          {["admin", "operator", "technician"].includes(role) && (
            <div className="space-y-1">
              {!collapsed && (
                <div className={`px-3 mb-1.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${isRtl ? "text-right" : "text-left"}`}>
                  {isRtl ? "المعدات والعمليات" : "Ressources & Terrain"}
                </div>
              )}
              {(role === "admin" || role === "operator" || role === "technician") && (
                <NavLink to="/equipements" active={loc.pathname.startsWith("/equipements")} icon={<Cpu className="h-4 w-4 text-blue-500" />} collapsed={collapsed}>
                  {t("nav.equipements")}
                </NavLink>
              )}

              {(role === "admin" || role === "operator") && (
                <NavLink to="/materials" active={loc.pathname.startsWith("/materials")} icon={<Package className="h-4 w-4 text-amber-500" />} collapsed={collapsed}>
                  {t("nav.materials")}
                </NavLink>
              )}

              {(role === "admin" || role === "technician") && (
                <NavLink to="/alerts" active={loc.pathname.startsWith("/alerts")} icon={<AlertTriangle className="h-4 w-4 text-rose-500" />} collapsed={collapsed}>
                  {t("nav.alerts")}
                </NavLink>
              )}
            </div>
          )}

          {/* CATEGORY 3: PORTAIL ABONNÉS & DIAGNOSTIC */}
          {["admin", "project_manager", "technician"].includes(role) && (
            <div className="space-y-1">
              {!collapsed && (
                <div className={`px-3 mb-1.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${isRtl ? "text-right" : "text-left"}`}>
                  {isRtl ? "العملاء والمشتركين" : "Portail Clients"}
                </div>
              )}
              <button
                type="button"
                onClick={() => setClientDrawerOpen(true)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all relative text-muted-foreground hover:bg-accent hover:text-foreground ${collapsed ? "justify-center" : ""}`}
              >
                <Users className="h-4 w-4 text-emerald-500 shrink-0" />
                {!collapsed && <span className="truncate">{isRtl ? "إدارة المشتركين" : "Clients & Activations"}</span>}
                {!collapsed && (
                  <span className="ml-auto bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-extrabold">
                    {clients.length || "153"}
                  </span>
                )}
              </button>
              
              <NavLink to="/clients" active={loc.pathname.startsWith("/clients")} icon={<Building2 className="h-4 w-4 text-teal-500" />} collapsed={collapsed}>
                {isRtl ? "طلبات التوصيل والتركيب" : "Chantiers & Raccordements"}
              </NavLink>
            </div>
          )}

          {/* CATEGORY 4: CONFIGURATION */}
          {role === "admin" && (
            <div className="space-y-1">
              {!collapsed && (
                <div className={`px-3 mb-1.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${isRtl ? "text-right" : "text-left"}`}>
                  {isRtl ? "الإدارة والنظام" : "Administration"}
                </div>
              )}
              <NavLink to="/users" active={loc.pathname.startsWith("/users")} icon={<Users className="h-4 w-4 text-teal-500" />} collapsed={collapsed}>
                {t("nav.users")}
              </NavLink>
            </div>
          )}
        </nav>

        {/* Language Toggle inside sidebar */}
        {!collapsed && (
          <div className="px-3 py-2 border-t border-[#e2e8f0] dark:border-slate-800">
            <button
              onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-1.5 text-xs font-bold hover:bg-accent transition"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang === "fr" ? "عربي" : "Français"}
            </button>
          </div>
        )}

        {/* Logout */}
        <div className="p-3 border-t border-[#e2e8f0] dark:border-slate-800">
          <button
            onClick={() => {
              signOut();
              toast.info(t("layout.disconnected"));
            }}
            className={`flex w-full items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-3 py-2 text-xs font-bold shadow-md shadow-emerald-500/15 transition duration-150 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>{t("nav.logout")}</span>}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 h-screen overflow-hidden bg-[#f8fafc] relative flex flex-col dark:bg-slate-900">
        {/* Top Header */}
        <header className="flex h-14 items-center justify-between px-6 border-b border-[#e2e8f0] bg-white shrink-0 dark:bg-slate-950 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-[#1e293b] dark:text-slate-100 truncate">{pageTitle}</span>
            <span className="text-xs text-muted-foreground/80 flex items-center shrink-0">
              <span className="mx-1.5 text-slate-300 dark:text-slate-700">/</span>
              {breadcrumb}
            </span>
            {zone !== "Toutes les zones" && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                <MapPin className="h-2.5 w-2.5" />
                {zone}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Help/Guide Button */}
            <button
              onClick={() => setGuideOpen(true)}
              className="p-1.5 rounded-full hover:bg-slate-50 text-slate-500 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
              title={t("nav.guide")}
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* AI Assistant */}
            <button
              onClick={() => setAiOpen(!aiOpen)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                aiOpen
                  ? "bg-primary text-white"
                  : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Assistant IA</span>
            </button>

            {/* Bell */}
            <button
              onClick={handleBellClick}
              className="relative p-1.5 rounded-full hover:bg-slate-50 text-slate-500 dark:text-slate-400 dark:hover:bg-slate-800 transition"
              title={alertCount > 0 ? `${alertCount} alerte(s) active(s)` : "Aucune alerte"}
            >
              <Bell className="h-4 w-4" />
              {alertCount > 0 && (
                <>
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 border border-white dark:border-slate-950 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white border border-white dark:border-slate-950">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                </>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-full hover:bg-slate-50 text-slate-500 dark:text-slate-400 dark:hover:bg-slate-800 transition"
              title={theme === "light" ? t("layout.theme_dark") : t("layout.theme_light")}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {/* User Avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white font-extrabold text-xs shadow-sm cursor-default" title={user.email}>
              {user.email?.slice(0, 1).toUpperCase() || "A"}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {hasAccess ? (
            <Outlet />
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 bg-[#f8fafc] dark:bg-slate-900 animate-in fade-in duration-200">
              <div className="w-full max-w-md rounded-2xl border border-[#e2e8f0] bg-white p-8 shadow-xl text-center dark:bg-slate-950 dark:border-slate-800">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30 mb-5 animate-bounce">
                  <Shield className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-[#1e293b] dark:text-white mb-2">{t("layout.access_denied")}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                  {t("layout.access_denied_msg", { role: userRole, module: pageTitle })}
                </p>
                <div className="bg-slate-50 rounded-xl p-3.5 border border-border text-left text-xs mb-5 dark:bg-slate-900/50">
                  <div className="font-bold text-[#475569] dark:text-slate-300 mb-1">{t("layout.allowed_roles")}</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground font-semibold">
                    {getAllowedRolesForRoute().map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      signOut();
                      navigate({ to: "/login" });
                      toast.info(t("layout.switch_account"));
                    }}
                    className="w-full rounded-xl bg-primary text-white font-bold py-2.5 text-xs hover:bg-primary/95 transition shadow-sm"
                  >
                    {t("layout.switch_account")}
                  </button>
                  <button
                    onClick={() => navigate({ to: "/" })}
                    className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-accent transition"
                  >
                    {t("layout.go_home")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* AI Assistant Panel */}
      <AIAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />

       {/* Interactive Role-Based User Guide */}
      <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* 🟢 CUSTOMER ACTIVATIONS & DIAGNOSTIC DRAWER */}
      {clientDrawerOpen && ["admin", "project_manager", "technician"].includes(role) && (
        <div className="fixed inset-0 z-[2500] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          {/* Backdrop closer */}
          <div className="absolute inset-0 cursor-default" onClick={() => setClientDrawerOpen(false)} />
          
          <div className={`relative w-full max-w-md bg-white dark:bg-slate-950 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-305 ${isRtl ? "left-0" : "right-0"}`}>
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/40 dark:bg-slate-900/10 shrink-0">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-500" />
                <div className={isRtl ? "text-right" : "text-left"}>
                  <h4 className="font-extrabold text-sm text-foreground">
                    {isRtl ? "بوابة المشتركين والخطوط" : "Portail d'Activations Clients"}
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    {isRtl ? "تشخيص وإدارة raccordements GPON" : "Diagnostic live & activation des raccordements"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setClientDrawerOpen(false);
                  setSelectedClient(null);
                }} 
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Diagnostic Details mini-panel if client selected */}
            {selectedClient && (
              <div className="p-4.5 bg-emerald-500/5 dark:bg-emerald-500/[0.02] border-b border-emerald-500/10 space-y-3.5 shrink-0 animate-in fade-in duration-200">
                <div className={`flex justify-between items-start ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}>
                  <div className="space-y-0.5">
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold dark:bg-emerald-950 dark:text-emerald-400">
                      LIVE ONT STATUS
                    </span>
                    <h5 className="font-extrabold text-foreground text-xs mt-1">
                      🏢 {selectedClient.residence} {selectedClient.bloc} - Appt {selectedClient.appartement}
                    </h5>
                  </div>
                  <button 
                    onClick={() => setSelectedClient(null)}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline"
                  >
                    {isRtl ? "رجوع للقائمة" : "‹ Retour"}
                  </button>
                </div>

                {/* Laser Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-white dark:bg-slate-900 border p-2 rounded-xl text-center">
                    <div className="text-muted-foreground tracking-wide font-semibold text-[8px] uppercase">Puissance Optique</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5 text-xs">-19.8 dBm</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border p-2 rounded-xl text-center">
                    <div className="text-muted-foreground tracking-wide font-semibold text-[8px] uppercase">Laser Temp</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5 text-xs">34.6 °C</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border p-2 rounded-xl text-center">
                    <div className="text-muted-foreground tracking-wide font-semibold text-[8px] uppercase">OLT GPON Port</div>
                    <div className="font-bold text-indigo-600 font-mono mt-0.5 text-[9px]">{selectedClient.port_olt || "GPON 01/01"}</div>
                  </div>
                </div>

                {/* Control Actions Row */}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setRebootingClient(selectedClient.id);
                      await new Promise(r => setTimeout(r, 1200));
                      setRebootingClient(null);
                      toast.success(`ONT de ${selectedClient.residence} redémarré avec succès !`);
                    }}
                    disabled={rebootingClient !== null}
                    className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-900 dark:text-slate-300 font-bold py-1.5 text-[10px] transition flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                  >
                    {rebootingClient !== null ? (
                      <span className="h-3 w-3 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                    ) : "🔄 Reboot ONT"}
                  </button>

                  <button
                    onClick={async () => {
                      setLaserChecking(selectedClient.id);
                      await new Promise(r => setTimeout(r, 1000));
                      setLaserChecking(null);
                      toast.success("Diagnostic Laser complété : Puissance optique stable (-19.8 dBm). Aucun défaut de courbure.");
                    }}
                    disabled={laserChecking !== null}
                    className="flex-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400 font-bold py-1.5 text-[10px] transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {laserChecking !== null ? (
                      <span className="h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    ) : "⚡ Diag Laser"}
                  </button>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            {!selectedClient && (
              <div className="p-3 border-b border-slate-100 dark:border-slate-850 space-y-2 shrink-0 animate-in fade-in duration-200">
                <div className="relative">
                  <input
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    placeholder={isRtl ? "ابحث عن مشترك..." : "Rechercher un abonné..."}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 px-3.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary pl-8 text-right font-medium"
                    dir={isRtl ? "rtl" : "ltr"}
                  />
                  <span className={`absolute top-2.5 z-10 text-slate-400 ${isRtl ? "right-3.5" : "left-3"}`}>🔍</span>
                </div>

                <div className={`flex gap-1.5 text-[9px] font-extrabold uppercase tracking-wide justify-center ${isRtl ? "flex-row-reverse" : ""}`}>
                  <button
                    onClick={() => setClientFilterActive("all")}
                    className={`px-2.5 py-1 rounded-full border transition ${
                      clientFilterActive === "all" ? "bg-primary border-primary text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Tous ({clients.length})
                  </button>
                  <button
                    onClick={() => setClientFilterActive("active")}
                    className={`px-2.5 py-1 rounded-full border transition ${
                      clientFilterActive === "active" ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Actifs ({clients.filter(c => c.port_olt).length})
                  </button>
                </div>
              </div>
            )}

            {/* Subscriber Connections Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/10">
              {(() => {
                const query = clientSearchQuery.toLowerCase().trim();
                const filtered = clients.filter(c => {
                  const matchSearch = 
                    c.residence?.toLowerCase().includes(query) ||
                    c.bloc?.toLowerCase().includes(query) ||
                    c.pos_bpi?.toLowerCase().includes(query) ||
                    c.port_olt?.toLowerCase().includes(query);
                  if (clientFilterActive === "active") return matchSearch && c.port_olt;
                  return matchSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-10 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      {isRtl ? "لا يوجد أي مشتركين" : "Aucun raccordement trouvé"}
                    </div>
                  );
                }

                return filtered.map((c) => {
                  const isOnline = c.port_olt !== null;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClient(c)}
                      className={`p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition cursor-pointer flex gap-3 items-center ${isRtl ? "text-right flex-row-reverse" : "text-left"}`}
                    >
                      {/* Pulse Status Indicator */}
                      <span className="relative flex h-3 w-3 shrink-0">
                        {isOnline ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-300 dark:bg-slate-700"></span>
                        )}
                      </span>

                      <div className="flex-1 leading-tight min-w-0">
                        <div className="font-extrabold text-xs text-foreground truncate">
                          🏢 {c.residence} {c.bloc} - Appt {c.appartement}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                          OLT: <span className="font-bold text-slate-600 dark:text-slate-300">{c.port_olt || "Non affecté"}</span> • BPI: <span className="font-bold text-indigo-500">{c.pos_bpi}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang, t } = useApp();
  const isRtl = lang === "ar";
  const [guideTab, setGuideTab] = useState<"dashboard" | "map" | "topology" | "equipments" | "alerts" | "clients">("dashboard");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
        <div className={`flex justify-between border-b pb-3 mb-4 items-start ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}>
          <div>
            <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
              📚 {isRtl ? "دليل النظام الشامل والأدلة الفنية" : "Guide Complet du Système & Fiches Techniques"}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isRtl ? "تعرّف على كافة أقسام تطبيق FiberTrack IQ لمراقبة وصيانة شبكات الألياف الضوئية" : "Découvrez le fonctionnement complet et l'ingénierie GPON intégrée à FiberTrack IQ"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Guide Tabs */}
        <div className={`flex gap-1 bg-accent/40 rounded-xl p-1 border border-border/80 text-[11px] mb-4 overflow-x-auto ${isRtl ? "flex-row-reverse" : ""}`}>
          {[
            { id: "dashboard", label: "📊 Tableau de bord / لوحة القيادة" },
            { id: "map", label: "📍 Cartographie / الخرائط و GPS" },
            { id: "topology", label: "🔌 Topologie & Budget / طوبولوجيا" },
            { id: "equipments", label: "⚙️ Équipements / علب اللحام" },
            { id: "alerts", label: "🚨 OTDR & Alertes / محاكي الأعطال" },
            { id: "clients", label: "👥 Portail Clients / بوابة العملاء" },
          ].map((tab) => {
            const selected = guideTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setGuideTab(tab.id as any)}
                className={`rounded-lg px-2.5 py-1.5 font-bold transition whitespace-nowrap flex-1 text-center ${
                  selected ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:bg-accent/40"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents: Bilingual grid */}
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* COLUMN 1: FRANÇAIS */}
            <div className="space-y-3.5 text-xs text-left leading-relaxed text-foreground border-r pr-4 dark:border-slate-800">
              <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 rounded font-extrabold tracking-wide uppercase">
                Guide d'utilisation en Français
              </span>
              
              {guideTab === "dashboard" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-primary flex items-center gap-1.5">📊 Tableau de Bord & Visualisations</h3>
                  <p className="text-muted-foreground">La console centrale regroupe les indicateurs d'ingénierie active pour la plaque Soukra :</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>Courbes d'activations</strong> : Suivi de croissance spline cumulée des raccordements terminés.</li>
                    <li><strong>Occupation des Splitters</strong> : Taux de saturation des ports de couplage par résidence.</li>
                    <li><strong>Bande passante GPON</strong> : Télémétrie en temps réel de flux Gbps (downlink/uplink) par zone.</li>
                    <li><strong>Signaux Optiques</strong> : Statistique de la puissance de réception (Rx) des modems abonnés (ONT).</li>
                    <li><strong>Leaderboard technique</strong> : Suivi de la charge de travail et tickets clos par chaque technicien.</li>
                  </ul>
                  <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 text-[10px] text-muted-foreground">
                    💡 <em>Astuce:</em> Utilisez le sélecteur de zone en haut du menu latéral pour filtrer dynamiquement les graphiques et le trafic par quartier.
                  </div>
                </div>
              )}

              {guideTab === "map" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-primary flex items-center gap-1.5">📍 Cartographie Live & GPS Navigation</h3>
                  <p className="text-muted-foreground">Ce module fournit une géolocalisation haute fidélité pour le déploiement sur le terrain :</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>Superposition d'itinéraire</strong> : Trace le trajet le plus rapide reliant le central SOUKRA_CENTER aux résidences cibles.</li>
                    <li><strong>Turn-by-Turn GPS</strong> : Cartes d'instructions routières dynamiques avec animations de tracés (dashed offsets) pour guider les techniciens.</li>
                    <li><strong>Visualisation géographique</strong> : Repérage spatial des armoires de répartition et PBO par grappes.</li>
                  </ul>
                  <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 text-[10px] text-muted-foreground">
                    💡 <em>Astuce:</em> Le tracé s'anime en temps réel à l'écran pour indiquer la direction exacte vers l'abonné sélectionné.
                  </div>
                </div>
              )}

              {guideTab === "topology" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-primary flex items-center gap-1.5">🔌 Topologie GPON & Calcul de Perte</h3>
                  <p className="text-muted-foreground">Une suite d'ingénierie optique avancée pour simuler et concevoir le réseau :</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>Arbre optique interactif</strong> : Affiche le brassage complet du central OLT jusqu'aux ONT abonnés.</li>
                    <li><strong>Calculateur de Budget de Liaison</strong> : Entrez la longueur de fibre, les coupleurs et les connecteurs pour estimer la perte en dBm.</li>
                    <li><strong>Analyseur de panne d'impact</strong> : Coupez virtuellement une armoire ou une boîte PBO pour identifier instantanément le nombre d'abonnés déconnectés.</li>
                  </ul>
                </div>
              )}

              {guideTab === "equipments" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-primary flex items-center gap-1.5">⚙️ Équipements Actifs & Cassette 12 Couleurs</h3>
                  <p className="text-muted-foreground">Gestion fine du matériel de raccordement et d'épissurage :</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>Cassette interactive 12 fibres</strong> : Cartographie visuelle des soudures optiques en appliquant le code couleur normé SOTETEL (Bleu, Orange, Vert, Brun, etc.).</li>
                    <li><strong>Impression d'étiquettes d'actifs</strong> : Générateur d'étiquettes thermiques normées avec codes-barres et QR codes haute densité optimisés pour le matériel de chantier.</li>
                  </ul>
                </div>
              )}

              {guideTab === "alerts" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-primary flex items-center gap-1.5">🚨 Traceur OTDR & Gestion des Alertes</h3>
                  <p className="text-muted-foreground">Détection de défauts et simulation physique par reflectométrie optique :</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>Simulation OTDR</strong> : Utilisez les curseurs de perte pour ajuster l'emplacement de coupure, la perte de soudure ou le stress mécanique.</li>
                    <li><strong>Ligne de trace SVG</strong> : Le graphe réagit instantanément en redessinant la pente de dispersion optique et localise précisément les anomalies de pliage de fibre.</li>
                  </ul>
                </div>
              )}

              {guideTab === "clients" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-primary flex items-center gap-1.5">👥 Gestion Client & Diagnostic Live</h3>
                  <p className="text-muted-foreground">Interface unifiée pour le raccordement et la maintenance client :</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>Workflow Raccordement</strong> : Enregistrez une demande, assignez un technicien et suivez l'avancement (Pending, Dispatched, Completed).</li>
                    <li><strong>Portail d'activation & Diag</strong> : Accédez au tiroir latéral de diagnostic en direct. Récupérez la puissance optique de l'ONT, lancez un test de laser GPON ou commandez un redémarrage (Reboot ONT) virtuel.</li>
                  </ul>
                </div>
              )}
            </div>

            {/* COLUMN 2: ARABIC (RTL SUPPORTED) */}
            <div className="space-y-3.5 text-xs text-right leading-relaxed text-foreground" dir="rtl">
              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded font-extrabold tracking-wide uppercase">
                دليل الاستخدام باللغة العربية
              </span>

              {guideTab === "dashboard" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">📊 لوحة القيادة والتحليلات البيانية</h3>
                  <p className="text-muted-foreground">تجمع وحدة التحكم المركزية مؤشرات الأداء الحية والمواصفات الفنية لشبكة سكرة :</p>
                  <ul className="list-disc pr-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>منحنى التوصيلات</strong>: تتبع نمو تفعيل خطوط الألياف الضوئية للمشتركين شهرياً بشكل تراكمي.</li>
                    <li><strong>إشغال قواسم الألياف (Splitters)</strong>: كشف نسبة المنافذ المستعملة مقابل الشواغر لكل مجمع سكني.</li>
                    <li><strong>عرض النطاق الترددي GPON</strong>: قياس حركة المرور الفعلية (تحميل/رفع) بالجيجابت في الثانية.</li>
                    <li><strong>مستوى الإشارات الضوئية</strong>: تحليل جودة وقوة الإشارة المستقبلة (Rx Power) لمودم المشتركين.</li>
                    <li><strong>أداء الفنيين</strong>: متابعة المهام الموكلة لكل فني وعدد طلبات التركيب المنجزة.</li>
                  </ul>
                  <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 text-[10px] text-muted-foreground">
                    💡 <em>تلميح:</em> استخدم محدد المناطق أعلى القائمة الجانبية لتصفية البيانات والرسوم البيانية حسب الحي تلقائياً.
                  </div>
                </div>
              )}

              {guideTab === "map" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">📍 الخرائط الحية والتوجيه الملاحي GPS</h3>
                  <p className="text-muted-foreground">توفير خرائط تفاعلية دقيقة لتوجيه الفرق الفنية في الميدان لتثبيت الكابلات :</p>
                  <ul className="list-disc pr-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>رسم مسارات الربط</strong>: تحديد المسار الأسرع على الخريطة بين مركز التوزيع وورشة عمل العميل.</li>
                    <li><strong>إرشادات خطوة بخطوة</strong>: بطاقات ملاحة تفاعلية مجهزة بخطوط مسارات متحركة لتوجيه الفنيين أثناء القيادة.</li>
                    <li><strong>تحديد المواقع الجغرافية</strong>: إسقاط فوري لمواقع الخزانات وعلب التوزيع والأعمدة الكهربائية للشبكة.</li>
                  </ul>
                  <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 text-[10px] text-muted-foreground">
                    💡 <em>تلميح:</em> ينبض مسار الملاحة حركياً على الشاشة للإشارة إلى الاتجاه الدقيق للعميل المحدد.
                  </div>
                </div>
              )}

              {guideTab === "topology" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">🔌 طوبولوجيا GPON وحساب ميزانية الفقد</h3>
                  <p className="text-muted-foreground">أدوات هندسة اتصالات متطورة لتصميم الشبكة ومحاكاة جودة الاتصال :</p>
                  <ul className="list-disc pr-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>الهيكل الشجري للألياف</strong>: استعراض تفاعلي كامل يبدأ من بورت OLT مروراً بالـ FDT حتى مودم العميل.</li>
                    <li><strong>حاسبة ميزانية الإشارة البصرية</strong>: حساب فقد الإشارة بالديسيبل (dBm) بناءً على أطوال الكابلات ومقاييس coupleurs.</li>
                    <li><strong>محلل تأثير انقطاع الكابلات</strong>: قطع افتراضي عند أي علبة توزيع لمعرفة عدد وأسماء المشتركين المتأثرين بالخلل فوراً.</li>
                  </ul>
                </div>
              )}

              {guideTab === "equipments" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">⚙️ إدارة علب اللحام وترميز الأصول الميدانية</h3>
                  <p className="text-muted-foreground">تنظيم كابلات الألياف المجمعة وإصدار ملصقات التعريف بالأصول :</p>
                  <ul className="list-disc pr-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>علبة اللحام التفاعلية ذات 12 لوناً</strong>: تمثيل لوني قياسي (تكويد ألوان) متبع في شركة SOTETEL للحام الشعيرات.</li>
                    <li><strong>طباعة ملصقات الباركود و QR</strong>: تصميم بطاقات تعريفية مقاس 250px للطابعات الحرارية لسهولة جرد المعدات بالميدان.</li>
                  </ul>
                </div>
              )}

              {guideTab === "alerts" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">🚨 جهاز قياس الانعكاس OTDR وتتبع التنبيهات</h3>
                  <p className="text-muted-foreground">محاكاة انكسار ووهن الضوء لتحديد نقاط قطع الألياف بدقة :</p>
                  <ul className="list-disc pr-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>محاكاة OTDR التفاعلية</strong>: التحكم بمستوى فقد اللحام، وتحديد مسافة القطع بالامتار والضغط الميكانيكي.</li>
                    <li><strong>رسم منحنى الإشارة الديناميكي</strong>: يتفاعل الرسم SVG فورياً مع المدخلات ليعكس مستويات الانخفاض البصري.</li>
                  </ul>
                </div>
              )}

              {guideTab === "clients" && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">👥 طلبات التوصيل وبوابة تشخيص العملاء المباشرة</h3>
                  <p className="text-muted-foreground">شاشة موحدة للتحكم بطلبات التركيب الجديدة وصيانة المشتركين القائمين :</p>
                  <ul className="list-disc pr-4 space-y-1.5 text-muted-foreground font-semibold">
                    <li><strong>دورة حياة الطلب</strong>: تسجيل بيانات العميل الجغرافي، وإسناد المهمة لفني التركيب، ومتابعة حالة التفعيل.</li>
                    <li><strong>بوابة تشخيص ONT الحية</strong>: درج تفاعلي للاستعلام عن ليزر المشترك، وقياس جودة الخط، وإرسال أمر إعادة تشغيل المودم (Reboot) عن بُعد لحل المشكلات بدون تدخل ميداني.</li>
                  </ul>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  to,
  active,
  icon,
  collapsed,
  children,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all relative ${
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/15"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      } ${collapsed ? "justify-center" : ""}`}
    >
      {icon}
      {!collapsed && <span className="truncate">{children}</span>}
      {active && !collapsed && (
        <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
      )}
    </Link>
  );
}
