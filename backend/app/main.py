from contextlib import asynccontextmanager
from typing import cast

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .model_runtime import RouteOptimizer, load_optimizer
from .route_service import build_baseline, evaluate_route
from .schemas import (
    CompareResponse,
    EmissionAssumptions,
    HealthResponse,
    RouteRequest,
)

EMISSION_NOTE = "Placeholder assumption for a light delivery van; replace with documented model values."


@asynccontextmanager
async def lifespan(app: FastAPI):
    optimizer, checkpoint_path = load_optimizer()
    app.state.optimizer = optimizer
    app.state.model_checkpoint = checkpoint_path
    yield


app = FastAPI(title="Trade Route Optimizer API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    checkpoint_path = getattr(request.app.state, "model_checkpoint", None)
    optimizer = getattr(request.app.state, "optimizer", None)
    return HealthResponse(
        status="ok",
        model_loaded=optimizer is not None,
        model_checkpoint=str(checkpoint_path) if checkpoint_path else None,
    )


@app.post("/api/routes/compare", response_model=CompareResponse)
def compare_routes(route_request: RouteRequest, request: Request) -> CompareResponse:
    baseline = build_baseline(route_request)
    optimizer = cast(RouteOptimizer | None, getattr(request.app.state, "optimizer", None))

    if optimizer is None:
        return CompareResponse(
            mode="unavailable",
            model_status=(
                "Baseline calculated. No trained model checkpoint and adapter are configured."
            ),
            baseline=baseline,
            optimized=None,
            emission_assumptions=EmissionAssumptions(
                kg_co2_per_km=0.25,
                note=EMISSION_NOTE,
            ),
        )

    stop_ids = list(optimizer(route_request))
    expected_ids = {stop.id for stop in route_request.stops}
    if len(stop_ids) != len(expected_ids) or set(stop_ids) != expected_ids:
        raise HTTPException(
            status_code=500,
            detail="The configured model adapter must return every request stop ID exactly once.",
        )

    stops_by_id = {stop.id: stop for stop in route_request.stops}
    optimized = evaluate_route(
        "Trained model route",
        [stops_by_id[stop_id] for stop_id in stop_ids],
        route_request,
    )
    return CompareResponse(
        mode="trained",
        model_status="Configured trained-model adapter produced the optimized route.",
        baseline=baseline,
        optimized=optimized,
        emission_assumptions=EmissionAssumptions(
            kg_co2_per_km=0.25,
            note=EMISSION_NOTE,
        ),
    )
