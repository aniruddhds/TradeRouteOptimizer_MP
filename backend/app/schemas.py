from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LatLng(ContractModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)


class Depot(ContractModel):
    name: str
    location: LatLng


class Stop(ContractModel):
    id: str
    name: str
    location: LatLng
    load_kg: float = Field(gt=0, allow_inf_nan=False)
    window_start: str
    window_end: str
    synthetic: bool | None = None

    @field_validator("window_start", "window_end")
    @classmethod
    def validate_time_format(cls, value: str) -> str:
        if len(value) != 5 or value[2] != ":":
            raise ValueError("Time must use HH:MM format.")
        hour, minute = value[:2], value[3:]
        if not (hour.isdigit() and minute.isdigit() and 0 <= int(hour) <= 23 and 0 <= int(minute) <= 59):
            raise ValueError("Time must use HH:MM format.")
        return value

    @model_validator(mode="after")
    def validate_time_window(self) -> "Stop":
        if self.window_start >= self.window_end:
            raise ValueError("Window start must be before window end.")
        return self


class VehicleSpec(ContractModel):
    type: Literal["van", "small_truck", "ev_van"]
    capacity_kg: float = Field(gt=0, allow_inf_nan=False)


class RouteRequest(ContractModel):
    depot: Depot
    stops: list[Stop] = Field(min_length=1, max_length=25)
    vehicle: VehicleSpec
    departure_time: str
    traffic: Literal["low", "moderate", "heavy"]

    @field_validator("departure_time")
    @classmethod
    def validate_departure_time(cls, value: str) -> str:
        return Stop.validate_time_format(value)

    @field_validator("stops")
    @classmethod
    def validate_unique_stop_ids(cls, stops: list[Stop]) -> list[Stop]:
        ids = [stop.id for stop in stops]
        if len(ids) != len(set(ids)):
            raise ValueError("Stop IDs must be unique.")
        return stops


class StopArrival(ContractModel):
    stop_id: str
    name: str
    arrival_time: str
    on_time: bool


class RouteResult(ContractModel):
    label: str
    sequence: list[StopArrival]
    geometry: list[tuple[float, float]]
    total_distance_km: float
    total_time_min: float
    co2_kg: float
    fuel_l: float | None = None
    on_time_rate: float
    capacity_violations: int
    runtime_ms: float


class EmissionAssumptions(ContractModel):
    kg_co2_per_km: float
    note: str


class CompareResponse(ContractModel):
    mode: Literal["demo", "trained", "unavailable"]
    model_status: str
    baseline: RouteResult
    optimized: RouteResult | None
    emission_assumptions: EmissionAssumptions


class HealthResponse(ContractModel):
    status: str
    model_loaded: bool
    model_checkpoint: str | None
