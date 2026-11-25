import { useState } from "react";
import RoutePlanner from "./pages/RoutePlanner";
import Results from "./pages/Results";
import { errorMessage, getRouteService } from "./services/routeService";
import type { CompareResponse, RouteRequest } from "./types/route";

const service = getRouteService();
const SOURCE = import.meta.env.VITE_DATA_SOURCE === "api" ? "Backend API" : "Demo (synthetic data, mock service)";

type Tab = "planner" | "results";
const NAV: { id: Tab; label: string }[] = [
  { id: "planner", label: "Route Planner" },
  { id: "results", label: "Dashboard & Comparison" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("planner");
  const [req, setReq] = useState<RouteRequest | null>(null);
  const [res, setRes] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (r: RouteRequest) => {
    setLoading(true);
    setError(null);
    setTab("results");
    try {
      const out = await service.compare(r);
      setReq(r);
      setRes(out);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 md:flex-row">
      <aside className="border-b border-slate-200 bg-white p-4 md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-4 text-sm font-semibold text-green-700">CO₂-Aware Routing</div>
        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm ${
                tab === n.id ? "bg-green-50 font-medium text-green-800" : "text-slate-600 hover:bg-slate-100"
              }`}>
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">{tab === "planner" ? "Route Planner" : "Dashboard & Comparison"}</h1>
          <p className="text-sm text-slate-500">Data source: {SOURCE}</p>
        </header>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {tab === "planner"
          ? <RoutePlanner onRun={run} loading={loading} />
          : <Results req={req} res={res} loading={loading} />}
      </main>
    </div>
  );
}
