import axios from "axios";
import type { CompareResponse, HealthResponse, RouteRequest, RouteService } from "../types/route";
import { mockRouteService } from "./mockRouteService";

// The only place the app talks to the backend. Pages never import axios directly.
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
  timeout: 60_000,
});

export const httpRouteService: RouteService = {
  health: async () => (await http.get<HealthResponse>("/api/health")).data,
  compare: async (req: RouteRequest) =>
    (await http.post<CompareResponse>("/api/routes/compare", req)).data,
};

export function getRouteService(): RouteService {
  return import.meta.env.VITE_DATA_SOURCE === "api" ? httpRouteService : mockRouteService;
}

export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (e.code === "ERR_NETWORK") return "Backend unreachable. Check that FastAPI is running and VITE_API_BASE_URL is correct.";
    const detail = e.response?.data?.detail;
    if (typeof detail === "string") return detail;
    return `Request failed (${e.response?.status ?? "no status"}).`;
  }
  return e instanceof Error ? e.message : "Unknown error.";
}
