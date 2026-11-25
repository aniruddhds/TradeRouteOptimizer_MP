# FastAPI backend

The API implements the contracts already used by the frontend:

- `GET /api/health`
- `POST /api/routes/compare`

The route baseline uses the same documented placeholder assumptions as the
frontend mock. It does not claim that a trained model is loaded. Until a model
checkpoint and matching adapter are configured, `optimized` is `null` and the
response mode is `unavailable`.

## Run locally

From the repository root in PowerShell:

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

In `route-frontend\.env`, set `VITE_DATA_SOURCE=api` to make the existing UI use
this backend. Its API URL remains `http://localhost:8000`.

Run backend tests from the repository root:

```powershell
python -m unittest discover -s backend\tests
```

## Dataset and model files

The Kaggle archive stays outside this repository and is never extracted or
modified by the backend. The example `ROUTE_DATA_ARCHIVE` path points to
`lastmile_data.zip` beside the repository. The archive contains the large
`package_data.json`, `route_data.json`, and `travel_times.json` datasets along
with evaluation data. The backend passes the archive path to an adapter; it
does not load the datasets into memory itself.

The trained checkpoint is not in this workspace yet. After downloading it,
set `ROUTE_MODEL_PATH` in `backend\.env` to its location, and set
`ROUTE_MODEL_ADAPTER` to a Python factory in `module.path:factory_name` form.
The factory contract is:

```python
def build_optimizer(checkpoint_path, dataset_archive):
    # Load the checkpoint and any required dataset/preprocessing state here.
    def optimize(route_request):
        # Return every input stop ID exactly once, in the model's chosen order.
        return [stop.id for stop in route_request.stops]

    return optimize
```

The adapter is intentionally not preselected: the model algorithm, checkpoint
format, observation preprocessing, and action mapping were not provided. This
avoids loading the checkpoint incorrectly or presenting a heuristic as trained
DRL output.
