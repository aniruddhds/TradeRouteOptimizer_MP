import os
from collections.abc import Callable, Sequence
from importlib import import_module
from pathlib import Path
from typing import TypeAlias

from dotenv import load_dotenv

from .schemas import RouteRequest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env", override=False)

RouteOptimizer: TypeAlias = Callable[[RouteRequest], Sequence[str]]


def _configured_path(variable: str) -> Path | None:
    value = os.getenv(variable, "").strip()
    if not value:
        return None
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = BACKEND_ROOT / path
    return path.resolve()


def load_optimizer() -> tuple[RouteOptimizer | None, Path | None]:
    checkpoint_path = _configured_path("ROUTE_MODEL_PATH")
    adapter_spec = os.getenv("ROUTE_MODEL_ADAPTER", "").strip()
    dataset_archive = _configured_path("ROUTE_DATA_ARCHIVE")

    if dataset_archive is not None and not dataset_archive.is_file():
        raise FileNotFoundError(f"Configured dataset archive does not exist: {dataset_archive}")

    if checkpoint_path is None and not adapter_spec:
        return None, None
    if checkpoint_path is None or not adapter_spec:
        raise RuntimeError(
            "Set both ROUTE_MODEL_PATH and ROUTE_MODEL_ADAPTER to load a trained model."
        )
    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"Configured model checkpoint does not exist: {checkpoint_path}")

    module_name, separator, factory_name = adapter_spec.partition(":")
    if not separator or not module_name or not factory_name:
        raise ValueError("ROUTE_MODEL_ADAPTER must use the format 'module.path:factory_name'.")

    module = import_module(module_name)
    factory = getattr(module, factory_name, None)
    if not callable(factory):
        raise TypeError(f"Model adapter factory is not callable: {adapter_spec}")

    optimizer = factory(checkpoint_path, dataset_archive)
    if not callable(optimizer):
        raise TypeError(f"Model adapter did not return a callable optimizer: {adapter_spec}")
    return optimizer, checkpoint_path
