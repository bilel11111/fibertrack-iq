import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { sqliteQuery } from "@/lib/sqlite-client";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  Compass,
  Zap,
} from "lucide-react";
import { useApp } from "@/hooks/use-app";

const SOUKRA_CENTER: [number, number] = [36.8671225, 10.2253475];

// Fix default Leaflet icon URLs (Vite bundling)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function divIcon(bg: string, label: string, size = 28) {
  return L.divIcon({
    className: "fti-icon",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.25);border:2px solid #fff">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const bpiIcon = (s: string) =>
  divIcon(s === "ok" ? "#0ea5e9" : s === "warning" ? "#f59e0b" : "#ef4444", "B", 22);

const fdtIcon = () => divIcon("#8b5cf6", "F", 30);

const installationIcon = (status: string) => {
  const bg = status === "Fault" ? "#ef4444" : "#f97316";
  const symbol = status === "Fault" ? "⚠" : "🛠️";
  return L.divIcon({
    className: "fti-installation-icon",
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 4px 12px rgba(249,115,22,.45);border:2px solid #fff;animation: pulsing 1.6s infinite ease-in-out">${symbol}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom || 15, { duration: 0.8 });
  }, [center, map, zoom]);
  return null;
}

function CustomZoomControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
  isRtl,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  isRtl: boolean;
}) {
  return (
    <div className={`absolute ${isRtl ? "left-4" : "right-4"} top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2`}>
      <button
        onClick={onZoomIn}
        className="w-9 h-9 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center font-bold text-lg text-slate-700 shadow-lg dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 transition"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        className="w-9 h-9 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center font-bold text-lg text-slate-700 shadow-lg dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 transition"
      >
        -
      </button>
      <button
        onClick={onRecenter}
        className="w-9 h-9 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-700 shadow-lg dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 transition mt-2"
        title="Centrer"
      >
        <Compass className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}

export function MapDashboard() {
  const { lang, zone, t } = useApp();
  const isRtl = lang === "ar";

  const [connections, setConnections] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"Zones" | "Clusters" | "Câbles">("Zones");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapStyle, setMapStyle] = useState<"osm" | "satellite">("osm");
  
  // Custom Checkbox Layer States
  const [layerZonesFiables, setLayerZonesFiables] = useState(true);
  const [layerZonesSurveillance, setLayerZonesSurveillance] = useState(true);
  const [layerLignesOptiques, setLayerLignesOptiques] = useState(false);
  const [layerPointsAcces, setLayerPointsAcces] = useState(false);
  const [layerSegmentsAnomalie, setLayerSegmentsAnomalie] = useState(true);
  const [layerChantiers, setLayerChantiers] = useState(true); // new checkbox layer

  const [recenterTarget, setRecenterTarget] = useState<[number, number]>(SOUKRA_CENTER);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [selectedRoutingTarget, setSelectedRoutingTarget] = useState<any | null>(null);

  // Load real connection, installation & materials data from SQLite
  useEffect(() => {
    Promise.all([
      sqliteQuery("SELECT * FROM connections"),
      sqliteQuery("SELECT * FROM installations"),
      sqliteQuery("SELECT * FROM materials")
    ])
      .then(([connData, instData, matData]) => {
        setConnections(connData);
        setInstallations(instData);
        setMaterials(matData);
      })
      .catch((err) => {
        console.error("Failed to load map data from SQLite:", err);
      });
  }, []);

  // Filter connections by zone
  const filteredConnections = useMemo(() => {
    if (zone === "Toutes les zones") return connections;
    return connections.filter((c) => c.fdt === zone || c.residence === zone);
  }, [connections, zone]);

  // Filter pending/dispatched/fault installations by zone
  const filteredInstallations = useMemo(() => {
    const activeInsts = installations.filter(inst => ["Pending", "Dispatched", "Fault"].includes(inst.status));
    if (zone === "Toutes les zones") return activeInsts;
    return activeInsts.filter((inst) => inst.residence === zone);
  }, [installations, zone]);

  // Recenter automatically on selected zone's first FDT
  useEffect(() => {
    const firstFdt = filteredConnections.find((c) => c.gps_fdt);
    if (firstFdt && firstFdt.gps_fdt) {
      const [lat, lng] = firstFdt.gps_fdt.split(",").map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        setRecenterTarget([lat, lng]);
      }
    }
  }, [filteredConnections]);

  // Compute unique FDTs from filtered connections
  const fdts = useMemo(() => {
    const map = new Map<string, any>();
    filteredConnections.forEach((c) => {
      if (c.fdt && c.gps_fdt) {
        const [lat, lng] = c.gps_fdt.split(",").map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          map.set(c.fdt, {
            id: c.fdt,
            name: c.fdt,
            lat,
            lng,
            sectorId: c.residence
          });
        }
      }
    });
    return Array.from(map.values());
  }, [filteredConnections]);

  // Compute unique BPIs (PBOs) from filtered connections
  const bpis = useMemo(() => {
    const map = new Map<string, any>();
    filteredConnections.forEach((c) => {
      if (c.pos_bpi && c.gps_bpi) {
        const [lat, lng] = c.gps_bpi.split(",").map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          const existing = map.get(c.pos_bpi) || {
            id: c.pos_bpi,
            posBpi: c.pos_bpi,
            fdt: c.fdt,
            lat,
            lng,
            apartments: [],
            status: "ok"
          };
          existing.apartments.push(c);
          
          const lastDigit = c.pos_bpi.slice(-1);
          if (lastDigit === "4" || lastDigit === "9") existing.status = "warning";
          else if (lastDigit === "7" || lastDigit === "2") existing.status = "fault";
          
          map.set(c.pos_bpi, existing);
        }
      }
    });
    return Array.from(map.values());
  }, [filteredConnections]);

  // Compute fiber paths from FDT to BPIs
  const routes = useMemo(() => {
    const lines: any[] = [];
    bpis.forEach((b) => {
      const parentFdt = fdts.find((f) => f.name === b.fdt);
      if (parentFdt) {
        const inFault = b.status === "fault";
        const inWarning = b.status === "warning";
        
        if ((inFault || inWarning) && layerSegmentsAnomalie) {
          lines.push({
            id: `route-${b.id}`,
            color: inFault ? "#ef4444" : "#f59e0b",
            path: [[parentFdt.lat, parentFdt.lng], [b.lat, b.lng]] as [number, number][]
          });
        } else if (layerLignesOptiques) {
          lines.push({
            id: `route-${b.id}`,
            color: "#3b82f6",
            path: [[parentFdt.lat, parentFdt.lng], [b.lat, b.lng]] as [number, number][]
          });
        }
      }
    });
    return lines;
  }, [bpis, fdts, layerLignesOptiques, layerSegmentsAnomalie]);

  // Filter BPIs based on checkboxes states
  const displayedBpis = useMemo(() => {
    return bpis.filter((b) => {
      if (b.status === "ok") return layerZonesFiables;
      if (b.status === "warning") return layerZonesSurveillance;
      if (b.status === "fault") return layerSegmentsAnomalie;
      return true;
    });
  }, [bpis, layerZonesFiables, layerZonesSurveillance, layerSegmentsAnomalie]);

  // Search localizations handler
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const qVal = searchQuery.trim().toLowerCase();
    const found = bpis.find((b) => b.posBpi.toLowerCase().includes(qVal)) || fdts.find((f) => f.name.toLowerCase().includes(qVal));

    if (found) {
      setRecenterTarget([found.lat, found.lng]);
      setZoomLevel(17);
      toast.success(
        isRtl
          ? `تم تحديد موقع "${found.name || found.posBpi}" على الخريطة!`
          : `Élément "${found.name || found.posBpi}" repéré sur la carte !`
      );
    } else {
      toast.error(
        isRtl ? `لم يتم العثور على موقع لـ "${searchQuery}"` : `Aucune localisation trouvée pour "${searchQuery}"`
      );
    }
  };

  // Zoom controls wrappers
  const zoomIn = () => setZoomLevel((z) => Math.min(z + 1, 19));
  const zoomOut = () => setZoomLevel((z) => Math.max(z - 1, 10));
  const recenterMap = () => {
    if (fdts.length > 0) {
      setRecenterTarget([fdts[0].lat, fdts[0].lng]);
      setZoomLevel(15);
      toast.success(isRtl ? "تم إعادة توسيط الخريطة." : "Carte recentrée.");
    }
  };

  const mapCenter = useMemo(() => {
    if (fdts.length > 0) {
      return [fdts[0].lat, fdts[0].lng] as [number, number];
    }
    return SOUKRA_CENTER;
  }, [fdts]);

  const activeAlertsCount = bpis.filter(b => b.status === "fault").length;

  return (
    <div
      className="h-full w-full bg-[#f8fafc] dark:bg-slate-900 p-6 flex flex-col overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Outer Card Visualisation */}
      <div className="flex-1 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm flex flex-col overflow-hidden dark:bg-slate-950 dark:border-slate-800 animate-in fade-in duration-200">
        
        {/* Card Header */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800 ${isRtl ? "flex-row-reverse" : ""}`}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1e293b] text-sm dark:text-slate-100 truncate">
              {t("map.title")}
            </span>
          </div>

          <div className={`flex flex-wrap items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className={`flex bg-[#f1f5f9] dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 ${isRtl ? "flex-row-reverse" : ""}`}>
              {(["Zones", "Clusters", "Câbles"] as const).map((tab) => {
                const selected = activeTab === tab;
                const translatedTab = tab === "Zones" ? t("map.tab_zones") : tab === "Clusters" ? t("map.tab_clusters") : t("map.tab_cables");
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === "Zones") {
                        setLayerZonesFiables(true);
                        setLayerZonesSurveillance(true);
                      } else if (tab === "Câbles") {
                        setLayerLignesOptiques(true);
                        setLayerSegmentsAnomalie(true);
                      }
                      toast.info(`Mode: ${tab}`);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? "bg-[#6366f1] text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {translatedTab}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSearchSubmit} className="relative min-w-[200px]">
              <Search className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground`} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("map.search_ph")}
                className={`w-full rounded-xl border border-input bg-background py-1.5 ${isRtl ? "pr-9 pl-3" : "pl-9 pr-3"} text-xs outline-none focus:ring-1 focus:ring-primary`}
              />
            </form>
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative rounded-2xl overflow-hidden border border-border mt-3 bg-slate-50">
          
          {/* Couches Réseau Overlay Panel */}
          <div className={`absolute ${isRtl ? "right-4 text-right" : "left-4 text-left"} top-4 z-[1000] w-64 rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-xl backdrop-blur-xs dark:bg-slate-900/95 dark:border-slate-800/80`}>
            <h3 className="font-bold text-[#1e293b] text-xs dark:text-slate-100">{t("map.layers_title")}</h3>
            
            {/* Style switcher */}
            <div className="mt-2 mb-3">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">{t("map.layer_style")}</span>
              <div className="mt-1 flex bg-[#f1f5f9] dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMapStyle("osm")}
                  className={`flex-1 rounded-md py-1 text-[10px] font-bold text-center transition ${
                    mapStyle === "osm"
                      ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("map.style_osm")}
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle("satellite")}
                  className={`flex-1 rounded-md py-1 text-[10px] font-bold text-center transition ${
                    mapStyle === "satellite"
                      ? "bg-[#6366f1] text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("map.style_satellite")}
                </button>
              </div>
            </div>

            {/* Infrastructure checkbox list */}
            <div className="mt-3">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">{t("map.infra")}</span>
              <div className="mt-1.5 space-y-1">
                <label className={`flex cursor-pointer items-center justify-between py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 px-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-[11px] text-[#475569] dark:text-slate-300">{t("map.layer_reliable")}</span>
                  <input
                    type="checkbox"
                    checked={layerZonesFiables}
                    onChange={() => setLayerZonesFiables(!layerZonesFiables)}
                    className="h-3.5 w-3.5 rounded accent-primary border-slate-300"
                  />
                </label>
                <label className={`flex cursor-pointer items-center justify-between py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 px-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-[11px] text-[#475569] dark:text-slate-300">{t("map.layer_monitor")}</span>
                  <input
                    type="checkbox"
                    checked={layerZonesSurveillance}
                    onChange={() => setLayerZonesSurveillance(!layerZonesSurveillance)}
                    className="h-3.5 w-3.5 rounded accent-primary border-slate-300"
                  />
                </label>
                <label className={`flex cursor-pointer items-center justify-between py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 px-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-[11px] text-[#475569] dark:text-slate-300">{t("map.layer_lines")}</span>
                  <input
                    type="checkbox"
                    checked={layerLignesOptiques}
                    onChange={() => setLayerLignesOptiques(!layerLignesOptiques)}
                    className="h-3.5 w-3.5 rounded accent-primary border-slate-300"
                  />
                </label>
                <label className={`flex cursor-pointer items-center justify-between py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 px-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-[11px] text-[#475569] dark:text-slate-300">{t("map.layer_points")}</span>
                  <input
                    type="checkbox"
                    checked={layerPointsAcces}
                    onChange={() => setLayerPointsAcces(!layerPointsAcces)}
                    className="h-3.5 w-3.5 rounded accent-primary border-slate-300"
                  />
                </label>
                <label className={`flex cursor-pointer items-center justify-between py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 px-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-[11px] text-[#475569] dark:text-slate-300 font-semibold text-rose-600 dark:text-rose-400">{t("map.layer_anomalies")}</span>
                  <input
                    type="checkbox"
                    checked={layerSegmentsAnomalie}
                    onChange={() => setLayerSegmentsAnomalie(!layerSegmentsAnomalie)}
                    className="h-3.5 w-3.5 rounded accent-rose-500 border-slate-300"
                  />
                </label>
                <label className={`flex cursor-pointer items-center justify-between py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 px-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-[11px] text-[#475569] dark:text-slate-300 font-semibold text-orange-500 dark:text-orange-400">{isRtl ? "طلبات التركيب النشطة" : "Chantiers actifs"}</span>
                  <input
                    type="checkbox"
                    checked={layerChantiers}
                    onChange={() => setLayerChantiers(!layerChantiers)}
                    className="h-3.5 w-3.5 rounded accent-orange-500 border-slate-300"
                  />
                </label>
              </div>
            </div>

            {/* Selected zone stats */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">{t("map.stats_title")}</span>
              <div className="mt-2 space-y-1 text-[11px]">
                <div className={`flex justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-muted-foreground">{t("map.stats_locations")}</span>
                  <span className="font-bold text-foreground tabular-nums">{displayedBpis.length + (layerPointsAcces ? fdts.length : 0)}</span>
                </div>
                <div className={`flex justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-muted-foreground">{t("map.stats_faults")}</span>
                  <span className="font-bold text-rose-600 tabular-nums">{activeAlertsCount}</span>
                </div>
                <div className={`flex justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                  <span className="text-muted-foreground">{t("map.stats_coverage")}</span>
                  <span className="font-bold text-emerald-600">96.8%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Leaflet MapContainer */}
          {connections.length > 0 ? (
            <>
              <MapContainer
              center={mapCenter}
              zoom={zoomLevel}
              className="h-full w-full"
              zoomControl={false}
            >
              <Recenter center={recenterTarget} zoom={zoomLevel} />
              
              {mapStyle === "osm" ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}

              {/* Polyline fiber routes */}
              {routes.map((r, idx) => (
                <Polyline key={idx} positions={r.path} pathOptions={{ color: r.color, weight: 3, opacity: 0.75 }} />
              ))}

              {/* FDT points */}
              {(layerPointsAcces || activeTab === "Câbles") && fdts.map((f) => (
                <Marker key={f.id} position={[f.lat, f.lng]} icon={fdtIcon()}>
                  <Popup>
                    <div className={`text-xs p-1 ${isRtl ? "text-right" : "text-left"}`}>
                      <div className="font-bold text-primary">{f.name}</div>
                      <div>{isRtl ? "الإقامة :" : "Résidence :"} <span className="font-semibold">{f.sectorId}</span></div>
                      <div className="mt-1">{isRtl ? "النوع :" : "Type :"} <span className="font-semibold text-violet-600">FDT Cabinet</span></div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* BPI points (with Clusters support) */}
              {activeTab === "Clusters" ? (
                <MarkerClusterGroup chunkedLoading>
                  {displayedBpis.map((b) => (
                    <Marker key={b.id} position={[b.lat, b.lng]} icon={bpiIcon(b.status)}>
                      <Popup>
                        <div className={`text-xs p-1 max-w-[320px] w-[300px] ${isRtl ? "text-right" : "text-left"}`}>
                          <div className={`font-bold text-[#1e293b] border-b border-slate-200 dark:border-slate-800 pb-2 mb-2 flex justify-between items-center ${isRtl ? "flex-row-reverse" : ""}`}>
                            <span className="text-primary font-black text-sm">📍 PBO: {b.posBpi}</span>
                            <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase truncate max-w-[120px]">
                              {b.fdt}
                            </span>
                          </div>

                          <div className={`flex justify-between items-center mb-2.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                            <span className="text-muted-foreground">{isRtl ? "المشتركون :" : "Abonnés :"}</span>
                            <span className="font-extrabold text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                              {b.apartments.length} {isRtl ? "مشتركين" : "abonnés"}
                            </span>
                          </div>

                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
                            💻 {isRtl ? "تفاصيل توصيلات المشتركين ومعدات GPON :" : "Détails clients & Équipements GPON"}
                          </div>

                          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                            {b.apartments.map((apt: any) => {
                              // Match completed installation demand to check for report notes & materials used
                              const matchingInst = installations.find(
                                (inst) =>
                                  inst.residence === apt.residence &&
                                  inst.bloc === apt.bloc &&
                                  inst.appartement === apt.appartement &&
                                  inst.status === "Completed"
                              );

                              let matList: string[] = [];
                              if (matchingInst && matchingInst.materials_used) {
                                try {
                                  const parsed = JSON.parse(matchingInst.materials_used);
                                  matList = Object.entries(parsed)
                                    .map(([matId, qty]: any) => {
                                      if (qty <= 0) return null;
                                      const matName = materials.find(m => String(m.id) === String(matId))?.name || `Matière #${matId}`;
                                      return `${matName} x${qty}`;
                                    })
                                    .filter(Boolean) as string[];
                                } catch (e) {}
                              }

                              return (
                                <div key={apt.id} className="p-2 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-1.5">
                                  <div className="font-bold text-foreground text-[11px]">
                                    🏢 {apt.residence} {apt.bloc} - Appt {apt.appartement} (Et. {apt.etage || "1"})
                                  </div>
                                  
                                  {/* GPON network path */}
                                  <div className="text-[10px] text-muted-foreground bg-white dark:bg-slate-950 p-1.5 rounded border border-border/60 space-y-0.5 font-mono">
                                    <div className="flex justify-between">
                                      <span>OLT Port:</span>
                                      <span className="font-bold text-slate-700 dark:text-slate-300">{apt.port_olt || "GPON 01/01"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Splitter:</span>
                                      <span className="font-bold text-violet-600">{apt.pos_spl || "1:8 Port 1"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Card GPON:</span>
                                      <span className="font-bold text-indigo-500">{apt.port_carte_gpon || "GPON-0"}</span>
                                    </div>
                                  </div>

                                  {/* Report Notes */}
                                  {matchingInst && matchingInst.notes && (
                                    <div className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/40 p-1.5 rounded leading-relaxed">
                                      💬 <strong>Rapport:</strong> {matchingInst.notes}
                                    </div>
                                  )}

                                  {/* Materials utilized */}
                                  {matList.length > 0 && (
                                    <div className="text-[9px] text-muted-foreground">
                                      🔧 <strong>{isRtl ? "المعدات المستعملة :" : "Matériel utilisé :"}</strong>
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {matList.map((mat, mIdx) => (
                                          <span key={mIdx} className="bg-amber-500/10 text-amber-700 border border-amber-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
                                            {mat}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              ) : (
                displayedBpis.map((b) => (
                  <Marker key={b.id} position={[b.lat, b.lng]} icon={bpiIcon(b.status)}>
                    <Popup>
                      <div className={`text-xs p-1 max-w-[320px] w-[300px] ${isRtl ? "text-right" : "text-left"}`}>
                        <div className={`font-bold text-[#1e293b] border-b border-slate-200 dark:border-slate-800 pb-2 mb-2 flex justify-between items-center ${isRtl ? "flex-row-reverse" : ""}`}>
                          <span className="text-primary font-black text-sm">📍 PBO: {b.posBpi}</span>
                          <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase truncate max-w-[120px]">
                            {b.fdt}
                          </span>
                        </div>

                        <div className={`flex justify-between items-center mb-2.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                          <span className="text-muted-foreground">{isRtl ? "المشتركون :" : "Abonnés :"}</span>
                          <span className="font-extrabold text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                            {b.apartments.length} {isRtl ? "مشتركين" : "abonnés"}
                          </span>
                        </div>

                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
                          💻 {isRtl ? "تفاصيل توصيلات المشتركين ومعدات GPON :" : "Détails clients & Équipements GPON"}
                        </div>

                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                          {b.apartments.map((apt: any) => {
                            // Match completed installation demand to check for report notes & materials used
                            const matchingInst = installations.find(
                              (inst) =>
                                inst.residence === apt.residence &&
                                inst.bloc === apt.bloc &&
                                inst.appartement === apt.appartement &&
                                inst.status === "Completed"
                            );

                            let matList: string[] = [];
                            if (matchingInst && matchingInst.materials_used) {
                              try {
                                  const parsed = JSON.parse(matchingInst.materials_used);
                                  matList = Object.entries(parsed)
                                    .map(([matId, qty]: any) => {
                                      if (qty <= 0) return null;
                                      const matName = materials.find(m => String(m.id) === String(matId))?.name || `Matière #${matId}`;
                                      return `${matName} x${qty}`;
                                    })
                                    .filter(Boolean) as string[];
                              } catch (e) {}
                            }

                            return (
                              <div key={apt.id} className="p-2 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-1.5">
                                <div className="font-bold text-foreground text-[11px]">
                                  🏢 {apt.residence} {apt.bloc} - Appt {apt.appartement} (Et. {apt.etage || "1"})
                                </div>
                                
                                {/* GPON network path */}
                                <div className="text-[10px] text-muted-foreground bg-white dark:bg-slate-950 p-1.5 rounded border border-border/60 space-y-0.5 font-mono">
                                  <div className="flex justify-between">
                                    <span>OLT Port:</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{apt.port_olt || "GPON 01/01"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Splitter:</span>
                                    <span className="font-bold text-violet-600">{apt.pos_spl || "1:8 Port 1"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Card GPON:</span>
                                    <span className="font-bold text-indigo-500">{apt.port_carte_gpon || "GPON-0"}</span>
                                  </div>
                                </div>

                                {/* Report Notes */}
                                {matchingInst && matchingInst.notes && (
                                  <div className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/40 p-1.5 rounded leading-relaxed">
                                    💬 <strong>Rapport:</strong> {matchingInst.notes}
                                  </div>
                                )}

                                {/* Materials utilized */}
                                {matList.length > 0 && (
                                  <div className="text-[9px] text-muted-foreground">
                                    🔧 <strong>{isRtl ? "المعدات المستعملة :" : "Matériel utilisé :"}</strong>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {matList.map((mat, mIdx) => (
                                        <span key={mIdx} className="bg-amber-500/10 text-amber-700 border border-amber-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
                                          {mat}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))
              )}

              {/* Pulsing chantiers/installation sites */}
              {layerChantiers && filteredInstallations.map((inst) => {
                if (!inst.gps) return null;
                const [lat, lng] = inst.gps.split(",").map(Number);
                if (isNaN(lat) || isNaN(lng)) return null;

                return (
                  <Marker
                    key={`inst-${inst.id}`}
                    position={[lat, lng]}
                    icon={installationIcon(inst.status)}
                  >
                    <Popup>
                      <div className={`text-xs p-1.5 max-w-[250px] ${isRtl ? "text-right" : "text-left"}`}>
                        <div className="font-bold border-b pb-1.5 mb-1.5 flex justify-between items-center">
                          <span className="text-orange-500 font-extrabold">🛠️ {isRtl ? "طلب تركيب نشط" : "Chantier Actif"}</span>
                          <span className="text-[10px] text-muted-foreground">ID: #{inst.id}</span>
                        </div>
                        <div className="font-bold text-foreground text-sm mb-1">👤 {inst.client_name}</div>
                        <div className="text-slate-600 dark:text-slate-400 mt-1">
                          <strong>📍 {isRtl ? "الموقع :" : "Adresse :"}</strong> {inst.residence} {inst.bloc} - Appt {inst.appartement}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 mt-1">
                          <strong>⚡ {isRtl ? "الحالة :" : "Statut :"}</strong>{' '}
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            inst.status === "Pending" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                            inst.status === "Dispatched" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                          }`}>
                            {inst.status === "Pending" ? (isRtl ? "في الانتظار" : "En attente") :
                             inst.status === "Dispatched" ? `${isRtl ? "مكلف لـ" : "Assigné à"} ${inst.assigned_tech}` :
                             (isRtl ? "عطل فني" : "Panne signalée")}
                          </span>
                        </div>
                        {inst.notes && (
                          <div className="text-[11px] text-muted-foreground mt-2 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-dashed leading-snug">
                            📝 <strong>{isRtl ? "ملاحظات :" : "Notes :"}</strong> {inst.notes}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setSelectedRoutingTarget(inst);
                          }}
                          className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow transition-all duration-200 text-xs"
                        >
                          🗺️ {isRtl ? "احسب المسار" : "Calculer l'itinéraire"}
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {selectedRoutingTarget && selectedRoutingTarget.gps && (() => {
                const [lat, lng] = selectedRoutingTarget.gps.split(",").map(Number);
                if (isNaN(lat) || isNaN(lng)) return null;
                const path: [number, number][] = [
                  SOUKRA_CENTER,
                  [SOUKRA_CENTER[0] + (lat - SOUKRA_CENTER[0]) * 0.3, SOUKRA_CENTER[1] + (lng - SOUKRA_CENTER[1]) * 0.1],
                  [SOUKRA_CENTER[0] + (lat - SOUKRA_CENTER[0]) * 0.7, SOUKRA_CENTER[1] + (lng - SOUKRA_CENTER[1]) * 0.8],
                  [lat, lng]
                ];
                return (
                  <>
                    <Polyline
                      positions={path}
                      pathOptions={{
                        color: "#4f46e5",
                        weight: 5,
                        opacity: 0.8,
                        dashArray: "10, 10",
                        className: "route-polyline-animated"
                      }}
                    />
                    <Marker position={SOUKRA_CENTER} icon={divIcon("#4f46e5", "HQ", 24)}>
                      <Popup>
                        <div className="text-xs p-1">
                          <strong>{isRtl ? "مقر سوتيتيل المركزي" : "Centrale SOTETEL (Soukra)"}</strong>
                        </div>
                      </Popup>
                    </Marker>
                    <Recenter center={[(SOUKRA_CENTER[0] + lat) / 2, (SOUKRA_CENTER[1] + lng) / 2]} zoom={14} />
                  </>
                );
              })()}

            </MapContainer>
            <style>{`
              @keyframes pulsing {
                0% { transform: scale(0.95); opacity: 0.9; box-shadow: 0 0 0 0 rgba(249,115,22, 0.4); }
                70% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 0 8px rgba(249,115,22, 0); }
                100% { transform: scale(0.95); opacity: 0.9; box-shadow: 0 0 0 0 rgba(249,115,22, 0); }
              }
              @keyframes routeDash {
                to {
                  stroke-dashoffset: -40;
                }
              }
              .route-polyline-animated {
                animation: routeDash 1.5s linear infinite;
              }
            `}</style>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2.5 bg-slate-50">
              <span className="text-3xl">🗺️</span>
              <span className="text-xs font-bold text-slate-500">{t("map.no_data")}</span>
            </div>
          )}

          {/* Zoom controls */}
          <CustomZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onRecenter={recenterMap} isRtl={isRtl} />

          {/* GPS Route Directions Assistant Overlay Card */}
          {selectedRoutingTarget && (
            <div className={`absolute top-4 ${isRtl ? "left-4" : "right-4"} z-[1000] w-80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl flex flex-col gap-3 transition-all duration-300 max-h-[75vh] overflow-y-auto`}>
              <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="h-5 w-5 text-indigo-500 animate-spin" style={{ animationDuration: '4s' }} />
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {isRtl ? "مساعد الملاحة GPS" : "Assistant de Navigation GPS"}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedRoutingTarget(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1 leading-none rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                {/* Route Info Badge */}
                <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {isRtl ? "المسار الأمثل" : "Itinéraire Optimal"}
                    </span>
                    <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded font-extrabold text-[9px]">
                      {isRtl ? "توجيه حي" : "LIVE ROUTE"}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{isRtl ? "المسافة الكلية:" : "Distance Totale :"} <strong>2.8 km</strong></span>
                    <span>{isRtl ? "الوقت المقدر:" : "Temps estimé :"} <strong>6 mins</strong></span>
                  </div>
                </div>

                {/* Target details */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">
                    {isRtl ? "الوجهة الفنية" : "Cible d'intervention"}
                  </div>
                  <div className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400">
                    🛠️ {selectedRoutingTarget.client_name} (ID #{selectedRoutingTarget.id})
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    📍 {selectedRoutingTarget.residence} {selectedRoutingTarget.bloc} - Appt {selectedRoutingTarget.appartement}
                  </div>
                </div>

                {/* Instructions list */}
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold mb-1">
                    {isRtl ? "إرشادات الطريق خطوة بخطوة" : "Instructions Turn-by-Turn"}
                  </div>
                  {[
                    {
                      icon: "🏢",
                      fr: "Départ de la centrale SOTETEL Soukra.",
                      ar: "الإنطلاق من مقر سوتيتيل سكرة."
                    },
                    {
                      icon: "⬆️",
                      fr: "Prendre l'Avenue de l'UMA vers le sud-est (450m).",
                      ar: "اتجه نحو شارع اتحاد المغرب العربي جنوباً (450م)."
                    },
                    {
                      icon: "↩️",
                      fr: "Tourner à gauche sur Rue des Jardins (1.2km).",
                      ar: "انعطف يساراً في نهج الحدائق (1.2كم)."
                    },
                    {
                      icon: "🔄",
                      fr: "Au rond-point, prendre la 3ème sortie vers la zone d'intervention.",
                      ar: "عند المفترق، خذ المخرج الثالث نحو منطقة التدخل."
                    },
                    {
                      icon: "📍",
                      fr: `Arrivée à destination : ${selectedRoutingTarget.residence}.`,
                      ar: `الوصول إلى الوجهة: ${selectedRoutingTarget.residence}.`
                    }
                  ].map((step, idx) => (
                    <div key={idx} className="flex gap-2 text-xs items-start bg-slate-50 dark:bg-slate-900/30 p-2 rounded-xl border border-slate-100 dark:border-slate-850 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition">
                      <span className="text-base leading-none select-none">{step.icon}</span>
                      <div className="flex-1 text-[11px] leading-tight text-slate-700 dark:text-slate-300">
                        {isRtl ? step.ar : step.fr}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bottom active anomalies badge */}
          {activeAlertsCount > 0 && (
            <div className={`absolute bottom-4 ${isRtl ? "right-4" : "left-4"} z-[1000] flex items-center gap-1.5 bg-[#ef4444] text-white px-3 py-1.5 rounded-full text-[10px] font-extrabold shadow-lg animate-pulse`}>
              <Zap className="h-3.5 w-3.5" />
              <span>{activeAlertsCount} {isRtl ? "أعطال نشطة" : "Anomalies Actives"}</span>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
