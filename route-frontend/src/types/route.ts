// Shared contract between frontend and FastAPI backend.
// The backend's Pydantic schemas must produce exactly these shapes.

export type TrafficLevel = "low" | "moderate" | "heavy";
export type VehicleType = "van" | "small_truck" | "ev_van";
export type ResultMode = "demo" | "trained" | "unavailable";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Depot {
  name: string;
  location: LatLng;
}

export interface Stop {
  id: string;
  name: string;
  location: LatLng;
  load_kg: number;
  window_start: string; // "HH:MM"
  window_end: string;   // "HH:MM"
  synthetic?: boolean;  // true for generated Bengaluru demo records
}

export interface VehicleSpec {
  type: VehicleType;
  capacity_kg: number;
}

export interface RouteRequest {
  depot: Depot;
  stops: Stop[];
  vehicle: VehicleSpec;
  departure_time: string; // "HH:MM"
  traffic: TrafficLevel;
}

export interface StopArrival {
  stop_id: string;
  name: string;
  arrival_time: string; // "HH:MM"
  on_time: boolean;
}

export interface RouteResult {
  label: string;
  sequence: StopArrival[];
  geometry: [number, number][]; // [lat, lng] polyline points
  total_distance_km: number;
  total_time_min: number;
  co2_kg: number;               // estimated, not measured
  fuel_l?: number;
  on_time_rate: number;         // 0..1
  capacity_violations: number;
  runtime_ms: number;
}

export interface CompareResponse {
  mode: ResultMode;
  model_status: string;
  baseline: RouteResult;
  optimized: RouteResult | null; // null when no trained model is available
  emission_assumptions: { kg_co2_per_km: number; note: string };
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_checkpoint: string | null;
}

export interface RouteService {
  health(): Promise<HealthResponse>;
  compare(req: RouteRequest): Promise<CompareResponse>;
}
