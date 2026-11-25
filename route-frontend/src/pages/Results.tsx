import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import RouteMap from "../components/RouteMap";
import type { CompareResponse, RouteRequest, RouteResult } from "../types/route";

const BASE_COLOR = "#94a3b8";
const OPT_COLOR = "#16a34a";

// Improvement for lower-is-better metrics: (Baseline - Optimized) / Baseline × 100.
// Negative values mean the optimized route is worse; shown honestly.
const improvement = (base: number, opt: number) => (base === 0 ? null : ((base - opt) / base) * 100);
const fmtPct = (v: number | null) => (v === null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

const METRICS: { key: keyof RouteResult; label: string; lowerIsBetter: boolean; digits: number }[] = [
  { key: "total_distance_km", label: "Total distance (km)", lowerIsBetter: true, digits: 2 },
  { key: "total_time_min", label: "Travel + service time (min)", lowerIsBetter: true, digits: 1 },
  { key: "co2_kg", label: "Estimated CO₂ (kg)", lowerIsBetter: true, digits: 2 },
  { key: "on_time_rate", label: "On-time deliveries", lowerIsBetter: false, digits: 0 },
  { key: "capacity_violations", label: "Capacity violations", lowerIsBetter: true, digits: 0 },
  { key: "runtime_ms", label: "Compute runtime (ms)", lowerIsBetter: true, digits: 2 },
];

const CHARTS = [
  { key: "total_distance_km", label: "Distance (km)" },
  { key: "total_time_min", label: "Time (min)" },
  { key: "co2_kg", label: "Estimated CO₂ (kg)" },
] as const;

const fmtVal = (m: (typeof METRICS)[number], v: number) =>
  m.key === "on_time_rate" ? `${(v * 100).toFixed(0)}%` : v.toFixed(m.digits);

interface Props {
  req: RouteRequest | null;
  res: CompareResponse | null;
  loading: boolean;
}

export default function Results({ req, res, loading }: Props) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Running optimization…</div>;
  }
  if (!res || !req) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="font-medium">No routes calculated yet</p>
        <p className="mt-1 text-sm text-slate-500">Build a route in the Route Planner and click “Optimize route” to see results here.</p>
      </div>
    );
  }

  const base = res.baseline;
  const opt = res.optimized;
  const current = opt ?? base;
  const badge =
    res.mode === "trained" ? ["Trained PPO model", "bg-green-100 text-green-800"]
    : res.mode === "demo" ? ["Demo mode: not a trained model", "bg-amber-100 text-amber-800"]
    : ["Model unavailable", "bg-slate-200 text-slate-700"];
  const co2Gain = opt ? improvement(base.co2_kg, opt.co2_kg) : null;
  const routes = [
    { result: base, color: BASE_COLOR },
    ...(opt ? [{ result: opt, color: OPT_COLOR }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge[1]}`}>{badge[0]}</span>
        <span className="text-sm text-slate-500">{res.model_status}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Stops" value={String(req.stops.length)} />
        <Card label={`Distance (${opt ? "optimized" : "baseline"})`} value={`${current.total_distance_km.toFixed(1)} km`} />
        <Card label="Estimated time" value={`${current.total_time_min.toFixed(0)} min`} />
        <Card label="CO₂ reduction (estimated)" value={fmtPct(co2Gain)} hint={opt ? undefined : "No optimized route available"} />
      </div>

      <RouteMap depot={req.depot.location} stops={req.stops} routes={routes} />
      <p className="text-xs text-slate-500">
        Grey dashed line: baseline. Green line: optimized. Emissions use {res.emission_assumptions.kg_co2_per_km} kg CO₂/km. {res.emission_assumptions.note}
      </p>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Baseline vs optimized</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr><th className="py-2">Metric</th><th>Baseline</th><th>Optimized</th><th>Improvement</th></tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const b = base[m.key] as number;
                const o = opt ? (opt[m.key] as number) : null;
                const imp = o === null ? null
                  : m.lowerIsBetter ? improvement(b, o)
                  : b === 0 ? null : ((o - b) / b) * 100;
                return (
                  <tr key={m.key} className="border-b last:border-0">
                    <td className="py-2">{m.label}</td>
                    <td>{fmtVal(m, b)}</td>
                    <td>{o === null ? "n/a" : fmtVal(m, o)}</td>
                    <td className={imp !== null && imp < 0 ? "text-red-700" : ""}>{fmtPct(imp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!opt && <p className="mt-3 text-xs text-slate-500">Optimized route unavailable. Only the baseline was calculated.</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {CHARTS.map((c) => (
          <div key={c.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-medium">{c.label}</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "Baseline", value: base[c.key] },
                  { name: "Optimized", value: opt ? opt[c.key] : 0 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={OPT_COLOR} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Delivery sequence ({opt ? "optimized" : "baseline"})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr><th className="py-2">#</th><th>Stop</th><th>Arrival</th><th>Window</th><th>Status</th></tr>
            </thead>
            <tbody>
              {current.sequence.map((st, i) => {
                const stop = req.stops.find((x) => x.id === st.stop_id);
                return (
                  <tr key={st.stop_id} className="border-b last:border-0">
                    <td className="py-2">{i + 1}</td>
                    <td>{st.name}</td>
                    <td>{st.arrival_time}</td>
                    <td>{stop ? `${stop.window_start}–${stop.window_end}` : "—"}</td>
                    <td className={st.on_time ? "text-green-700" : "text-red-700"}>{st.on_time ? "On time" : "Late"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
