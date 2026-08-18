// Mock FTTH network data centered around Soukra, Tunisia
const SOUKRA: [number, number] = [36.8833, 10.2333];

function jitter([lat, lng]: [number, number], radiusKm = 2): [number, number] {
  const r = radiusKm / 111;
  return [
    lat + (Math.random() - 0.5) * 2 * r,
    lng + (Math.random() - 0.5) * 2 * r * 1.25,
  ];
}

export type TechStatus = "online" | "busy" | "offline";
export interface Technician {
  id: string;
  name: string;
  phone: string;
  status: TechStatus;
  lat: number;
  lng: number;
  lastSeen: string;
}

export interface FDT {
  id: string;
  name: string;
  sectorId: string;
  lat: number;
  lng: number;
}

export type BpiStatus = "ok" | "warning" | "fault";
export interface BPI {
  id: string;
  posBpi: string;
  sectorId: string;
  status: BpiStatus;
  lat: number;
  lng: number;
}

export interface FiberRoute {
  id: string;
  from: string;
  to: string;
  path: [number, number][];
  color: string;
}

const TECH_NAMES = [
  "Anis Ben Salah", "Mohamed Trabelsi", "Yassine Gharbi",
  "Khalil Mansouri", "Sami Bouzid", "Hatem Jelassi",
  "Wassim Khelifi", "Riadh Hamdi",
];

export const technicians: Technician[] = TECH_NAMES.map((name, i) => {
  const [lat, lng] = jitter(SOUKRA, 3);
  const statuses: TechStatus[] = ["online", "online", "busy", "offline"];
  return {
    id: `T-${1000 + i}`,
    name,
    phone: `+216 ${20 + i} ${100 + i}${i} ${200 + i}`,
    status: statuses[i % statuses.length],
    lat, lng,
    lastSeen: `${(i % 12) + 1}m ago`,
  };
});

export const fdts: FDT[] = Array.from({ length: 6 }, (_, i) => {
  const [lat, lng] = jitter(SOUKRA, 2.5);
  return {
    id: `FDT-${i + 1}`,
    name: `FDT-Soukra-${String.fromCharCode(65 + i)}`,
    sectorId: `S-${i + 1}`,
    lat, lng,
  };
});

export const bpis: BPI[] = Array.from({ length: 60 }, (_, i) => {
  const parent = fdts[i % fdts.length];
  const [lat, lng] = jitter([parent.lat, parent.lng], 0.6);
  const statuses: BpiStatus[] = ["ok", "ok", "ok", "ok", "warning", "fault"];
  return {
    id: `BPI-${2000 + i}`,
    posBpi: `BPI-${String.fromCharCode(65 + (i % fdts.length))}${(i % 12) + 1}`,
    sectorId: parent.sectorId,
    status: statuses[i % statuses.length],
    lat, lng,
  };
});

export const routes: FiberRoute[] = fdts.map((fdt, i) => {
  const sectorBpis = bpis.filter((b) => b.sectorId === fdt.sectorId).slice(0, 4);
  return {
    id: `R-${i + 1}`,
    from: fdt.id,
    to: sectorBpis.map((b) => b.id).join("→"),
    color: ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][i % 6],
    path: [[fdt.lat, fdt.lng], ...sectorBpis.map((b) => [b.lat, b.lng] as [number, number])],
  };
});

export const SOUKRA_CENTER = SOUKRA;
