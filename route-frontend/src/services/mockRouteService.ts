import type { CompareResponse, HealthResponse, LatLng, RouteRequest, RouteResult, RouteService, Stop } from "../types/route";

// Synthetic demo data. Coordinates are approximate Bengaluru locations.
const s = (id: string, name: string, lat: number, lng: number, load_kg: number, window_start: string, window_end: string): Stop =>
  ({ id, name, location: { lat, lng }, load_kg, window_start, window_end, synthetic: true });

export const DEMO_DEPOT = { name: "Koramangala Hub (synthetic)", location: { lat: 12.9352, lng: 77.6245 } };
export const DEMO_STOPS: Stop[] = [
  s("S1", "Indiranagar", 12.9784, 77.6408, 120, "09:00", "11:30"),
  s("S2", "Whitefield", 12.9698, 77.75, 200, "10:00", "13:00"),
  s("S3", "Jayanagar", 12.925, 77.5938, 80, "09:00", "12:00"),
  s("S4", "HSR Layout", 12.9116, 77.6389, 150, "11:00", "14:00"),
  s("S5", "Malleshwaram", 13.0031, 77.5643, 90, "09:30", "12:30"),
  s("S6", "Electronic City", 12.8399, 77.677, 180, "12:00", "16:00"),
  s("S7", "MG Road", 12.9756, 77.6066, 60, "10:00", "12:00"),
  s("S8", "Hebbal", 13.0358, 77.597, 110, "13:00", "17:00"),
];

// Transparent placeholder assumptions (documented, not measured).
const SPEED_KMH: Record<string, number> = { low: 30, moderate: 20, heavy: 12 };
const KG_CO2_PER_KM = 0.25;
const ROAD_FACTOR = 1.3;     // straight-line to approximate road distance
const SERVICE_MIN = 5;       // minutes per stop

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function evaluate(label: string, order: Stop[], req: RouteRequest): RouteResult {
  const t0 = performance.now();
  const speed = SPEED_KMH[req.traffic];
  const start = toMin(req.departure_time);
  let clock = start, km = 0, load = 0, violations = 0, onTime = 0, prev = req.depot.location;
  const sequence: RouteResult["sequence"] = [];
  const geometry: [number, number][] = [[prev.lat, prev.lng]];

  for (const st of order) {
    const d = haversineKm(prev, st.location) * ROAD_FACTOR;
    km += d;
    clock += (d / speed) * 60;
    const ok = clock <= toMin(st.window_end);
    if (ok) onTime++;
    sequence.push({ stop_id: st.id, name: st.name, arrival_time: fmt(clock), on_time: ok });
    clock += SERVICE_MIN;
    load += st.load_kg;                       // cumulative load model
    if (load > req.vehicle.capacity_kg) violations++;
    geometry.push([st.location.lat, st.location.lng]);
    prev = st.location;
  }

  const back = haversineKm(prev, req.depot.location) * ROAD_FACTOR;
  km += back;
  clock += (back / speed) * 60;
  geometry.push([req.depot.location.lat, req.depot.location.lng]);

  return {
    label,
    sequence,
    geometry,
    total_distance_km: round(km),
    total_time_min: round(clock - start, 1),
    co2_kg: round(km * KG_CO2_PER_KM),
    on_time_rate: order.length ? round(onTime / order.length, 3) : 0,
    capacity_violations: violations,
    runtime_ms: round(performance.now() - t0, 2),
  };
}

function nearestNeighbour(depot: { location: LatLng }, stops: Stop[]): Stop[] {
  const rest = [...stops], out: Stop[] = [];
  let cur = depot.location;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((st, i) => { const d = haversineKm(cur, st.location); if (d < bd) { bd = d; bi = i; } });
    const [next] = rest.splice(bi, 1);
    out.push(next);
    cur = next.location;
  }
  return out;
}

// Demo service: no PPO model is involved. The "optimized" route is a
// nearest-neighbour heuristic, clearly labelled as a placeholder.
export const mockRouteService: RouteService = {
  async health(): Promise<HealthResponse> {
    return { status: "ok (mock)", model_loaded: false, model_checkpoint: null };
  },
  async compare(req: RouteRequest): Promise<CompareResponse> {
    await delay(600);
    return {
      mode: "demo",
      model_status: "Demo mode: no trained PPO checkpoint connected",
      baseline: evaluate("Baseline (input order)", req.stops, req),
      optimized: evaluate("Heuristic placeholder (nearest neighbour)", nearestNeighbour(req.depot, req.stops), req),
      emission_assumptions: {
        kg_co2_per_km: KG_CO2_PER_KM,
        note: "Placeholder assumption for a light delivery van; replace with documented model values.",
      },
    };
  },
};
