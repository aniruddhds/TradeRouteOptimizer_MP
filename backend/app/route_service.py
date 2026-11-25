from math import asin, cos, radians, sin, sqrt
from time import perf_counter

from .schemas import LatLng, RouteRequest, RouteResult, Stop

SPEED_KMH = {"low": 30, "moderate": 20, "heavy": 12}
KG_CO2_PER_KM = 0.25
ROAD_FACTOR = 1.3
SERVICE_MIN = 5


def _minutes(time_text: str) -> int:
    hours, minutes = (int(part) for part in time_text.split(":"))
    return hours * 60 + minutes


def _format_minutes(value: float) -> str:
    hours = int(value // 60)
    minutes = round(value % 60)
    return f"{hours:02d}:{minutes:02d}"


def _round(value: float, digits: int = 2) -> float:
    return round(value, digits)


def _haversine_km(a: LatLng, b: LatLng) -> float:
    earth_radius_km = 6371
    lat1, lng1 = radians(a.lat), radians(a.lng)
    lat2, lng2 = radians(b.lat), radians(b.lng)
    delta_lat = lat2 - lat1
    delta_lng = lng2 - lng1
    arc = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lng / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(arc))


def evaluate_route(label: str, stops: list[Stop], request: RouteRequest) -> RouteResult:
    started = perf_counter()
    speed = SPEED_KMH[request.traffic]
    start_minute = _minutes(request.departure_time)
    clock = start_minute
    distance_km = 0.0
    cumulative_load_kg = 0.0
    capacity_violations = 0
    on_time_count = 0
    previous = request.depot.location
    sequence = []
    geometry = [(previous.lat, previous.lng)]

    for stop in stops:
        leg_km = _haversine_km(previous, stop.location) * ROAD_FACTOR
        distance_km += leg_km
        clock += (leg_km / speed) * 60
        on_time = clock <= _minutes(stop.window_end)
        on_time_count += int(on_time)
        sequence.append(
            {
                "stop_id": stop.id,
                "name": stop.name,
                "arrival_time": _format_minutes(clock),
                "on_time": on_time,
            }
        )
        clock += SERVICE_MIN
        cumulative_load_kg += stop.load_kg
        if cumulative_load_kg > request.vehicle.capacity_kg:
            capacity_violations += 1
        geometry.append((stop.location.lat, stop.location.lng))
        previous = stop.location

    return_leg_km = _haversine_km(previous, request.depot.location) * ROAD_FACTOR
    distance_km += return_leg_km
    clock += (return_leg_km / speed) * 60
    geometry.append((request.depot.location.lat, request.depot.location.lng))

    return RouteResult(
        label=label,
        sequence=sequence,
        geometry=geometry,
        total_distance_km=_round(distance_km),
        total_time_min=_round(clock - start_minute, 1),
        co2_kg=_round(distance_km * KG_CO2_PER_KM),
        on_time_rate=_round(on_time_count / len(stops), 3) if stops else 0,
        capacity_violations=capacity_violations,
        runtime_ms=_round((perf_counter() - started) * 1000),
    )


def build_baseline(request: RouteRequest) -> RouteResult:
    return evaluate_route("Baseline (input order)", request.stops, request)
