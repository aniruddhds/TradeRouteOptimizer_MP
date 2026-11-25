import { useState } from "react";
import type { FormEvent } from "react";
import type { Depot, RouteRequest, Stop, TrafficLevel, VehicleType } from "../types/route";
import { DEMO_DEPOT, DEMO_STOPS } from "../services/mockRouteService";

const VEHICLES: { value: VehicleType; label: string; capacity: number }[] = [
  { value: "van", label: "Delivery van", capacity: 800 },
  { value: "small_truck", label: "Small truck", capacity: 1500 },
  { value: "ev_van", label: "Electric van", capacity: 700 },
];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const inRange = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
const inp = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600";

export function validateInputs(depot: Depot, stops: Stop[], capacity: number, departure: string): string[] {
  const errs: string[] = [];
  if (!inRange(depot.location.lat, -90, 90) || !inRange(depot.location.lng, -180, 180)) errs.push("Depot coordinates are out of range.");
  if (stops.length < 1 || stops.length > 25) errs.push("Add between 1 and 25 delivery stops.");
  if (!(capacity > 0)) errs.push("Vehicle capacity must be greater than 0 kg.");
  if (!TIME.test(departure)) errs.push("Departure time must be HH:MM.");
  stops.forEach((st, i) => {
    const tag = `Stop ${i + 1} (${st.name || "unnamed"})`;
    if (!inRange(st.location.lat, -90, 90) || !inRange(st.location.lng, -180, 180)) errs.push(`${tag}: invalid coordinates.`);
    if (!(st.load_kg > 0)) errs.push(`${tag}: package load must be greater than 0 kg.`);
    if (!TIME.test(st.window_start) || !TIME.test(st.window_end)) errs.push(`${tag}: time windows must be HH:MM.`);
    else if (st.window_start >= st.window_end) errs.push(`${tag}: window start must be before window end.`);
  });
  return errs;
}

interface Props {
  onRun: (req: RouteRequest) => void;
  loading: boolean;
}

export default function RoutePlanner({ onRun, loading }: Props) {
  const [depot, setDepot] = useState<Depot>(DEMO_DEPOT);
  const [stops, setStops] = useState<Stop[]>(DEMO_STOPS);
  const [vehicle, setVehicle] = useState<VehicleType>("van");
  const [capacity, setCapacity] = useState(VEHICLES[0].capacity);
  const [departure, setDeparture] = useState("09:00");
  const [traffic, setTraffic] = useState<TrafficLevel>("moderate");
  const [errors, setErrors] = useState<string[]>([]);
  const [nextExample, setNextExample] = useState(0);

  const updateStop = (i: number, patch: Partial<Stop>) =>
    setStops((prev) => prev.map((st, j) => (j === i ? { ...st, ...patch } : st)));
  const updateCoord = (i: number, key: "lat" | "lng", value: string) =>
    setStops((prev) => prev.map((st, j) => (j === i ? { ...st, location: { ...st.location, [key]: Number(value) } } : st)));
  const addStop = () => {
    const ex = DEMO_STOPS[nextExample % DEMO_STOPS.length];
    setStops((prev) => [...prev, { ...ex, id: `X${Date.now()}`, name: `${ex.name} (new)` }]);
    setNextExample((n) => n + 1);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateInputs(depot, stops, capacity, departure);
    setErrors(errs);
    if (errs.length) return;
    onRun({ depot, stops, vehicle: { type: vehicle, capacity_kg: capacity }, departure_time: departure, traffic });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">Depot and vehicle</h2>
        <p className="mb-4 text-xs text-slate-500">Demo values are synthetic Bengaluru locations, not real depots.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Depot name
            <input className={inp} value={depot.name} onChange={(e) => setDepot({ ...depot, name: e.target.value })} />
          </label>
          <label className="text-sm">Depot latitude
            <input className={inp} type="number" step="any" value={depot.location.lat}
              onChange={(e) => setDepot({ ...depot, location: { ...depot.location, lat: Number(e.target.value) } })} />
          </label>
          <label className="text-sm">Depot longitude
            <input className={inp} type="number" step="any" value={depot.location.lng}
              onChange={(e) => setDepot({ ...depot, location: { ...depot.location, lng: Number(e.target.value) } })} />
          </label>
          <label className="text-sm">Vehicle type
            <select className={inp} value={vehicle} onChange={(e) => {
              const v = VEHICLES.find((x) => x.value === e.target.value)!;
              setVehicle(v.value); setCapacity(v.capacity);
            }}>
              {VEHICLES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </label>
          <label className="text-sm">Capacity (kg)
            <input className={inp} type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </label>
          <label className="text-sm">Departure time
            <input className={inp} type="time" value={departure} onChange={(e) => setDeparture(e.target.value)} />
          </label>
          <label className="text-sm md:col-span-3">Traffic scenario
            <select className={inp} value={traffic} onChange={(e) => setTraffic(e.target.value as TrafficLevel)}>
              <option value="low">Low (simulated)</option>
              <option value="moderate">Moderate (simulated)</option>
              <option value="heavy">Heavy (simulated)</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Delivery stops ({stops.length})</h2>
          <div className="flex gap-2">
            <button type="button" onClick={addStop} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Add stop</button>
            <button type="button" onClick={() => setStops([])} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Clear</button>
          </div>
        </div>
        {stops.length === 0 && <p className="text-sm text-slate-500">No stops yet. Add at least one delivery stop.</p>}
        <div className="space-y-3">
          {stops.map((st, i) => (
            <div key={st.id} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-7">
              <label className="col-span-2 text-xs text-slate-600 md:col-span-2">Name
                <input className={inp} value={st.name} onChange={(e) => updateStop(i, { name: e.target.value })} />
              </label>
              <label className="text-xs text-slate-600">Lat
                <input className={inp} type="number" step="any" value={st.location.lat} onChange={(e) => updateCoord(i, "lat", e.target.value)} />
              </label>
              <label className="text-xs text-slate-600">Lng
                <input className={inp} type="number" step="any" value={st.location.lng} onChange={(e) => updateCoord(i, "lng", e.target.value)} />
              </label>
              <label className="text-xs text-slate-600">Load (kg)
                <input className={inp} type="number" min={0} value={st.load_kg} onChange={(e) => updateStop(i, { load_kg: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-slate-600">Window
                <div className="flex gap-1">
                  <input className={inp} type="time" value={st.window_start} onChange={(e) => updateStop(i, { window_start: e.target.value })} />
                  <input className={inp} type="time" value={st.window_end} onChange={(e) => updateStop(i, { window_end: e.target.value })} />
                </div>
              </label>
              <div className="flex items-end">
                <button type="button" onClick={() => setStops((p) => p.filter((_, j) => j !== i))}
                  className="w-full rounded-md px-2 py-1.5 text-sm text-red-700 hover:bg-red-50">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="mb-1 font-medium">Please fix the following:</p>
          <ul className="list-disc pl-5">{errors.map((er) => <li key={er}>{er}</li>)}</ul>
        </div>
      )}

      <button type="submit" disabled={loading}
        className="rounded-md bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">
        {loading ? "Optimizing…" : "Optimize route"}
      </button>
    </form>
  );
}
