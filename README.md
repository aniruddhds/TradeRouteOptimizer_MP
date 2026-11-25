Trade Route Optimization System for minimizing CO2 emissions.

## Frontend

```powershell
cd route-frontend
Copy-Item .env.example .env
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`. To use the backend, set
`VITE_DATA_SOURCE=api` in `route-frontend\.env`.

## Backend

See [backend/README.md](backend/README.md) for setup, API endpoints, tests, and
how to connect the trained model when its checkpoint and runtime details are
available.
